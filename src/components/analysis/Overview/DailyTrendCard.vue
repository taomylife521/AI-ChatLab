<script setup lang="ts">
import { SectionCard } from '@/components/UI'
import { LineChart } from '@/components/charts'
import type { LineChartData } from '@/components/charts'
import type { DailyActivity } from '@/types/analysis'

defineProps<{
  dailyActivity: DailyActivity[]
  dailyChartData: LineChartData
}>()
</script>

<template>
  <SectionCard v-if="dailyActivity.length > 0" title="每日消息趋势" :show-divider="false">
    <div class="p-5">
      <LineChart :data="dailyChartData" :height="288" />
    </div>
  </SectionCard>
</template>
