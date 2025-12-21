/**
 * QQ 官方导出 TXT 格式解析器
 * 适配 QQ 群聊旧版导出功能
 *
 * 格式特征：
 * - 文件头：消息记录（此消息记录为文本格式，不支持重新导入）
 * - 群名：消息对象:xxx
 * - 消息格式：时间 昵称(QQ号) 或 时间 昵称<邮箱>
 * - 内容在消息头下一行，可能跨多行
 *
 * 字段映射：
 * - name: platformId（用户ID）
 * - nickname: 群昵称
 * - senderName: 群昵称（用于昵称历史追踪）
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { KNOWN_PLATFORMS, ChatType, MessageType } from '../../../../src/types/base'
import type {
  FormatFeature,
  FormatModule,
  Parser,
  ParseOptions,
  ParseEvent,
  ParsedMeta,
  ParsedMember,
  ParsedMessage,
} from '../types'
import { getFileSize, createProgress } from '../utils'

// ==================== 辅助函数 ====================

/**
 * 从文件名提取群名
 */
function extractNameFromFilePath(filePath: string): string {
  const basename = path.basename(filePath)
  const name = basename.replace(/\.txt$/i, '')
  return name || '未知群聊'
}

// ==================== 特征定义 ====================

export const feature: FormatFeature = {
  id: 'qq-native-txt',
  name: 'QQ 官方导出 (TXT)',
  platform: KNOWN_PLATFORMS.QQ,
  priority: 30,
  extensions: ['.txt'],
  signatures: {
    head: [/消息记录（此消息记录为文本格式/, /消息对象:/],
  },
}

// ==================== 消息头正则 ====================

// 匹配：2019-07-16 18:15:05 夜喵大人🐱(642163903)
// 或：2019-07-16 18:15:11 铛🔔<ppbaozi@gmail.com>
const MESSAGE_HEADER_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (.+?)(?:\(([^)]+)\)|<([^>]+)>)$/

// 匹配群名：消息对象:杭州FE
const GROUP_NAME_REGEX = /^消息对象:(.+)$/

// ==================== 消息类型判断 ====================

function detectMessageType(content: string): MessageType {
  const trimmed = content.trim()

  // 基础消息类型
  if (trimmed === '[图片]') return MessageType.IMAGE
  if (trimmed === '[表情]') return MessageType.EMOJI
  if (trimmed === '[语音]') return MessageType.VOICE
  if (trimmed === '[视频]') return MessageType.VIDEO
  if (trimmed === '[文件]') return MessageType.FILE
  if (trimmed === '[位置]' || trimmed === '[地理位置]') return MessageType.LOCATION
  if (trimmed === '[链接]' || trimmed === '[卡片消息]') return MessageType.LINK

  // 交互消息类型
  if (trimmed === '[红包]' || trimmed.includes('发出了红包')) return MessageType.RED_PACKET
  if (trimmed === '[转账]' || trimmed.includes('向你转账')) return MessageType.TRANSFER
  if (trimmed.includes('拍了拍') || trimmed === '[拍一拍]') return MessageType.POKE
  if (trimmed === '[语音通话]' || trimmed === '[视频通话]' || trimmed.includes('通话时长')) return MessageType.CALL
  if (trimmed === '[分享]' || trimmed === '[音乐]' || trimmed === '[小程序]') return MessageType.SHARE
  if (trimmed.startsWith('[回复]')) return MessageType.REPLY
  if (trimmed === '[转发]' || trimmed === '[聊天记录]') return MessageType.FORWARD

  // 系统消息类型
  if (trimmed.includes('撤回了一条消息') || trimmed === '[撤回]') return MessageType.RECALL
  if (
    trimmed.includes('加入了群聊') ||
    trimmed.includes('退出了群聊') ||
    trimmed.includes('被移出群聊') ||
    trimmed.includes('修改了群名称') ||
    trimmed.includes('成为新群主') ||
    trimmed.includes('群公告')
  ) {
    return MessageType.SYSTEM
  }

  // 其他方括号包裹的特殊消息
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return MessageType.OTHER

  return MessageType.TEXT
}

// ==================== 时间解析 ====================

/**
 * 解析本地时间字符串为秒级时间戳
 * @param timeStr 格式：2019-07-16 18:15:05
 */
function parseLocalTime(timeStr: string): number {
  // 直接用 Date 解析，会按本地时区处理
  const date = new Date(timeStr.replace(' ', 'T'))
  return Math.floor(date.getTime() / 1000)
}

// ==================== 昵称清理 ====================

/**
 * 清理昵称中的前缀污染
 * 例如：【管理员】张三 -> 张三
 */
function cleanNickname(nickname: string): string {
  // 移除开头的【xxx】前缀（可能有多个）
  return nickname.replace(/^(【[^】]*】\s*)+/, '').trim()
}

// ==================== 成员信息 ====================

interface MemberInfo {
  platformId: string
  nickname: string // 群昵称
}

// 用于记录用户最近的有效昵称（昵称 != ID 的情况）
const lastValidNickname = new Map<string, string>()

