/**
 * 数据库分析模块
 * 负责各种数据分析查询
 */

import type {
  MemberActivity,
  HourlyActivity,
  DailyActivity,
  WeekdayActivity,
  MessageType,
  RepeatAnalysis,
  RepeatStatItem,
  RepeatRateItem,
  ChainLengthDistribution,
  HotRepeatContent,
  CatchphraseAnalysis,
} from '../../../src/types/chat'
import { openDatabase } from './core'

/**
 * 时间过滤参数
 */
export interface TimeFilter {
  startTs?: number
  endTs?: number
}

/**
 * 构建时间过滤 WHERE 子句
 */
function buildTimeFilter(filter?: TimeFilter): { clause: string; params: number[] } {
  const conditions: string[] = []
  const params: number[] = []

  if (filter?.startTs !== undefined) {
    conditions.push('ts >= ?')
    params.push(filter.startTs)
  }
  if (filter?.endTs !== undefined) {
    conditions.push('ts <= ?')
    params.push(filter.endTs)
  }

  return {
    clause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

/**
 * 构建排除系统消息的过滤条件
 */
function buildSystemMessageFilter(existingClause: string): string {
  const systemFilter = "m.name != '系统消息'"

  if (existingClause.includes('WHERE')) {
    return existingClause + ' AND ' + systemFilter
  } else {
    return ' WHERE ' + systemFilter
  }
}

/**
 * 获取可用的年份列表
 */
export function getAvailableYears(sessionId: string): number[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const rows = db
      .prepare(
        `
      SELECT DISTINCT CAST(strftime('%Y', ts, 'unixepoch', 'localtime') AS INTEGER) as year
      FROM message
      ORDER BY year DESC
    `
      )
      .all() as Array<{ year: number }>

    return rows.map((r) => r.year)
  } finally {
    db.close()
  }
}

/**
 * 获取成员活跃度排行
 */
export function getMemberActivity(sessionId: string, filter?: TimeFilter): MemberActivity[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const { clause, params } = buildTimeFilter(filter)

    const msgFilterBase = clause ? clause.replace('WHERE', 'AND') : ''
    const msgFilterWithSystem = msgFilterBase + " AND m.name != '系统消息'"

    const totalClauseWithSystem = buildSystemMessageFilter(clause)
    const totalMessages = (
      db
        .prepare(
          `SELECT COUNT(*) as count
         FROM message msg
         JOIN member m ON msg.sender_id = m.id
         ${totalClauseWithSystem}`
        )
        .get(...params) as { count: number }
    ).count

    const rows = db
      .prepare(
        `
      SELECT
        m.id as memberId,
        m.platform_id as platformId,
        m.name,
        COUNT(msg.id) as messageCount
      FROM member m
      LEFT JOIN message msg ON m.id = msg.sender_id ${msgFilterWithSystem}
      WHERE m.name != '系统消息'
      GROUP BY m.id
      HAVING messageCount > 0
      ORDER BY messageCount DESC
    `
      )
      .all(...params) as Array<{
      memberId: number
      platformId: string
      name: string
      messageCount: number
    }>

    return rows.map((row) => ({
      memberId: row.memberId,
      platformId: row.platformId,
      name: row.name,
      messageCount: row.messageCount,
      percentage: totalMessages > 0 ? Math.round((row.messageCount / totalMessages) * 10000) / 100 : 0,
    }))
  } finally {
    db.close()
  }
}

/**
 * 获取每小时活跃度分布
 */
export function getHourlyActivity(sessionId: string, filter?: TimeFilter): HourlyActivity[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const { clause, params } = buildTimeFilter(filter)
    const clauseWithSystem = buildSystemMessageFilter(clause)

    const rows = db
      .prepare(
        `
      SELECT
        CAST(strftime('%H', msg.ts, 'unixepoch', 'localtime') AS INTEGER) as hour,
        COUNT(*) as messageCount
      FROM message msg
      JOIN member m ON msg.sender_id = m.id
      ${clauseWithSystem}
      GROUP BY hour
      ORDER BY hour
    `
      )
      .all(...params) as Array<{ hour: number; messageCount: number }>

    const result: HourlyActivity[] = []
    for (let h = 0; h < 24; h++) {
      const found = rows.find((r) => r.hour === h)
      result.push({
        hour: h,
        messageCount: found ? found.messageCount : 0,
      })
    }

    return result
  } finally {
    db.close()
  }
}

