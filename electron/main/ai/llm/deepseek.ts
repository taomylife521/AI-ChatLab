/**
 * DeepSeek LLM Provider
 * 使用 OpenAI 兼容的 API 格式
 */

import type {
  ILLMService,
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatStreamChunk,
  ProviderInfo,
} from './types'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'

const MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话模型' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码生成模型' },
]

export const DEEPSEEK_INFO: ProviderInfo = {
  id: 'deepseek',
  name: 'DeepSeek',
  description: 'DeepSeek AI 大语言模型',
  defaultBaseUrl: DEFAULT_BASE_URL,
  models: MODELS,
}

export class DeepSeekService implements ILLMService {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(apiKey: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl || DEFAULT_BASE_URL
    this.model = model || 'deepseek-chat'
  }

  getProvider(): LLMProvider {
    return 'deepseek'
  }

  getModels(): string[] {
    return MODELS.map((m) => m.id)
  }

  getDefaultModel(): string {
    return 'deepseek-chat'
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]

    return {
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason === 'stop' ? 'stop' : choice?.finish_reason === 'length' ? 'length' : 'error',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            yield { content: '', isFinished: true, finishReason: 'stop' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            const finishReason = parsed.choices?.[0]?.finish_reason

            if (delta?.content) {
              yield {
                content: delta.content,
                isFinished: false,
              }
            }

            if (finishReason) {
              yield {
                content: '',
                isFinished: true,
                finishReason: finishReason === 'stop' ? 'stop' : finishReason === 'length' ? 'length' : 'error',
              }
              return
            }
          } catch {
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // 发送一个简单请求验证 API Key
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