// ==================== 解析器实现 ====================

async function* parseTxt(options: ParseOptions): AsyncGenerator<ParseEvent, void, unknown> {
  const { filePath, batchSize = 5000, onProgress } = options

  const totalBytes = getFileSize(filePath)
  let bytesRead = 0
  let messagesProcessed = 0

  // 发送初始进度
  const initialProgress = createProgress('parsing', 0, totalBytes, 0, '开始解析...')
  yield { type: 'progress', data: initialProgress }
  onProgress?.(initialProgress)

  // 收集数据
  let groupName = '未知群聊'
  const memberMap = new Map<string, MemberInfo>()
  const messages: ParsedMessage[] = []

  // 当前正在解析的消息
  let currentMessage: {
    timestamp: number
    platformId: string
    nickname: string
    contentLines: string[]
  } | null = null

  // 保存当前消息
  const saveCurrentMessage = () => {
    if (currentMessage) {
      const content = currentMessage.contentLines.join('\n').trim()
      const type = detectMessageType(content)

      messages.push({
        senderPlatformId: currentMessage.platformId,
        senderAccountName: currentMessage.nickname, // QQ TXT 格式只有一个昵称，作为账号名称追踪历史
        // 不设置 senderGroupNickname，避免同一昵称被重复追踪
        timestamp: currentMessage.timestamp,
        type,
        content: content || null,
      })

      // 更新成员信息（保留最新昵称）
      memberMap.set(currentMessage.platformId, {
        platformId: currentMessage.platformId,
        nickname: currentMessage.nickname,
      })

      messagesProcessed++
    }
  }

  // 逐行读取文件
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  fileStream.on('data', (chunk: string | Buffer) => {
    bytesRead += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
  })

  for await (const line of rl) {
    // 检查群名
    const groupMatch = line.match(GROUP_NAME_REGEX)
    if (groupMatch) {
      groupName = groupMatch[1].trim()
      continue
    }

    // 检查消息头
    const headerMatch = line.match(MESSAGE_HEADER_REGEX)
    if (headerMatch) {
      // 保存前一条消息
      saveCurrentMessage()

      const timeStr = headerMatch[1]
      const rawNickname = headerMatch[2].trim()
      let nickname = cleanNickname(rawNickname) // 清理前缀污染
      const platformId = headerMatch[3] || headerMatch[4] // (id) 或 <email>

      // 如果昵称和 ID 相同，可能是系统故障，使用之前记录的昵称
      if (nickname === platformId) {
        const previousNickname = lastValidNickname.get(platformId)
        if (previousNickname) {
          nickname = previousNickname
        }
        // 如果没有之前的记录，保持使用 ID 作为昵称
      } else {
        // 记录有效昵称（昵称 != ID）
        lastValidNickname.set(platformId, nickname)
      }

      currentMessage = {
        timestamp: parseLocalTime(timeStr),
        platformId,
        nickname,
        contentLines: [],
      }

      // 更新进度
      if (messagesProcessed % 1000 === 0) {
        const progress = createProgress(
          'parsing',
          bytesRead,
          totalBytes,
          messagesProcessed,
          `已处理 ${messagesProcessed} 条消息...`
        )
        onProgress?.(progress)
      }

      continue
    }

    // 内容行（追加到当前消息）
    if (currentMessage) {
      // 跳过分隔线
      if (line.startsWith('=====')) continue
      // 跳过文件头信息
      if (line.startsWith('消息记录') || line.startsWith('消息分组')) continue

      currentMessage.contentLines.push(line)
    }
  }

  // 保存最后一条消息
  saveCurrentMessage()

  // 发送 meta（如果群名仍是默认值，使用文件名作为后备）
  const meta: ParsedMeta = {
    name: groupName === '未知群聊' ? extractNameFromFilePath(filePath) : groupName,
    platform: KNOWN_PLATFORMS.QQ,
    type: ChatType.GROUP,
  }
  yield { type: 'meta', data: meta }

  // 发送成员（QQ TXT 格式只有一个昵称，只设置 accountName 避免重复追踪）
  const members: ParsedMember[] = Array.from(memberMap.values()).map((m) => ({
    platformId: m.platformId,
    accountName: m.nickname, // QQ TXT 格式只有昵称，作为账号名称
    // 不设置 groupNickname，避免同一昵称被重复追踪
  }))
  yield { type: 'members', data: members }

  // 分批发送消息
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    yield { type: 'messages', data: batch }
  }

  // 完成
  const doneProgress = createProgress('done', totalBytes, totalBytes, messagesProcessed, '解析完成')
  yield { type: 'progress', data: doneProgress }
  onProgress?.(doneProgress)

  yield {
    type: 'done',
    data: { messageCount: messagesProcessed, memberCount: memberMap.size },
  }
}

// ==================== 导出解析器 ====================

export const parser_: Parser = {
  feature,
  parse: parseTxt,
}

// ==================== 导出格式模块 ====================

const module_: FormatModule = {
  feature,
  parser: parser_,
  // TXT 格式不需要预处理器
}

export default module_
