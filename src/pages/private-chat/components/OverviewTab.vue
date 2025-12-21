<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AnalysisSession, MessageType } from '@/types/base'
import { getMessageTypeName } from '@/types/base'
import type {
  MemberActivity,
  HourlyActivity,
  DailyActivity,
  WeekdayActivity,
  MonthlyActivity,
} from '@/types/analysis'
import { DoughnutChart } from '@/components/charts'
import type { DoughnutChartData } from '@/components/charts'
import { SectionCard } from '@/components/UI'
import { useOverviewStatistics } from '@/composables/analysis/useOverviewStatistics'
import { useDailyTrend } from '@/composables/analysis/useDailyTrend'
import OverviewStatCards from '@/components/analysis/Overview/OverviewStatCards.vue'
import OverviewIdentityCard from '@/components/analysis/Overview/OverviewIdentityCard.vue'
import ActivityTimeDistribution from '@/components/analysis/Overview/ActivityTimeDistribution.vue'
import DailyTrendCard from '@/components/analysis/Overview/DailyTrendCard.vue'

const props = defineProps<{
  session: AnalysisSession
  memberActivity: MemberActivity[]
  messageTypes: Array<{ type: MessageType; count: number }>
  hourlyActivity: HourlyActivity[]
  dailyActivity: DailyActivity[]
  timeRange: { start: number; end: number } | null
  selectedYear: number | null
  filteredMessageCount: number
  filteredMemberCount: number
  timeFilter?: { startTs?: number; endTs?: number }
}>()

// 星期活跃度数据
const weekdayActivity = ref<WeekdayActivity[]>([])
const isLoadingWeekday = ref(false)

// 使用 Composables
const {
  durationDays,
  dailyAvgMessages,
  totalDurationDays,
  totalDailyAvgMessages,
  imageCount,
  peakHour,
  peakWeekday,
  weekdayNames,
  weekdayVsWeekend,
  peakDay,
  activeDays,
  totalDays,
  activeRate,
  maxConsecutiveDays,
} = useOverviewStatistics(props, weekdayActivity)

const { dailyChartData } = useDailyTrend(props.dailyActivity)

// 消息类型图表数据
const typeChartData = computed<DoughnutChartData>(() => {
  return {
    labels: props.messageTypes.map((t) => getMessageTypeName(t.type)),
    values: props.messageTypes.map((t) => t.count),
  }
})

// 双方消息对比数据
const memberComparisonData = computed(() => {
  if (props.memberActivity.length !== 2) return null

  const sorted = [...props.memberActivity].sort((a, b) => b.messageCount - a.messageCount)
  const total = sorted[0].messageCount + sorted[1].messageCount

  return {
    member1: {
      name: sorted[0].name,
      avatar: sorted[0].avatar,
      count: sorted[0].messageCount,
      percentage: total > 0 ? Math.round((sorted[0].messageCount / total) * 100) : 0,
    },
    member2: {
      name: sorted[1].name,
      avatar: sorted[1].avatar,
      count: sorted[1].messageCount,
      percentage: total > 0 ? Math.round((sorted[1].messageCount / total) * 100) : 0,
    },
    total,
  }
})

// 双方对比图表数据
const comparisonChartData = computed<DoughnutChartData>(() => {
  if (!memberComparisonData.value) {
    return { labels: [], values: [] }
  }
  return {
    labels: [memberComparisonData.value.member1.name, memberComparisonData.value.member2.name],
    values: [memberComparisonData.value.member1.count, memberComparisonData.value.member2.count],
  }
})

// 月份活跃度数据
const monthlyActivity = ref<MonthlyActivity[]>([])
const isLoadingMonthly = ref(false)

// 加载星期活跃度数据
async function loadWeekdayActivity() {
  if (!props.session.id) return
  isLoadingWeekday.value = true
  try {
    weekdayActivity.value = await window.chatApi.getWeekdayActivity(props.session.id, props.timeFilter)
  } catch (error) {
    console.error('加载星期活跃度失败:', error)
  } finally {
    isLoadingWeekday.value = false
  }
}

// 加载月份活跃度数据
async function loadMonthlyActivity() {
  if (!props.session.id) return
  isLoadingMonthly.value = true
  try {
    monthlyActivity.value = await window.chatApi.getMonthlyActivity(props.session.id, props.timeFilter)
  } catch (error) {
    console.error('加载月份活跃度失败:', error)
  } finally {
    isLoadingMonthly.value = false
  }
}