/**
 * 获取每日活跃度趋势
 */
export function getDailyActivity(sessionId: string, filter?: TimeFilter): DailyActivity[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const { clause, params } = buildTimeFilter(filter)
    const clauseWithSystem = buildSystemMessageFilter(clause)

    const rows = db
      .prepare(
        `
      SELECT
        strftime('%Y-%m-%d', msg.ts, 'unixepoch', 'localtime') as date,
        COUNT(*) as messageCount
      FROM message msg
      JOIN member m ON msg.sender_id = m.id
      ${clauseWithSystem}
      GROUP BY date
      ORDER BY date
    `
      )
      .all(...params) as Array<{ date: string; messageCount: number }>

    return rows
  } finally {
    db.close()
  }
}

/**
 * 获取消息类型分布
 */
export function getMessageTypeDistribution(
  sessionId: string,
  filter?: TimeFilter
): Array<{ type: MessageType; count: number }> {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const { clause, params } = buildTimeFilter(filter)
    const clauseWithSystem = buildSystemMessageFilter(clause)

    const rows = db
      .prepare(
        `
      SELECT msg.type, COUNT(*) as count
      FROM message msg
      JOIN member m ON msg.sender_id = m.id
      ${clauseWithSystem}
      GROUP BY msg.type
      ORDER BY count DESC
    `
      )
      .all(...params) as Array<{ type: number; count: number }>

    return rows.map((r) => ({
      type: r.type as MessageType,
      count: r.count,
    }))
  } finally {
    db.close()
  }
}

/**
 * 获取时间范围
 */
export function getTimeRange(sessionId: string): { start: number; end: number } | null {
  const db = openDatabase(sessionId)
  if (!db) return null

  try {
    const row = db
      .prepare(
        `
      SELECT MIN(ts) as start, MAX(ts) as end FROM message
    `
      )
      .get() as { start: number | null; end: number | null }

    if (row.start === null || row.end === null) return null

    return { start: row.start, end: row.end }
  } finally {
    db.close()
  }
}

/**
 * 获取成员的历史昵称记录
 */
export function getMemberNameHistory(
  sessionId: string,
  memberId: number
): Array<{ name: string; startTs: number; endTs: number | null }> {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const rows = db
      .prepare(
        `
      SELECT name, start_ts as startTs, end_ts as endTs
      FROM member_name_history
      WHERE member_id = ?
      ORDER BY start_ts DESC
    `
      )
      .all(memberId) as Array<{ name: string; startTs: number; endTs: number | null }>

    return rows
  } finally {
    db.close()
  }
}

/**
 * 获取复读分析数据
 * 使用滑动窗口算法检测复读链：
 * - 复读成立条件：至少 3 条连续的相同内容消息，且发送者不同
 * - 排除：系统消息、空消息、图片消息
 */
