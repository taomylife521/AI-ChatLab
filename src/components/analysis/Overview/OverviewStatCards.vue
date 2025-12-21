<script setup lang="ts">
import { StatCard } from '@/components/UI'
import type { WeekdayActivity, DailyActivity, HourlyActivity } from '@/types/analysis'
import dayjs from 'dayjs'

defineProps<{
  dailyAvgMessages: number
  durationDays: number
  imageCount: number
  peakHour: HourlyActivity | null
  peakWeekday: WeekdayActivity | null
  weekdayNames: string[]
  weekdayVsWeekend: { weekday: number; weekend: number }
  peakDay: DailyActivity | null
  activeDays: number
  totalDays: number
  activeRate: number
  maxConsecutiveDays: number
}>()
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- 日均消息 -->
    <StatCard label="日均消息" :value="`${dailyAvgMessages} 条`" icon="📊" icon-bg="blue">
      <template #subtext>
        <span class="text-sm text-gray-500">共 {{ durationDays }} 天</span>
      </template>
    </StatCard>

    <!-- 图片/表情 -->
    <StatCard label="图片消息" :value="`${imageCount} 张`" icon="📸" icon-bg="pink">
      <template #subtext>
        <span class="text-sm text-gray-500">最活跃时段:</span>
        <span class="font-semibold text-pink-500">{{ peakHour?.hour || 0 }}:00</span>
      </template>
    </StatCard>

    <!-- 最活跃星期 -->
    <StatCard
      label="最活跃星期"
      :value="peakWeekday ? weekdayNames[peakWeekday.weekday - 1] : '-'"
      icon="📅"
      icon-bg="amber"
    >
      <template #subtext>
        <span class="text-sm text-gray-500">{{ peakWeekday?.messageCount ?? 0 }} 条消息</span>
      </template>
    </StatCard>

    <!-- 周末活跃度 -->
    <StatCard label="周末活跃度" :value="`${weekdayVsWeekend.weekend}%`" icon="🏖️" icon-bg="green">
      <template #subtext>
        <span class="text-sm text-gray-500">周末消息占比</span>
      </template>
    </StatCard>

    <!-- 最活跃日期 -->
    <StatCard label="最活跃日期" :value="peakDay ? dayjs(peakDay.date).format('MM/DD') : '-'" icon="🔥" icon-bg="red">
      <template #subtext>
        <span class="text-sm text-gray-500">{{ peakDay?.messageCount ?? 0 }} 条消息</span>
      </template>
    </StatCard>

    <!-- 活跃天数 -->
    <StatCard label="活跃天数" :value="`${activeDays}`" icon="📆" icon-bg="blue">
      <template #subtext>
        <span class="text-sm text-gray-500">/ {{ totalDays }} 天</span>
      </template>
    </StatCard>

    <!-- 连续打卡 -->
    <StatCard label="连续打卡" :value="`${maxConsecutiveDays} 天`" icon="⚡" icon-bg="amber">
      <template #subtext>
        <span class="text-sm text-gray-500">最长连续活跃</span>
      </template>
    </StatCard>

    <!-- 活跃率 -->
    <StatCard label="活跃率" :value="`${activeRate}%`" icon="📈" icon-bg="gray">
      <template #subtext>
        <span class="text-sm text-gray-500">有消息的天数占比</span>
      </template>
    </StatCard>
  </div>
</template>
