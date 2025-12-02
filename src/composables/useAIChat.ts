/**
 * AI 对话 Composable
 * 封装 AI 对话的核心逻辑
 */

import { ref, computed } from 'vue'

// 消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  dataSource?: {
    keywords: string[]
    messageCount: number
  }
  isStreaming?: boolean
}

// 搜索结果消息类型
export interface SourceMessage {
  id: number
  senderName: string
  senderPlatformId: string
  content: string
  timestamp: number
  type: number
}

// LLM 聊天消息类型
interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 关键词提取 Prompt
 */
const KEYWORD_EXTRACTION_PROMPT = `你是一个关键词提取助手。用户会提出关于群聊记录的问题，你需要从问题中提取用于搜索的关键词。

规则：
1. 提取 1-5 个最相关的关键词
2. 关键词应该是可能出现在聊天记录中的词语
3. 优先提取名词和动词，避免提取太泛化的词
4. 如果问题涉及人名，也提取人名
5. 只返回关键词，用逗号分隔，不要有其他内容

示例：
问题：帮我找一下群里大家讨论买房的记录
关键词：买房,房价,房子,购房

问题：谁最近在聊游戏
关键词：游戏,玩游戏

问题：大家对新出的手机怎么看
关键词：手机,新机,换机`

/**
 * RAG 总结 Prompt 模板
 */
function createRAGPrompt(question: string, messages: SourceMessage[]): string {
  const messageList = messages
    .map((m) => `[${m.senderName}] ${m.content}`)
    .join('\n')

  return `你是一个群聊记录分析助手。根据以下群聊记录回答用户的问题。

## 群聊记录
${messageList}

## 用户问题
${question}

## 回答要求
1. 基于群聊记录内容回答，不要编造信息
2. 如果记录中没有相关内容，请说明
3. 总结时可以分析群友的态度、观点
4. 回答要简洁明了，使用 Markdown 格式
5. 可以引用具体的发言作为证据`
}

