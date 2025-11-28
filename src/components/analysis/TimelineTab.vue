<script setup lang="ts">
import { computed } from 'vue'
import type { DailyActivity } from '@/types/chat'
import dayjs from 'dayjs'
import { LineChart } from '@/components/charts'
import type { LineChartData } from '@/components/charts'

const props = defineProps<{
  dailyActivity: DailyActivity[]
  timeRange: { start: number; end: number } | null
}>()

// 检测是否跨年
const isMultiYear = computed(() => {
  if (props.dailyActivity.length < 2) return false
  const years = new Set(props.dailyActivity.map((d) => dayjs(d.date).year()))
  return years.size > 1
})

// 每日趋势图数据
const dailyChartData = computed<LineChartData>(() => {
  // 如果跨年，显示年份；否则只显示月/日
  const dateFormat = isMultiYear.value ? 'YYYY/MM/DD' : 'MM/DD'

  return {
    labels: props.dailyActivity.map((d) => dayjs(d.date).format(dateFormat)),
    values: props.dailyActivity.map((d) => d.messageCount),
  }
})

// 最活跃的一天
const peakDay = computed(() => {
  if (!props.dailyActivity.length) return null
  return props.dailyActivity.reduce((max, d) => (d.messageCount > max.messageCount ? d : max), props.dailyActivity[0])
})

// 平均每日消息数
const avgDailyMessages = computed(() => {
  if (!props.dailyActivity.length) return 0
  const total = props.dailyActivity.reduce((sum, d) => sum + d.messageCount, 0)
  return Math.round(total / props.dailyActivity.length)
})

// 活跃天数
const activeDays = computed(() => {
  return props.dailyActivity.filter((d) => d.messageCount > 0).length
})

// 总天数（从第一条到最后一条消息）
const totalDays = computed(() => {
  if (!props.timeRange) return 0
  const start = dayjs.unix(props.timeRange.start)
  const end = dayjs.unix(props.timeRange.end)
  return end.diff(start, 'day') + 1
})
</script>

<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div>
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">时间轴分析</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">追踪群聊的活跃趋势变化</p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">最活跃日期</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">
          {{ peakDay ? dayjs(peakDay.date).format('MM/DD') : '-' }}
        </p>
        <p class="mt-1 text-xs text-gray-400">{{ peakDay?.messageCount ?? 0 }} 条消息</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">日均消息</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">
          {{ avgDailyMessages }}
        </p>
        <p class="mt-1 text-xs text-gray-400">条/天</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">活跃天数</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">
          {{ activeDays }}
        </p>
        <p class="mt-1 text-xs text-gray-400">/ {{ totalDays }} 天</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">活跃率</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">
          {{ totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0 }}%
        </p>
        <p class="mt-1 text-xs text-gray-400">有消息的天数占比</p>
      </div>
    </div>

    <!-- 每日趋势 -->
    <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">每日消息趋势</h3>
      <LineChart :data="dailyChartData" :height="288" />
    </div>
  </div>
</template>