// 监听 session.id 和 timeFilter 变化
watch(
  () => [props.session.id, props.timeFilter],
  () => {
    loadWeekdayActivity()
    loadMonthlyActivity()
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="main-content space-y-6 p-6">
    <!-- 私聊身份卡 -->
    <OverviewIdentityCard
      :session="session"
      :total-duration-days="totalDurationDays"
      :total-daily-avg-messages="totalDailyAvgMessages"
    />

    <!-- 双方消息对比 -->
    <SectionCard v-if="memberComparisonData" title="消息占比" :show-divider="false">
      <div class="p-5">
        <div class="flex items-center gap-8">
          <!-- 左侧成员 -->
          <div class="flex-1 text-center">
            <!-- 头像：优先显示真实头像 -->
            <img
              v-if="memberComparisonData.member1.avatar"
              :src="memberComparisonData.member1.avatar"
              :alt="memberComparisonData.member1.name"
              class="mx-auto h-16 w-16 rounded-full object-cover"
            />
            <div
              v-else
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900/30"
            >
              <span class="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {{ memberComparisonData.member1.name.charAt(0) }}
              </span>
            </div>
            <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {{ memberComparisonData.member1.name }}
            </p>
            <p class="text-2xl font-black text-pink-600 dark:text-pink-400">
              {{ memberComparisonData.member1.percentage }}%
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ memberComparisonData.member1.count.toLocaleString() }} 条
            </p>
          </div>

          <!-- 中间对比条 -->
          <div class="flex-1">
            <div class="relative h-8 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                class="absolute left-0 top-0 h-full rounded-l-full bg-pink-500 transition-all"
                :style="{ width: `${memberComparisonData.member1.percentage}%` }"
              />
              <div
                class="absolute right-0 top-0 h-full rounded-r-full bg-blue-500 transition-all"
                :style="{ width: `${memberComparisonData.member2.percentage}%` }"
              />
            </div>
            <div class="mt-2 flex justify-between text-xs text-gray-500">
              <span>{{ memberComparisonData.member1.percentage }}%</span>
              <span>{{ memberComparisonData.member2.percentage }}%</span>
            </div>
          </div>

          <!-- 右侧成员 -->
          <div class="flex-1 text-center">
            <!-- 头像：优先显示真实头像 -->
            <img
              v-if="memberComparisonData.member2.avatar"
              :src="memberComparisonData.member2.avatar"
              :alt="memberComparisonData.member2.name"
              class="mx-auto h-16 w-16 rounded-full object-cover"
            />
            <div
              v-else
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
            >
              <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {{ memberComparisonData.member2.name.charAt(0) }}
              </span>
            </div>
            <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {{ memberComparisonData.member2.name }}
            </p>
            <p class="text-2xl font-black text-blue-600 dark:text-blue-400">
              {{ memberComparisonData.member2.percentage }}%
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ memberComparisonData.member2.count.toLocaleString() }} 条
            </p>
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- 关键指标卡片 -->
    <OverviewStatCards
      :daily-avg-messages="dailyAvgMessages"
      :duration-days="durationDays"
      :image-count="imageCount"
      :peak-hour="peakHour"
      :peak-weekday="peakWeekday"
      :weekday-names="weekdayNames"
      :weekday-vs-weekend="weekdayVsWeekend"
      :peak-day="peakDay"
      :active-days="activeDays"
      :total-days="totalDays"
      :active-rate="activeRate"
      :max-consecutive-days="maxConsecutiveDays"
    />

    <!-- 图表区域：消息类型 & 双方占比 -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- 消息类型分布 -->
      <SectionCard title="消息类型分布" :show-divider="false">
        <div class="p-5">
          <DoughnutChart :data="typeChartData" :height="256" />
        </div>
      </SectionCard>

      <!-- 双方消息占比饼图 -->
      <SectionCard v-if="memberComparisonData" title="双方消息占比" :show-divider="false">
        <div class="p-5">
          <DoughnutChart :data="comparisonChartData" :height="256" />
        </div>
      </SectionCard>
    </div>

    <!-- 时间分布图表 -->
    <ActivityTimeDistribution
      :hourly-activity="hourlyActivity"
      :weekday-activity="weekdayActivity"
      :monthly-activity="monthlyActivity"
      :is-loading-weekday="isLoadingWeekday"
      :is-loading-monthly="isLoadingMonthly"
      :weekday-names="weekdayNames"
      :weekday-vs-weekend="weekdayVsWeekend"
    />

    <!-- 每日消息趋势 -->
    <DailyTrendCard :daily-activity="dailyActivity" :daily-chart-data="dailyChartData" />
  </div>
</template>
