/**
 * AI 对话历史管理模块
 * 在主进程中执行，管理 AI 对话的持久化存储
 */

import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// AI 数据库存储目录
let AI_DB_DIR: string | null = null
let AI_DB: Database.Database | null = null

/**
 * 获取 AI 数据库目录
 */
function getAiDbDir(): string {
  if (AI_DB_DIR) return AI_DB_DIR

  try {
    const docPath = app.getPath('documents')
    AI_DB_DIR = path.join(docPath, 'ChatLab', 'ai')
  } catch {
    AI_DB_DIR = path.join(process.cwd(), 'ai')
  }

  return AI_DB_DIR
}

/**
 * 确保 AI 数据库目录存在
 */
function ensureAiDbDir(): void {
  const dir = getAiDbDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 获取 AI 数据库实例（单例）
 */
function getAiDb(): Database.Database {
  if (AI_DB) return AI_DB

  ensureAiDbDir()
  const dbPath = path.join(getAiDbDir(), 'conversations.db')
  AI_DB = new Database(dbPath)
  AI_DB.pragma('journal_mode = WAL')

  // 创建表结构
  AI_DB.exec(`
    -- AI 对话表
    CREATE TABLE IF NOT EXISTS ai_conversation (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- AI 消息表
    CREATE TABLE IF NOT EXISTS ai_message (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      data_keywords TEXT,
      data_message_count INTEGER,
      FOREIGN KEY(conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_ai_conversation_session ON ai_conversation(session_id);
    CREATE INDEX IF NOT EXISTS idx_ai_message_conversation ON ai_message(conversation_id);
  `)

  return AI_DB
}

/**
 * 关闭 AI 数据库连接
 */
export function closeAiDatabase(): void {
  if (AI_DB) {
    AI_DB.close()
    AI_DB = null
  }
}

// ==================== 类型定义 ====================

/**
 * AI 对话类型
 */
export interface AIConversation {
  id: string
  sessionId: string
  title: string | null
  createdAt: number
  updatedAt: number
}

/**
 * AI 消息类型
 */
export interface AIMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  dataKeywords?: string[]
  dataMessageCount?: number
}

// ==================== 对话管理 ====================

/**
 * 创建新对话
 */
export function createConversation(sessionId: string, title?: string): AIConversation {
  const db = getAiDb()
  const now = Math.floor(Date.now() / 1000)
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  db.prepare(`
    INSERT INTO ai_conversation (id, session_id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, title || null, now, now)

  return {
    id,
    sessionId,
    title: title || null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 获取会话的所有对话列表
 */
export function getConversations(sessionId: string): AIConversation[] {
  const db = getAiDb()

  const rows = db.prepare(`
    SELECT id, session_id as sessionId, title, created_at as createdAt, updated_at as updatedAt
    FROM ai_conversation
    WHERE session_id = ?
    ORDER BY updated_at DESC
  `).all(sessionId) as AIConversation[]

  return rows
}

/**
 * 获取单个对话
 */
export function getConversation(conversationId: string): AIConversation | null {
  const db = getAiDb()

  const row = db.prepare(`
    SELECT id, session_id as sessionId, title, created_at as createdAt, updated_at as updatedAt
    FROM ai_conversation
    WHERE id = ?
  `).get(conversationId) as AIConversation | undefined

  return row || null
}

/**
 * 更新对话标题
 */
export function updateConversationTitle(conversationId: string, title: string): boolean {
  const db = getAiDb()
  const now = Math.floor(Date.now() / 1000)

  const result = db.prepare(`
    UPDATE ai_conversation
    SET title = ?, updated_at = ?
    WHERE id = ?
  `).run(title, now, conversationId)

  return result.changes > 0
}

/**
 * 删除对话（级联删除消息）
 */
export function deleteConversation(conversationId: string): boolean {
  const db = getAiDb()

  // 先删除消息
  db.prepare('DELETE FROM ai_message WHERE conversation_id = ?').run(conversationId)
  // 再删除对话
  const result = db.prepare('DELETE FROM ai_conversation WHERE id = ?').run(conversationId)

  return result.changes > 0
}

// ==================== 消息管理 ====================

/**
 * 添加消息到对话
 */
export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  dataKeywords?: string[],
  dataMessageCount?: number
): AIMessage {
  const db = getAiDb()
  const now = Math.floor(Date.now() / 1000)
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  db.prepare(`
    INSERT INTO ai_message (id, conversation_id, role, content, timestamp, data_keywords, data_message_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    conversationId,
    role,
    content,
    now,
    dataKeywords ? JSON.stringify(dataKeywords) : null,
    dataMessageCount ?? null
  )

  // 更新对话的 updated_at
  db.prepare('UPDATE ai_conversation SET updated_at = ? WHERE id = ?').run(now, conversationId)

  return {
    id,
    conversationId,
    role,
    content,
    timestamp: now,
    dataKeywords,
    dataMessageCount,
  }
}

/**
 * 获取对话的所有消息
 */
export function getMessages(conversationId: string): AIMessage[] {
  const db = getAiDb()

  const rows = db.prepare(`
    SELECT
      id,
      conversation_id as conversationId,
      role,
      content,
      timestamp,
      data_keywords as dataKeywords,
      data_message_count as dataMessageCount
    FROM ai_message
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(conversationId) as Array<{
    id: string
    conversationId: string
    role: string
    content: string
    timestamp: number
    dataKeywords: string | null
    dataMessageCount: number | null
  }>

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: row.timestamp,
    dataKeywords: row.dataKeywords ? JSON.parse(row.dataKeywords) : undefined,
    dataMessageCount: row.dataMessageCount ?? undefined,
  }))
}

/**
 * 删除单条消息
 */
export function deleteMessage(messageId: string): boolean {
  const db = getAiDb()
  const result = db.prepare('DELETE FROM ai_message WHERE id = ?').run(messageId)
  return result.changes > 0
}

