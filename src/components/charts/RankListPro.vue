<script setup lang="ts">
import { computed, ref } from 'vue'
import RankList from './RankList.vue'
import type { RankItem } from './RankList.vue'

interface Props {
  /** 完整的排行数据 */
  members: RankItem[]
  /** 标题 */
  title: string
  /** 描述（可选） */
  description?: string
  /** 默认显示数量，默认 10 */
  topN?: number
  /** 单位名称，默认"条" */
  unit?: string
}

const props = withDefaults(defineProps<Props>(), {
  topN: 10,
  unit: '条',
})

// 控制弹窗
const isOpen = ref(false)

// Top N 数据
const topNData = computed(() => {
  return props.members.slice(0, props.topN)
})

// 是否显示"查看完整"按钮
const showViewAll = computed(() => {
  return props.members.length > props.topN
})
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
        <p v-if="description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
      </div>

      <!-- 完整排行榜 Dialog -->
      <UModal v-model:open="isOpen" :ui="{ content: 'md:w-full max-w-3xl' }">
        <UButton v-if="showViewAll" icon="i-heroicons-list-bullet" color="gray" variant="ghost">查看完整排行</UButton>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
            <span class="text-sm text-gray-500">（共 {{ members.length }} 位成员）</span>
          </div>
        </template>
        <template #body>
          <div class="max-h-[60vh] overflow-y-auto">
            <RankList :members="members" :unit="unit" />
          </div>
        </template>
      </UModal>
    </div>

    <RankList :members="topNData" :unit="unit" />
  </div>
</template>
