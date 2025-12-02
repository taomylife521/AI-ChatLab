/**
 * AI 查询模块
 * 提供关键词搜索功能（在 Worker 线程中执行）
 */

import { openDatabase, buildTimeFilter, type TimeFilter } from '../core'

// ==================== 消息搜索 ====================

/**
 * 搜索消息结果类型
 */
export interface SearchMessageResult {
  id: number
  senderName: string
  senderPlatformId: string
  content: string
  timestamp: number
  type: number
}

/**
 * 关键词搜索消息
 * @param sessionId 会话 ID
 * @param keywords 关键词数组（OR 逻辑）
 * @param filter 时间过滤器
 * @param limit 返回数量限制
 * @param offset 偏移量（分页）
 */
export function searchMessages(
  sessionId: string,
  keywords: string[],
  filter?: TimeFilter,
  limit: number = 20,
  offset: number = 0
): { messages: SearchMessageResult[]; total: number } {
  const db = openDatabase(sessionId)
  if (!db) return { messages: [], total: 0 }

  // 构建关键词条件（OR 逻辑）
  const keywordConditions = keywords.map(() => `msg.content LIKE ?`).join(' OR ')
  const keywordParams = keywords.map((k) => `%${k}%`)

  // 构建时间过滤条件
  const { clause: timeClause, params: timeParams } = buildTimeFilter(filter)
  const timeCondition = timeClause ? timeClause.replace('WHERE', 'AND') : ''

  // 排除系统消息
  const systemFilter = "AND m.name != '系统消息'"

  // 查询总数
  const countSql = `
    SELECT COUNT(*) as total
    FROM message msg
    JOIN member m ON msg.sender_id = m.id
    WHERE (${keywordConditions})
    ${timeCondition}
    ${systemFilter}
  `
  const totalRow = db.prepare(countSql).get(...keywordParams, ...timeParams) as { total: number }
  const total = totalRow?.total || 0

  // 查询消息
  const sql = `
    SELECT
      msg.id,
      m.name as senderName,
      m.platform_id as senderPlatformId,
      msg.content,
      msg.ts as timestamp,
      msg.type
    FROM message msg
    JOIN member m ON msg.sender_id = m.id
    WHERE (${keywordConditions})
    ${timeCondition}
    ${systemFilter}
    ORDER BY msg.ts DESC
    LIMIT ? OFFSET ?
  `

  const rows = db.prepare(sql).all(...keywordParams, ...timeParams, limit, offset) as SearchMessageResult[]

  return { messages: rows, total }
}

/**
 * 获取消息上下文（指定消息前后的消息）
 */
export function getMessageContext(
  sessionId: string,
  messageId: number,
  contextSize: number = 5
): SearchMessageResult[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  // 获取目标消息的时间戳
  const targetMsg = db.prepare('SELECT ts FROM message WHERE id = ?').get(messageId) as { ts: number } | undefined
  if (!targetMsg) return []

  // 获取前后消息
  const sql = `
    SELECT
      msg.id,
      m.name as senderName,
      m.platform_id as senderPlatformId,
      msg.content,
      msg.ts as timestamp,
      msg.type
    FROM message msg
    JOIN member m ON msg.sender_id = m.id
    WHERE m.name != '系统消息'
      AND msg.ts BETWEEN ? AND ?
    ORDER BY msg.ts ASC
    LIMIT ?
  `

  // 获取前后 contextSize 秒的消息（假设平均每秒 1 条消息）
  const timeWindow = contextSize * 60 // 前后各 contextSize 分钟
  const rows = db.prepare(sql).all(
    targetMsg.ts - timeWindow,
    targetMsg.ts + timeWindow,
    contextSize * 2 + 1
  ) as SearchMessageResult[]

  return rows
}

