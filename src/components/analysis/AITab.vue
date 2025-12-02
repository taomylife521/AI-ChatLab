<script setup lang="ts">
import { ref } from 'vue'
import ChatExplorer from './ai/ChatExplorer.vue'

// Props
defineProps<{
  sessionId: string
  sessionName: string
  timeFilter?: { startTs: number; endTs: number }
}>()

// 子 Tab 配置
const subTabs = [
  { id: 'chat-explorer', label: '对话式探索', icon: 'i-heroicons-chat-bubble-left-ellipsis' },
  { id: 'lab', label: '实验室', icon: 'i-heroicons-beaker' },
  { id: 'manual', label: '手动分析', icon: 'i-heroicons-adjustments-horizontal' },
]

const activeSubTab = ref('chat-explorer')
</script>

<template>
  <div class="flex h-full flex-col -m-6">
    <!-- 子 Tab 导航 -->
    <div class="border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
      <div class="flex gap-1">
        <button
          v-for="tab in subTabs"
          :key="tab.id"
          class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
          :class="[
            activeSubTab === tab.id
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
          @click="activeSubTab = tab.id"
        >
          <UIcon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 子 Tab 内容 -->
    <div class="flex-1 min-h-0 overflow-hidden p-6">
      <Transition name="fade" mode="out-in">
        <!-- 对话式探索 -->
        <ChatExplorer
          v-if="activeSubTab === 'chat-explorer'"
          class="h-full"
          :session-id="sessionId"
          :session-name="sessionName"
          :time-filter="timeFilter"
        />

        <!-- 实验室 - 暂未实现 -->
        <div
          v-else-if="activeSubTab === 'lab'"
          class="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
        >
          <div class="text-center">
            <UIcon name="i-heroicons-beaker" class="mx-auto h-12 w-12 text-gray-400" />
            <p class="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">实验室功能开发中</p>
            <p class="mt-1 text-xs text-gray-400">敬请期待...</p>
          </div>
        </div>

        <!-- 手动分析 - 暂未实现 -->
        <div
          v-else-if="activeSubTab === 'manual'"
          class="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
        >
          <div class="text-center">
            <UIcon name="i-heroicons-adjustments-horizontal" class="mx-auto h-12 w-12 text-gray-400" />
            <p class="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">手动分析功能开发中</p>
            <p class="mt-1 text-xs text-gray-400">敬请期待...</p>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
