/**
 * LLM 服务类型定义
 */

/**
 * 支持的 LLM 提供商
 */
export type LLMProvider = 'deepseek' | 'qwen'

/**
 * LLM 配置
 */
export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model?: string
  baseUrl?: string
  maxTokens?: number
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 聊天请求选项
 */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

/**
 * 非流式响应
 */
export interface ChatResponse {
  content: string
  finishReason: 'stop' | 'length' | 'error'
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * 流式响应 chunk
 */
export interface ChatStreamChunk {
  content: string
  isFinished: boolean
  finishReason?: 'stop' | 'length' | 'error'
}

/**
 * LLM 服务接口
 */
export interface ILLMService {
  /**
   * 获取提供商名称
   */
  getProvider(): LLMProvider

  /**
   * 获取可用模型列表
   */
  getModels(): string[]

  /**
   * 获取默认模型
   */
  getDefaultModel(): string

  /**
   * 发送聊天请求（非流式）
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>

  /**
   * 发送聊天请求（流式）
   */
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk>

  /**
   * 验证 API Key 是否有效
   */
  validateApiKey(): Promise<boolean>
}

/**
 * 提供商信息
 */
export interface ProviderInfo {
  id: LLMProvider
  name: string
  description: string
  defaultBaseUrl: string
  models: Array<{
    id: string
    name: string
    description?: string
  }>
}

