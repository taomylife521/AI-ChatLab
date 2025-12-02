import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AnalysisSession,
  MemberActivity,
  MemberNameHistory,
  HourlyActivity,
  DailyActivity,
  WeekdayActivity,
  MonthlyActivity,
  MessageType,
  ImportProgress,
  RepeatAnalysis,
  CatchphraseAnalysis,
  NightOwlAnalysis,
  DragonKingAnalysis,
  DivingAnalysis,
  MonologueAnalysis,
  MentionAnalysis,
  LaughAnalysis,
  MemeBattleAnalysis,
  CheckInAnalysis,
  FileParseInfo,
  ConflictCheckResult,
  MergeParams,
  MergeResult,
} from '../../src/types/chat'

interface TimeFilter {
  startTs?: number
  endTs?: number
}

interface ChatApi {
  selectFile: () => Promise<{ filePath?: string; format?: string; error?: string } | null>
  import: (filePath: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>
  getSessions: () => Promise<AnalysisSession[]>
  getSession: (sessionId: string) => Promise<AnalysisSession | null>
  deleteSession: (sessionId: string) => Promise<boolean>
  renameSession: (sessionId: string, newName: string) => Promise<boolean>
  getAvailableYears: (sessionId: string) => Promise<number[]>
  getMemberActivity: (sessionId: string, filter?: TimeFilter) => Promise<MemberActivity[]>
  getMemberNameHistory: (sessionId: string, memberId: number) => Promise<MemberNameHistory[]>
  getHourlyActivity: (sessionId: string, filter?: TimeFilter) => Promise<HourlyActivity[]>
  getDailyActivity: (sessionId: string, filter?: TimeFilter) => Promise<DailyActivity[]>
  getWeekdayActivity: (sessionId: string, filter?: TimeFilter) => Promise<WeekdayActivity[]>
  getMonthlyActivity: (sessionId: string, filter?: TimeFilter) => Promise<MonthlyActivity[]>
  getMessageTypeDistribution: (
    sessionId: string,
    filter?: TimeFilter
  ) => Promise<Array<{ type: MessageType; count: number }>>
  getTimeRange: (sessionId: string) => Promise<{ start: number; end: number } | null>
  getDbDirectory: () => Promise<string | null>
  getSupportedFormats: () => Promise<Array<{ name: string; platform: string }>>
  onImportProgress: (callback: (progress: ImportProgress) => void) => () => void
  getRepeatAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<RepeatAnalysis>
  getCatchphraseAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<CatchphraseAnalysis>
  getNightOwlAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<NightOwlAnalysis>
  getDragonKingAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<DragonKingAnalysis>
  getDivingAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<DivingAnalysis>
  getMonologueAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<MonologueAnalysis>
  getMentionAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<MentionAnalysis>
  getLaughAnalysis: (sessionId: string, filter?: TimeFilter, keywords?: string[]) => Promise<LaughAnalysis>
  getMemeBattleAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<MemeBattleAnalysis>
  getCheckInAnalysis: (sessionId: string, filter?: TimeFilter) => Promise<CheckInAnalysis>
}

interface Api {
  send: (channel: string, data?: unknown) => void
  receive: (channel: string, func: (...args: unknown[]) => void) => void
  removeListener: (channel: string, func: (...args: unknown[]) => void) => void
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
  }
}

interface MergeApi {
  parseFileInfo: (filePath: string) => Promise<FileParseInfo>
  checkConflicts: (filePaths: string[]) => Promise<ConflictCheckResult>
  mergeFiles: (params: MergeParams) => Promise<MergeResult>
  clearCache: (filePath?: string) => Promise<boolean>
  onParseProgress: (callback: (data: { filePath: string; progress: ImportProgress }) => void) => () => void
}

// AI 相关类型
interface SearchMessageResult {
  id: number
  senderName: string
  senderPlatformId: string
  content: string
  timestamp: number
  type: number
}

interface AIConversation {
  id: string
  sessionId: string
  title: string | null
  createdAt: number
  updatedAt: number
}

interface AIMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  dataKeywords?: string[]
  dataMessageCount?: number
}

interface AiApi {
  searchMessages: (
    sessionId: string,
    keywords: string[],
    filter?: TimeFilter,
    limit?: number,
    offset?: number
  ) => Promise<{ messages: SearchMessageResult[]; total: number }>
  getMessageContext: (sessionId: string, messageId: number, contextSize?: number) => Promise<SearchMessageResult[]>
  createConversation: (sessionId: string, title?: string) => Promise<AIConversation>
  getConversations: (sessionId: string) => Promise<AIConversation[]>
  getConversation: (conversationId: string) => Promise<AIConversation | null>
  updateConversationTitle: (conversationId: string, title: string) => Promise<boolean>
  deleteConversation: (conversationId: string) => Promise<boolean>
  addMessage: (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    dataKeywords?: string[],
    dataMessageCount?: number
  ) => Promise<AIMessage>
  getMessages: (conversationId: string) => Promise<AIMessage[]>
  deleteMessage: (messageId: string) => Promise<boolean>
}

// LLM 相关类型
interface LLMProviderInfo {
  id: string
  name: string
  description: string
  defaultBaseUrl: string
  models: Array<{ id: string; name: string; description?: string }>
}

interface LLMConfig {
  provider: string
  apiKey: string
  apiKeySet: boolean
  model?: string
  maxTokens?: number
}

interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMChatOptions {
  temperature?: number
  maxTokens?: number
}

interface LLMChatStreamChunk {
  content: string
  isFinished: boolean
  finishReason?: 'stop' | 'length' | 'error'
}

interface LlmApi {
  getProviders: () => Promise<LLMProviderInfo[]>
  getConfig: () => Promise<LLMConfig | null>
  saveConfig: (config: {
    provider: string
    apiKey: string
    model?: string
    maxTokens?: number
  }) => Promise<{ success: boolean; error?: string }>
  deleteConfig: () => Promise<boolean>
  validateApiKey: (provider: string, apiKey: string) => Promise<boolean>
  hasConfig: () => Promise<boolean>
  chat: (messages: LLMChatMessage[], options?: LLMChatOptions) => Promise<{ success: boolean; content?: string; error?: string }>
  chatStream: (
    messages: LLMChatMessage[],
    options?: LLMChatOptions,
    onChunk?: (chunk: LLMChatStreamChunk) => void
  ) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
    chatApi: ChatApi
    mergeApi: MergeApi
    aiApi: AiApi
    llmApi: LlmApi
  }
}

export { ChatApi, Api, MergeApi, AiApi, LlmApi, SearchMessageResult, AIConversation, AIMessage, LLMProviderInfo, LLMConfig, LLMChatMessage, LLMChatOptions, LLMChatStreamChunk }
