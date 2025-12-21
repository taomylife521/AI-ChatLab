/**
 * ChatLab AI 相关类型定义
 * 包含：提示词预设、AI 配置
 */

// ==================== AI 提示词预设 ====================

/**
 * 提示词预设适用的聊天类型
 */
export type PromptPresetChatType = 'group' | 'private'

/**
 * AI 提示词预设
 */
export interface PromptPreset {
  id: string
  name: string // 预设名称
  chatType: PromptPresetChatType // 适用类型
  roleDefinition: string // 角色定义（可编辑）
  responseRules: string // 回答要求（可编辑）
  isBuiltIn: boolean // 是否内置（内置不可删除）
  createdAt: number
  updatedAt: number
}

/**
 * AI 提示词配置（激活的预设）
 */
export interface AIPromptSettings {
  activeGroupPresetId: string // 群聊激活的预设ID
  activePrivatePresetId: string // 私聊激活的预设ID
}

