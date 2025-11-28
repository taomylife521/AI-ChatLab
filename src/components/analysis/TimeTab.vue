<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HourlyActivity, WeekdayActivity } from '@/types/chat'
import { BarChart } from '@/components/charts'
import type { BarChartData } from '@/components/charts'

const props = defineProps<{
  sessionId: string
  hourlyActivity: HourlyActivity[]
  timeFilter?: { startTs?: number; endTs?: number }
}>()

// 星期活跃度数据
const weekdayActivity = ref<WeekdayActivity[]>([])
const isLoadingWeekday = ref(false)

// 星期名称映射（周一开始）
const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// 加载星期活跃度数据
async function loadWeekdayActivity() {
  if (!props.sessionId) return
  isLoadingWeekday.value = true
  try {
    weekdayActivity.value = await window.chatApi.getWeekdayActivity(props.sessionId, props.timeFilter)
  } catch (error) {
    console.error('加载星期活跃度失败:', error)
  } finally {
    isLoadingWeekday.value = false
  }
}

// 监听 sessionId 和 timeFilter 变化
watch(
  () => [props.sessionId, props.timeFilter],
  () => {
    loadWeekdayActivity()
  },
  { immediate: true, deep: true }
)

// 24小时分布图数据
const hourlyChartData = computed<BarChartData>(() => {
  return {
    labels: props.hourlyActivity.map((h) => `${h.hour}:00`),
    values: props.hourlyActivity.map((h) => h.messageCount),
  }
})

// 星期分布图数据
const weekdayChartData = computed<BarChartData>(() => {
  return {
    labels: weekdayActivity.value.map((w) => weekdayNames[w.weekday - 1]),
    values: weekdayActivity.value.map((w) => w.messageCount),
  }
})

// 分析指标
const peakHour = computed(() => {
  if (!props.hourlyActivity.length) return null
  return props.hourlyActivity.reduce((max, h) => (h.messageCount > max.messageCount ? h : max), props.hourlyActivity[0])
})

const peakWeekday = computed(() => {
  if (!weekdayActivity.value.length) return null
  return weekdayActivity.value.reduce((max, w) => (w.messageCount > max.messageCount ? w : max), weekdayActivity.value[0])
})

const lateNightRatio = computed(() => {
  // 深夜定义为 0-6 点
  const lateNight = props.hourlyActivity
    .filter((h) => h.hour >= 0 && h.hour < 6)
    .reduce((sum, h) => sum + h.messageCount, 0)
  const total = props.hourlyActivity.reduce((sum, h) => sum + h.messageCount, 0)
  return total > 0 ? Math.round((lateNight / total) * 100) : 0
})

const morningRatio = computed(() => {
  // 早间定义为 6-12 点
  const morning = props.hourlyActivity
    .filter((h) => h.hour >= 6 && h.hour < 12)
    .reduce((sum, h) => sum + h.messageCount, 0)
  const total = props.hourlyActivity.reduce((sum, h) => sum + h.messageCount, 0)
  return total > 0 ? Math.round((morning / total) * 100) : 0
})

const afternoonRatio = computed(() => {
  // 下午定义为 12-18 点
  const afternoon = props.hourlyActivity
    .filter((h) => h.hour >= 12 && h.hour < 18)
    .reduce((sum, h) => sum + h.messageCount, 0)
  const total = props.hourlyActivity.reduce((sum, h) => sum + h.messageCount, 0)
  return total > 0 ? Math.round((afternoon / total) * 100) : 0
})

const eveningRatio = computed(() => {
  // 晚间定义为 18-24 点
  const evening = props.hourlyActivity
    .filter((h) => h.hour >= 18 && h.hour < 24)
    .reduce((sum, h) => sum + h.messageCount, 0)
  const total = props.hourlyActivity.reduce((sum, h) => sum + h.messageCount, 0)
  return total > 0 ? Math.round((evening / total) * 100) : 0
})

// 工作日 vs 周末
const weekdayVsWeekend = computed(() => {
  if (!weekdayActivity.value.length) return { weekday: 0, weekend: 0 }
  const weekdaySum = weekdayActivity.value
    .filter((w) => w.weekday >= 1 && w.weekday <= 5)
    .reduce((sum, w) => sum + w.messageCount, 0)
  const weekendSum = weekdayActivity.value
    .filter((w) => w.weekday >= 6 && w.weekday <= 7)
    .reduce((sum, w) => sum + w.messageCount, 0)
  const total = weekdaySum + weekendSum
  return {
    weekday: total > 0 ? Math.round((weekdaySum / total) * 100) : 0,
    weekend: total > 0 ? Math.round((weekendSum / total) * 100) : 0,
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div>
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">时间规律分析</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">发现群聊的周期性活跃规律</p>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">最活跃时段</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">{{ peakHour?.hour ?? 0 }}:00</p>
        <p class="mt-1 text-xs text-gray-400">{{ peakHour?.messageCount ?? 0 }} 条消息</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">最活跃星期</p>
        <p class="mt-1 text-2xl font-bold text-pink-600 dark:text-pink-400">
          {{ peakWeekday ? weekdayNames[peakWeekday.weekday - 1] : '-' }}
        </p>
        <p class="mt-1 text-xs text-gray-400">{{ peakWeekday?.messageCount ?? 0 }} 条消息</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">夜猫子指数</p>
        <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ lateNightRatio }}%</p>
        <p class="mt-1 text-xs text-gray-400">深夜活跃占比</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">周末活跃度</p>
        <p class="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{{ weekdayVsWeekend.weekend }}%</p>
        <p class="mt-1 text-xs text-gray-400">周末消息占比</p>
      </div>
    </div>

    <!-- 星期分布 -->
    <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">星期活跃分布</h3>
      <div v-if="isLoadingWeekday" class="flex h-64 items-center justify-center">
        <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-pink-500" />
      </div>
      <BarChart v-else :data="weekdayChartData" :height="256" />

      <!-- 工作日 vs 周末 -->
      <div class="mt-6 grid grid-cols-2 gap-4">
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">工作日（周一至周五）</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ weekdayVsWeekend.weekday }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-pink-500 transition-all" :style="{ width: `${weekdayVsWeekend.weekday}%` }" />
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">周末（周六、周日）</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ weekdayVsWeekend.weekend }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-blue-500 transition-all" :style="{ width: `${weekdayVsWeekend.weekend}%` }" />
          </div>
        </div>
      </div>
    </div>

    <!-- 24小时分布 -->
    <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">24小时活跃分布</h3>
      <BarChart
        :data="hourlyChartData"
        :height="256"
        :x-label-filter="(_, index) => (index % 3 === 0 ? `${index}:00` : '')"
      />

      <!-- 时段分析 -->
      <div class="mt-6 grid grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">凌晨 0-6点</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ lateNightRatio }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-pink-300 transition-all" :style="{ width: `${lateNightRatio}%` }" />
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">上午 6-12点</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ morningRatio }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-pink-400 transition-all" :style="{ width: `${morningRatio}%` }" />
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">下午 12-18点</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ afternoonRatio }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-pink-500 transition-all" :style="{ width: `${afternoonRatio}%` }" />
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-gray-500 dark:text-gray-400">晚上 18-24点</div>
          <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ eveningRatio }}%</div>
          <div class="mx-auto mt-2 h-1 w-full max-w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div class="h-full rounded-full bg-pink-600 transition-all" :style="{ width: `${eveningRatio}%` }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

