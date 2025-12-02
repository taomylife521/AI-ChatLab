<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
const props = defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

// Emits
const emit = defineEmits<{
  send: [content: string]
}>()

// 输入内容
const inputValue = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 是否可以发送
const canSend = computed(() => inputValue.value.trim() && !props.disabled)

// 发送消息
function handleSend() {
  if (!canSend.value) return

  emit('send', inputValue.value.trim())
  inputValue.value = ''

  // 重置 textarea 高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
  // Enter 发送（Shift+Enter 换行）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

// 自动调整 textarea 高度
function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = Math.min(target.scrollHeight, 200) + 'px'
}
</script>

<template>
  <div class="border-t border-gray-200 p-4 dark:border-gray-800">
    <div class="mx-auto max-w-2xl">
      <div
        class="flex items-end gap-3 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800"
        :class="[disabled ? 'opacity-60' : '']"
      >
        <!-- 输入框 -->
        <textarea
          ref="textareaRef"
          v-model="inputValue"
          :placeholder="placeholder || '输入你的问题...'"
          :disabled="disabled"
          rows="1"
          class="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-500 outline-none dark:text-white dark:placeholder-gray-400"
          @keydown="handleKeydown"
          @input="handleInput"
        />

        <!-- 发送按钮 -->
        <button
          :disabled="!canSend"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          :class="[
            canSend
              ? 'bg-violet-500 text-white hover:bg-violet-600'
              : 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-700',
          ]"
          @click="handleSend"
        >
          <UIcon name="i-heroicons-paper-airplane" class="h-4 w-4" />
        </button>
      </div>

      <!-- 提示文字 -->
      <div class="mt-2 flex items-center justify-center gap-2">
        <span class="text-xs text-gray-400">
          <kbd class="rounded bg-gray-200 px-1 py-0.5 text-[10px] dark:bg-gray-700">Enter</kbd>
          发送
        </span>
        <span class="text-xs text-gray-400">
          <kbd class="rounded bg-gray-200 px-1 py-0.5 text-[10px] dark:bg-gray-700">Shift + Enter</kbd>
          换行
        </span>
      </div>
    </div>
  </div>
</template>

