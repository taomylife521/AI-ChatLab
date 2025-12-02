/**
 * LLM 服务模块入口
 * 提供统一的 LLM 服务管理
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { LLMConfig, LLMProvider, ILLMService, ProviderInfo, ChatMessage, ChatOptions, ChatStreamChunk } from './types'
import { DeepSeekService, DEEPSEEK_INFO } from './deepseek'
import { QwenService, QWEN_INFO } from './qwen'
import { aiLogger } from '../logger'

// 导出类型
export * from './types'

// 所有支持的提供商信息
export const PROVIDERS: ProviderInfo[] = [DEEPSEEK_INFO, QWEN_INFO]

// 配置文件路径
let CONFIG_PATH: string | null = null

function getConfigPath(): string {
  if (CONFIG_PATH) return CONFIG_PATH

  try {
    const docPath = app.getPath('documents')
    CONFIG_PATH = path.join(docPath, 'ChatLab', 'ai', 'llm-config.json')
  } catch {
    CONFIG_PATH = path.join(process.cwd(), 'ai', 'llm-config.json')
  }

  return CONFIG_PATH
}

/**
 * LLM 配置管理
 */
export interface StoredConfig {
  provider: LLMProvider
  apiKey: string
  model?: string
  maxTokens?: number
}

/**
 * 保存 LLM 配置
 */
export function saveLLMConfig(config: StoredConfig): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 加载 LLM 配置
 */
export function loadLLMConfig(): StoredConfig | null {
  const configPath = getConfigPath()

  if (!fs.existsSync(configPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content) as StoredConfig
  } catch {
    return null
  }
}

/**
 * 删除 LLM 配置
 */
export function deleteLLMConfig(): void {
  const configPath = getConfigPath()

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath)
  }
}

/**
 * 检查是否已配置 LLM
 */
export function hasLLMConfig(): boolean {
  const config = loadLLMConfig()
  return config !== null && !!config.apiKey
}

/**
 * 创建 LLM 服务实例
 */
export function createLLMService(config: LLMConfig): ILLMService {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekService(config.apiKey, config.model, config.baseUrl)
    case 'qwen':
      return new QwenService(config.apiKey, config.model, config.baseUrl)
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`)
  }
}

/**
 * 获取当前配置的 LLM 服务实例
 */
export function getCurrentLLMService(): ILLMService | null {
  const config = loadLLMConfig()
  if (!config || !config.apiKey) {
    return null
  }

  return createLLMService({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
  })
}

/**
 * 获取提供商信息
 */
export function getProviderInfo(provider: LLMProvider): ProviderInfo | null {
  return PROVIDERS.find((p) => p.id === provider) || null
}

/**
 * 验证 API Key
 */
export async function validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
  const service = createLLMService({ provider, apiKey })
  return service.validateApiKey()
}

/**
 * 发送聊天请求（使用当前配置）
 */
export async function chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  aiLogger.info('LLM', '开始非流式聊天请求', {
    messagesCount: messages.length,
    firstMessageRole: messages[0]?.role,
    firstMessageLength: messages[0]?.content?.length,
    options,
  })

  const service = getCurrentLLMService()
  if (!service) {
    aiLogger.error('LLM', '服务未配置')
    throw new Error('LLM 服务未配置，请先在设置中配置 API Key')
  }

  aiLogger.info('LLM', `使用提供商: ${service.getProvider()}`)

  try {
    const response = await service.chat(messages, options)
    aiLogger.info('LLM', '非流式请求成功', {
      contentLength: response.content?.length,
      finishReason: response.finishReason,
      usage: response.usage,
    })
    return response.content
  } catch (error) {
    aiLogger.error('LLM', '非流式请求失败', { error: String(error) })
    throw error
  }
}

/**
 * 发送聊天请求（流式，使用当前配置）
 */
export async function* chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk> {
  aiLogger.info('LLM', '开始流式聊天请求', {
    messagesCount: messages.length,
    firstMessageRole: messages[0]?.role,
    firstMessageLength: messages[0]?.content?.length,
    options,
  })

  const service = getCurrentLLMService()
  if (!service) {
    aiLogger.error('LLM', '服务未配置（流式）')
    throw new Error('LLM 服务未配置，请先在设置中配置 API Key')
  }

  aiLogger.info('LLM', `使用提供商（流式）: ${service.getProvider()}`)

  let chunkCount = 0
  let totalContent = ''

  try {
    for await (const chunk of service.chatStream(messages, options)) {
      chunkCount++
      totalContent += chunk.content
      yield chunk

      if (chunk.isFinished) {
        aiLogger.info('LLM', '流式请求完成', {
          chunkCount,
          totalContentLength: totalContent.length,
          finishReason: chunk.finishReason,
        })
      }
    }
  } catch (error) {
    aiLogger.error('LLM', '流式请求失败', {
      error: String(error),
      chunkCountBeforeError: chunkCount,
    })
    throw error
  }
}

