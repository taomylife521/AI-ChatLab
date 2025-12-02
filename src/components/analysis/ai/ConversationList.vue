<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import dayjs from 'dayjs'

interface Conversation {
  id: string
  sessionId: string
  title: string | null
  createdAt: number
  updatedAt: number
}

// Props
const props = defineProps<{
  sessionId: string
  activeId: string | null
}>()

// Emits
const emit = defineEmits<{
  select: [id: string]
  create: []
  delete: [id: string]
}>()

// State
const conversations = ref<Conversation[]>([])
const isLoading = ref(false)
const editingId = ref<string | null>(null)
const editingTitle = ref('')

// 加载对话列表
async function loadConversations() {
  isLoading.value = true
  try {
    conversations.value = await window.aiApi.getConversations(props.sessionId)
  } catch (error) {
    console.error('加载对话列表失败：', error)
  } finally {
    isLoading.value = false
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const now = dayjs()
  const date = dayjs(timestamp)

  if (now.diff(date, 'day') === 0) {
    return date.format('HH:mm')
  } else if (now.diff(date, 'day') < 7) {
    return date.format('ddd HH:mm')
  } else {
    return date.format('MM-DD')
  }
}

// 获取对话标题
function getTitle(conv: Conversation): string {
  return conv.title || '新对话'
}

// 开始编辑标题
function startEditing(conv: Conversation) {
  editingId.value = conv.id
  editingTitle.value = conv.title || ''
}

// 保存标题
async function saveTitle(convId: string) {
  if (editingTitle.value.trim()) {
    try {
      await window.aiApi.updateConversationTitle(convId, editingTitle.value.trim())
      const conv = conversations.value.find((c) => c.id === convId)
      if (conv) {
        conv.title = editingTitle.value.trim()
      }
    } catch (error) {
      console.error('更新标题失败：', error)
    }
  }
  editingId.value = null
}

// 删除对话
async function handleDelete(convId: string) {
  try {
    await window.aiApi.deleteConversation(convId)
    conversations.value = conversations.value.filter((c) => c.id !== convId)
    emit('delete', convId)
  } catch (error) {
    console.error('删除对话失败：', error)
  }
}

// 初始化
onMounted(() => {
  loadConversations()
})

// 监听 sessionId 变化
watch(
  () => props.sessionId,
  () => {
    loadConversations()
  }
)

// 暴露刷新方法
defineExpose({
  refresh: loadConversations,
})
</script>

<template>
  <div class="flex h-full w-48 flex-col rounded-xl bg-white shadow-sm dark:bg-gray-900">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="h-5 w-5 text-gray-500" />
        <span class="font-medium text-gray-900 dark:text-white">对话记录</span>
      </div>
      <UButton icon="i-heroicons-plus" color="primary" variant="soft" size="xs" @click="emit('create')">新对话</UButton>
    </div>

    <!-- 对话列表 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 加载中 -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
      </div>

      <!-- 空状态 -->
      <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
        <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p class="mt-2 text-sm text-gray-500">暂无对话</p>
        <p class="text-xs text-gray-400">点击"新对话"开始</p>
      </div>

      <!-- 对话列表 -->
      <div v-else class="p-2 space-y-1">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="group relative rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
          :class="[
            activeId === conv.id ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
          ]"
          @click="emit('select', conv.id)"
        >
          <!-- 编辑模式 -->
          <template v-if="editingId === conv.id">
            <input
              v-model="editingTitle"
              class="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              placeholder="输入标题..."
              @blur="saveTitle(conv.id)"
              @keyup.enter="saveTitle(conv.id)"
              @click.stop
            />
          </template>

          <!-- 正常模式 -->
          <template v-else>
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium"
                  :class="[
                    activeId === conv.id ? 'text-violet-700 dark:text-violet-400' : 'text-gray-900 dark:text-white',
                  ]"
                >
                  {{ getTitle(conv) }}
                </p>
                <p class="mt-0.5 text-xs text-gray-400">
                  {{ formatTime(conv.updatedAt) }}
                </p>
              </div>

              <!-- 操作按钮 -->
              <div
                class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                @click.stop
              >
                <UButton
                  icon="i-heroicons-pencil"
                  color="gray"
                  variant="ghost"
                  size="2xs"
                  @click="startEditing(conv)"
                />
                <UButton
                  icon="i-heroicons-trash"
                  color="red"
                  variant="ghost"
                  size="2xs"
                  @click="handleDelete(conv.id)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