export function useAIChat(sessionId: string, timeFilter?: { startTs: number; endTs: number }) {
  // 状态
  const messages = ref<ChatMessage[]>([])
  const sourceMessages = ref<SourceMessage[]>([])
  const currentKeywords = ref<string[]>([])
  const isLoadingSource = ref(false)
  const isAIThinking = ref(false)
  const currentConversationId = ref<string | null>(null)
  const maxMessagesToSend = ref(50) // 默认发送条数限制

  // 生成消息 ID
  function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * 从用户问题中提取关键词
   */
  async function extractKeywords(question: string): Promise<string[]> {
    console.log('[AI] 开始提取关键词，问题:', question)

    try {
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: KEYWORD_EXTRACTION_PROMPT },
        { role: 'user', content: question },
      ]

      console.log('[AI] 调用 LLM 提取关键词...')
      const result = await window.llmApi.chat(llmMessages, { temperature: 0.3, maxTokens: 100 })
      console.log('[AI] LLM 关键词提取结果:', result)

      if (result.success && result.content) {
        // 解析关键词（逗号分隔）
        const keywords = result.content
          .split(/[,，]/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0 && k.length < 20) // 过滤掉空的和太长的

        console.log('[AI] 解析后的关键词:', keywords)
        return keywords.slice(0, 5) // 最多 5 个关键词
      }

      console.log('[AI] 关键词提取失败，使用简单分词')
      // 如果提取失败，简单分词
      return question
        .split(/[\s,，。！？!?]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 3)
    } catch (error) {
      console.error('[AI] 提取关键词出错:', error)
      // 降级：简单分词
      return question
        .split(/[\s,，。！？!?]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 3)
    }
  }

  /**
   * 搜索相关消息
   */
  async function searchRelatedMessages(keywords: string[]): Promise<SourceMessage[]> {
    console.log('[AI] 开始搜索相关消息，关键词:', keywords)

    if (keywords.length === 0) {
      console.log('[AI] 没有关键词，跳过搜索')
      return []
    }

    try {
      console.log('[AI] 调用搜索 API...', {
        sessionId,
        keywords,
        timeFilter,
        limit: maxMessagesToSend.value,
      })

      const result = await window.aiApi.searchMessages(
        sessionId,
        keywords,
        timeFilter,
        maxMessagesToSend.value,
        0
      )

      console.log('[AI] 搜索结果:', {
        total: result.total,
        returned: result.messages.length,
      })

      return result.messages
    } catch (error) {
      console.error('[AI] 搜索消息出错:', error)
      return []
    }
  }

  /**
   * 生成 RAG 响应（流式）
   */
  async function generateRAGResponse(
    question: string,
    searchResults: SourceMessage[],
    onChunk: (content: string) => void
  ): Promise<void> {
    console.log('[AI] 开始生成 RAG 响应', {
      question,
      searchResultsCount: searchResults.length,
    })

    const prompt = createRAGPrompt(question, searchResults)
    console.log('[AI] 构建的 RAG Prompt 长度:', prompt.length)

    const llmMessages: LLMMessage[] = [{ role: 'user', content: prompt }]

    console.log('[AI] 调用流式 LLM API...')
    let chunkCount = 0

    try {
      await window.llmApi.chatStream(llmMessages, { temperature: 0.7, maxTokens: 2048 }, (chunk) => {
        chunkCount++
        if (chunk.content) {
          onChunk(chunk.content)
        }
        if (chunk.isFinished) {
          console.log('[AI] 流式响应完成', {
            chunkCount,
            finishReason: chunk.finishReason,
          })
        }
      })
      console.log('[AI] 流式 API 调用返回')
    } catch (error) {
      console.error('[AI] 流式 API 调用出错:', error)
      throw error
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string): Promise<void> {
    console.log('[AI] ====== 开始处理用户消息 ======')
    console.log('[AI] 用户输入:', content)

    if (!content.trim() || isAIThinking.value) {
      console.log('[AI] 跳过：内容为空或正在思考')
      return
    }

    // 检查是否已配置 LLM
    console.log('[AI] 检查 LLM 配置...')
    const hasConfig = await window.llmApi.hasConfig()
    console.log('[AI] LLM 配置状态:', hasConfig)

    if (!hasConfig) {
      console.log('[AI] 未配置 LLM，显示提示')
      messages.value.push({
        id: generateId('error'),
        role: 'assistant',
        content: '⚠️ 请先配置 AI 服务。点击右上角「配置」按钮进行配置。',
        timestamp: Date.now(),
      })
      return
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateId('user'),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    messages.value.push(userMessage)
    console.log('[AI] 已添加用户消息')

    // 开始处理
    isAIThinking.value = true
    isLoadingSource.value = true
    console.log('[AI] 开始处理...')

    try {
      // 1. 提取关键词
      console.log('[AI] === Step 1: 提取关键词 ===')
      const keywords = await extractKeywords(content)
      currentKeywords.value = keywords
      console.log('[AI] 关键词提取完成:', keywords)

      // 2. 搜索相关消息
      console.log('[AI] === Step 2: 搜索相关消息 ===')
      const searchResults = await searchRelatedMessages(keywords)
      sourceMessages.value = searchResults
      isLoadingSource.value = false
      console.log('[AI] 搜索完成，找到', searchResults.length, '条消息')

      // 3. 创建 AI 响应消息（流式）
      console.log('[AI] === Step 3: 创建 AI 响应消息 ===')
      const aiMessageId = generateId('ai')
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        dataSource: {
          keywords,
          messageCount: searchResults.length,
        },
        isStreaming: true,
      }
      messages.value.push(aiMessage)
      const aiMessageIndex = messages.value.length - 1
      console.log('[AI] 已添加 AI 消息占位符，索引:', aiMessageIndex)

      // 4. 生成 RAG 响应
      console.log('[AI] === Step 4: 生成 RAG 响应 ===')
      if (searchResults.length === 0) {
        // 没有搜索结果
        console.log('[AI] 没有搜索结果，显示提示')
        messages.value[aiMessageIndex] = {
          ...messages.value[aiMessageIndex],
          content: `没有找到与「${keywords.join('」「')}」相关的聊天记录。

可能的原因：
- 关键词不够准确
- 该时间段内没有相关讨论

你可以尝试：
- 换一种方式描述你想查找的内容
- 使用更具体的关键词`,
          isStreaming: false,
        }
      } else {
        // 有搜索结果，生成总结
        console.log('[AI] 开始生成 RAG 总结...')
        let accumulatedContent = ''
        await generateRAGResponse(content, searchResults, (chunk) => {
          accumulatedContent += chunk
          // 使用索引更新以触发 Vue 响应式
          messages.value[aiMessageIndex] = {
            ...messages.value[aiMessageIndex],
            content: accumulatedContent,
          }
        })
        console.log('[AI] RAG 总结生成完成')
        // 标记流式完成
        messages.value[aiMessageIndex] = {
          ...messages.value[aiMessageIndex],
          isStreaming: false,
        }
      }

      // 5. 保存对话到数据库
      console.log('[AI] === Step 5: 保存对话 ===')
      await saveConversation(userMessage, aiMessage)
      console.log('[AI] 对话已保存')
      console.log('[AI] ====== 处理完成 ======')
    } catch (error) {
      console.error('[AI] ====== 处理失败 ======')
      console.error('[AI] 错误:', error)

      // 添加错误消息
      messages.value.push({
        id: generateId('error'),
        role: 'assistant',
        content: `❌ 处理失败：${error instanceof Error ? error.message : '未知错误'}

请检查：
- 网络连接是否正常
- API Key 是否有效
- 配置是否正确`,
        timestamp: Date.now(),
      })
    } finally {
      isAIThinking.value = false
      isLoadingSource.value = false
    }
  }

  /**
   * 保存对话到数据库
   */
  async function saveConversation(userMsg: ChatMessage, aiMsg: ChatMessage): Promise<void> {
    try {
      // 如果没有当前对话，创建新对话
      if (!currentConversationId.value) {
        const conversation = await window.aiApi.createConversation(sessionId)
        currentConversationId.value = conversation.id
      }

      // 保存用户消息
      await window.aiApi.addMessage(currentConversationId.value, 'user', userMsg.content)

      // 保存 AI 消息
      await window.aiApi.addMessage(
        currentConversationId.value,
        'assistant',
        aiMsg.content,
        aiMsg.dataSource?.keywords,
        aiMsg.dataSource?.messageCount
      )
    } catch (error) {
      console.error('保存对话失败：', error)
    }
  }

  /**
   * 加载对话历史
   */
  async function loadConversation(conversationId: string): Promise<void> {
    try {
      const history = await window.aiApi.getMessages(conversationId)
      currentConversationId.value = conversationId

      messages.value = history.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp * 1000,
        dataSource: msg.dataKeywords
          ? {
              keywords: msg.dataKeywords,
              messageCount: msg.dataMessageCount || 0,
            }
          : undefined,
      }))
    } catch (error) {
      console.error('加载对话历史失败：', error)
    }
  }

  /**
   * 创建新对话
   */
  function startNewConversation(welcomeMessage?: string): void {
    currentConversationId.value = null
    messages.value = []
    sourceMessages.value = []
    currentKeywords.value = []

    if (welcomeMessage) {
      messages.value.push({
        id: generateId('welcome'),
        role: 'assistant',
        content: welcomeMessage,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 加载更多搜索结果
   */
  async function loadMoreSourceMessages(): Promise<void> {
    if (currentKeywords.value.length === 0) return

    try {
      const result = await window.aiApi.searchMessages(
        sessionId,
        currentKeywords.value,
        timeFilter,
        20,
        sourceMessages.value.length
      )

      sourceMessages.value.push(...result.messages)
    } catch (error) {
      console.error('加载更多消息失败：', error)
    }
  }

  /**
   * 更新发送条数限制
   */
  async function updateMaxMessages(): Promise<void> {
    try {
      const config = await window.llmApi.getConfig()
      if (config && config.maxTokens) {
        maxMessagesToSend.value = config.maxTokens
      }
    } catch (error) {
      console.error('获取配置失败：', error)
    }
  }

  return {
    // 状态
    messages,
    sourceMessages,
    currentKeywords,
    isLoadingSource,
    isAIThinking,
    currentConversationId,

    // 方法
    sendMessage,
    loadConversation,
    startNewConversation,
    loadMoreSourceMessages,
    updateMaxMessages,
  }
}

