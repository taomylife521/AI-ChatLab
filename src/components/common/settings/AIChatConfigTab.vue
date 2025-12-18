<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePromptStore } from '@/stores/prompt'

// Store
const promptStore = usePromptStore()
const { aiGlobalSettings } = storeToRefs(promptStore)

// Emits
const emit = defineEmits<{
  'config-changed': []
}>()

// 发送条数限制
const globalMaxMessages = computed({
  get: () => aiGlobalSettings.value.maxMessagesPerRequest,
  set: (val: number) => {
    const clampedVal = Math.max(100, Math.min(5000, val || 100))
    promptStore.updateAIGlobalSettings({ maxMessagesPerRequest: clampedVal })
    emit('config-changed')
  },
})
</script>

<template>
  <div class="space-y-6">
    <!-- 发送条数限制 -->
    <div>
      <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="h-4 w-4 text-violet-500" />
        对话设置
      </h4>
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <div class="flex items-center justify-between">
          <div class="flex-1 pr-4">
            <p class="text-sm font-medium text-gray-900 dark:text-white">发送条数限制</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              每次发送给 AI 的最大消息条数，用于控制上下文长度（100-5000）
            </p>
          </div>
          <UInput v-model.number="globalMaxMessages" type="number" min="10" max="5000" class="w-24" />
        </div>
      </div>
    </div>

    <!-- 更多设置占位 -->
    <div>
      <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <UIcon name="i-heroicons-adjustments-horizontal" class="h-4 w-4 text-blue-500" />
        更多设置
      </h4>
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p class="text-sm text-gray-500 dark:text-gray-400">更多聊天相关设置即将推出...</p>
      </div>
    </div>
  </div>
</template>
