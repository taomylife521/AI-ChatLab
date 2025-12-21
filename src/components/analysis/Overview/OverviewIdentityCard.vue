<script setup lang="ts">
import type { AnalysisSession } from '@/types/base'

defineProps<{
  session: AnalysisSession
  totalDurationDays: number
  totalDailyAvgMessages: number
}>()
</script>

<template>
  <div class="relative overflow-hidden rounded-3xl bg-pink-500 p-8 text-white shadow-xl">
    <div class="relative">
      <div>
        <div class="flex items-center gap-3">
          <h2 class="text-3xl font-black tracking-tight">{{ session.name }}</h2>
          <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
            {{ session.platform.toUpperCase() }}
          </span>
        </div>
        <p class="mt-2 text-lg text-white/90 font-medium">
          {{ session.memberCount > 2 ? '群聊' : '私聊' }} ·
          <span class="opacity-80">数据分析报告</span>
        </p>
      </div>

      <div class="mt-8 grid grid-cols-3 gap-6">
        <div class="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md">
          <p class="text-3xl font-black tracking-tight">{{ session.messageCount.toLocaleString() }}</p>
          <p class="mt-1 text-sm font-medium text-white/70">消息总数</p>
        </div>
        <div class="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md">
          <p class="text-3xl font-black tracking-tight">{{ totalDurationDays }}</p>
          <p class="mt-1 text-sm font-medium text-white/70">跨度天数</p>
        </div>
        <div class="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md">
          <p class="text-3xl font-black tracking-tight">{{ totalDailyAvgMessages }}</p>
          <p class="mt-1 text-sm font-medium text-white/70">日均消息</p>
        </div>
      </div>
    </div>
  </div>
</template>