export function getRepeatAnalysis(sessionId: string, filter?: TimeFilter): RepeatAnalysis {
  const db = openDatabase(sessionId)
  const emptyResult: RepeatAnalysis = {
    originators: [],
    initiators: [],
    breakers: [],
    originatorRates: [],
    initiatorRates: [],
    breakerRates: [],
    chainLengthDistribution: [],
    hotContents: [],
    avgChainLength: 0,
    totalRepeatChains: 0,
  }

  if (!db) {
    return emptyResult
  }

  try {
    const { clause, params } = buildTimeFilter(filter)

    let whereClause = clause
    if (whereClause.includes('WHERE')) {
      whereClause +=
        " AND m.name != '系统消息' AND msg.type = 0 AND msg.content IS NOT NULL AND TRIM(msg.content) != ''"
    } else {
      whereClause =
        " WHERE m.name != '系统消息' AND msg.type = 0 AND msg.content IS NOT NULL AND TRIM(msg.content) != ''"
    }

    const messages = db
      .prepare(
        `
        SELECT
          msg.id,
          msg.sender_id as senderId,
          msg.content,
          msg.ts,
          m.platform_id as platformId,
          m.name
        FROM message msg
        JOIN member m ON msg.sender_id = m.id
        ${whereClause}
        ORDER BY msg.ts ASC, msg.id ASC
      `
      )
      .all(...params) as Array<{
      id: number
      senderId: number
      content: string
      ts: number
      platformId: string
      name: string
    }>

    const originatorCount = new Map<number, number>()
    const initiatorCount = new Map<number, number>()
    const breakerCount = new Map<number, number>()
    const memberMessageCount = new Map<number, number>()

    const memberInfo = new Map<number, { platformId: string; name: string }>()

    const chainLengthCount = new Map<number, number>()

    const contentStats = new Map<
      string,
      { count: number; maxChainLength: number; originatorId: number; lastTs: number }
    >()

    let currentContent: string | null = null
    let repeatChain: Array<{ senderId: number; content: string; ts: number }> = []
    let totalRepeatChains = 0
    let totalChainLength = 0

    const processRepeatChain = (
      chain: Array<{ senderId: number; content: string; ts: number }>,
      breakerId?: number
    ) => {
      if (chain.length < 3) return

      totalRepeatChains++
      const chainLength = chain.length
      totalChainLength += chainLength

      const originatorId = chain[0].senderId
      originatorCount.set(originatorId, (originatorCount.get(originatorId) || 0) + 1)

      const initiatorId = chain[1].senderId
      initiatorCount.set(initiatorId, (initiatorCount.get(initiatorId) || 0) + 1)

      if (breakerId !== undefined) {
        breakerCount.set(breakerId, (breakerCount.get(breakerId) || 0) + 1)
      }

      chainLengthCount.set(chainLength, (chainLengthCount.get(chainLength) || 0) + 1)

      const content = chain[0].content
      const chainTs = chain[0].ts
      const existing = contentStats.get(content)
      if (existing) {
        existing.count++
        existing.lastTs = Math.max(existing.lastTs, chainTs)
        if (chainLength > existing.maxChainLength) {
          existing.maxChainLength = chainLength
          existing.originatorId = originatorId
        }
      } else {
        contentStats.set(content, { count: 1, maxChainLength: chainLength, originatorId, lastTs: chainTs })
      }
    }

    for (const msg of messages) {
      if (!memberInfo.has(msg.senderId)) {
        memberInfo.set(msg.senderId, { platformId: msg.platformId, name: msg.name })
      }

      memberMessageCount.set(msg.senderId, (memberMessageCount.get(msg.senderId) || 0) + 1)

      const content = msg.content.trim()

      if (content === currentContent) {
        const lastSender = repeatChain[repeatChain.length - 1]?.senderId
        if (lastSender !== msg.senderId) {
          repeatChain.push({ senderId: msg.senderId, content, ts: msg.ts })
        }
      } else {
        processRepeatChain(repeatChain, msg.senderId)

        currentContent = content
        repeatChain = [{ senderId: msg.senderId, content, ts: msg.ts }]
      }
    }

    processRepeatChain(repeatChain)

    const buildRankList = (countMap: Map<number, number>, total: number): RepeatStatItem[] => {
      const items: RepeatStatItem[] = []
      for (const [memberId, count] of countMap.entries()) {
        const info = memberInfo.get(memberId)
        if (info) {
          items.push({
            memberId,
            platformId: info.platformId,
            name: info.name,
            count,
            percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
          })
        }
      }
      return items.sort((a, b) => b.count - a.count)
    }

    const buildRateList = (countMap: Map<number, number>): RepeatRateItem[] => {
      const items: RepeatRateItem[] = []
      for (const [memberId, count] of countMap.entries()) {
        const info = memberInfo.get(memberId)
        const totalMessages = memberMessageCount.get(memberId) || 0
        if (info && totalMessages > 0) {
          items.push({
            memberId,
            platformId: info.platformId,
            name: info.name,
            count,
            totalMessages,
            rate: Math.round((count / totalMessages) * 10000) / 100,
          })
        }
      }
      return items.sort((a, b) => b.rate - a.rate)
    }

    const chainLengthDistribution: ChainLengthDistribution[] = []
    for (const [length, count] of chainLengthCount.entries()) {
      chainLengthDistribution.push({ length, count })
    }
    chainLengthDistribution.sort((a, b) => a.length - b.length)

    const hotContents: HotRepeatContent[] = []
    for (const [content, stats] of contentStats.entries()) {
      const originatorInfo = memberInfo.get(stats.originatorId)
      hotContents.push({
        content,
        count: stats.count,
        maxChainLength: stats.maxChainLength,
        originatorName: originatorInfo?.name || '未知',
        lastTs: stats.lastTs,
      })
    }
    hotContents.sort((a, b) => b.maxChainLength - a.maxChainLength)
    const top10HotContents = hotContents.slice(0, 10)

    return {
      originators: buildRankList(originatorCount, totalRepeatChains),
      initiators: buildRankList(initiatorCount, totalRepeatChains),
      breakers: buildRankList(breakerCount, totalRepeatChains),
      originatorRates: buildRateList(originatorCount),
      initiatorRates: buildRateList(initiatorCount),
      breakerRates: buildRateList(breakerCount),
      chainLengthDistribution,
      hotContents: top10HotContents,
      avgChainLength: totalRepeatChains > 0 ? Math.round((totalChainLength / totalRepeatChains) * 100) / 100 : 0,
      totalRepeatChains,
    }
  } finally {
    db.close()
  }
}

/**
 * 获取星期活跃度分布
 * 返回周一到周日的消息统计
 */
export function getWeekdayActivity(sessionId: string, filter?: TimeFilter): WeekdayActivity[] {
  const db = openDatabase(sessionId)
  if (!db) return []

  try {
    const { clause, params } = buildTimeFilter(filter)
    const clauseWithSystem = buildSystemMessageFilter(clause)

    // SQLite strftime('%w') 返回 0-6，0=周日
    // 我们需要转换为 1-7，1=周一，7=周日
    const rows = db
      .prepare(
        `
      SELECT
        CASE
          WHEN CAST(strftime('%w', msg.ts, 'unixepoch', 'localtime') AS INTEGER) = 0 THEN 7
          ELSE CAST(strftime('%w', msg.ts, 'unixepoch', 'localtime') AS INTEGER)
        END as weekday,
        COUNT(*) as messageCount
      FROM message msg
      JOIN member m ON msg.sender_id = m.id
      ${clauseWithSystem}
      GROUP BY weekday
      ORDER BY weekday
    `
      )
      .all(...params) as Array<{ weekday: number; messageCount: number }>

    // 补全所有星期（1-7）
    const result: WeekdayActivity[] = []
    for (let w = 1; w <= 7; w++) {
      const found = rows.find((r) => r.weekday === w)
      result.push({
        weekday: w,
        messageCount: found ? found.messageCount : 0,
      })
    }

    return result
  } finally {
    db.close()
  }
}

/**
 * 获取口头禅分析数据
 * 统计每个成员最常说的内容（前5个）
 * - 排除：系统消息、空消息、图片消息
 * - 排除：过短的内容（少于2个字符）
 */
export function getCatchphraseAnalysis(sessionId: string, filter?: TimeFilter): CatchphraseAnalysis {
  const db = openDatabase(sessionId)
  if (!db) {
    return { members: [] }
  }

  try {
    const { clause, params } = buildTimeFilter(filter)

    let whereClause = clause
    if (whereClause.includes('WHERE')) {
      whereClause +=
        " AND m.name != '系统消息' AND msg.type = 0 AND msg.content IS NOT NULL AND LENGTH(TRIM(msg.content)) >= 2"
    } else {
      whereClause =
        " WHERE m.name != '系统消息' AND msg.type = 0 AND msg.content IS NOT NULL AND LENGTH(TRIM(msg.content)) >= 2"
    }

    const rows = db
      .prepare(
        `
        SELECT
          m.id as memberId,
          m.platform_id as platformId,
          m.name,
          TRIM(msg.content) as content,
          COUNT(*) as count
        FROM message msg
        JOIN member m ON msg.sender_id = m.id
        ${whereClause}
        GROUP BY m.id, TRIM(msg.content)
        ORDER BY m.id, count DESC
      `
      )
      .all(...params) as Array<{
      memberId: number
      platformId: string
      name: string
      content: string
      count: number
    }>

    const memberMap = new Map<
      number,
      {
        memberId: number
        platformId: string
        name: string
        catchphrases: Array<{ content: string; count: number }>
      }
    >()

    for (const row of rows) {
      if (!memberMap.has(row.memberId)) {
        memberMap.set(row.memberId, {
          memberId: row.memberId,
          platformId: row.platformId,
          name: row.name,
          catchphrases: [],
        })
      }

      const member = memberMap.get(row.memberId)!
      if (member.catchphrases.length < 5) {
        member.catchphrases.push({
          content: row.content,
          count: row.count,
        })
      }
    }

    const members = Array.from(memberMap.values())
    members.sort((a, b) => {
      const aTotal = a.catchphrases.reduce((sum, c) => sum + c.count, 0)
      const bTotal = b.catchphrases.reduce((sum, c) => sum + c.count, 0)
      return bTotal - aTotal
    })

    return { members }
  } finally {
    db.close()
  }
}
