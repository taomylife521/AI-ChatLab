<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import ConversationList from './ConversationList.vue'
import DataSourcePanel from './DataSourcePanel.vue'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import AIConfigModal from './AIConfigModal.vue'
import { useAIChat } from '@/composables/useAIChat'

// Props
const props = defineProps<{
  sessionId: string
  sessionName: string
  timeFilter?: { startTs: number; endTs: number }
}>()

// 使用 AI 对话 Composable
const {
  messages,
  sourceMessages,
  currentKeywords,
  isLoadingSource,
  isAIThinking,
  currentConversationId,
  sendMessage,
  loadConversation,
  startNewConversation,
  loadMoreSourceMessages,
  updateMaxMessages,
} = useAIChat(props.sessionId, props.timeFilter)

// UI 状态
const showConfigModal = ref(false)
const isSourcePanelCollapsed = ref(false)
const hasLLMConfig = ref(false)
const isCheckingConfig = ref(true)
const messagesContainer = ref<HTMLElement | null>(null)
const conversationListRef = ref<InstanceType<typeof ConversationList> | null>(null)

// 检查 LLM 配置
async function checkLLMConfig() {
  isCheckingConfig.value = true
  try {
    hasLLMConfig.value = await window.llmApi.hasConfig()
  } catch (error) {
    console.error('检查 LLM 配置失败：', error)
    hasLLMConfig.value = false
  } finally {
    isCheckingConfig.value = false
  }
}

// 配置保存后的回调
async function handleConfigSaved() {
  hasLLMConfig.value = true
  await updateMaxMessages()

  // 更新欢迎消息
  const welcomeMsg = messages.value.find((m) => m.id.startsWith('welcome'))
  if (welcomeMsg) {
    welcomeMsg.content = generateWelcomeMessage()
  }
}

// 生成欢迎消息
function generateWelcomeMessage() {
  const configHint = hasLLMConfig.value
    ? '✅ AI 服务已配置，可以开始对话了！'
    : '**注意**：使用前请先点击右上角「配置」按钮配置 AI 服务 👆'

  return `👋 你好！我是 AI 助手，可以帮你探索「${props.sessionName}」的聊天记录。

你可以这样问我：
- "帮我找一下群里讨论买房的记录"
- "大家最近聊了什么有趣的话题"
- "谁是群里最活跃的人"

${configHint}`
}

// 发送消息
async function handleSend(content: string) {
  await sendMessage(content)
  // 滚动到底部
  scrollToBottom()
  // 刷新对话列表
  conversationListRef.value?.refresh()
}

// 滚动到底部
function scrollToBottom() {
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 100)
}

// 切换数据源面板
function toggleSourcePanel() {
  isSourcePanelCollapsed.value = !isSourcePanelCollapsed.value
}

// 加载更多数据源
async function handleLoadMore() {
  await loadMoreSourceMessages()
}

// 选择对话
async function handleSelectConversation(convId: string) {
  await loadConversation(convId)
  scrollToBottom()
}

// 创建新对话
function handleCreateConversation() {
  startNewConversation(generateWelcomeMessage())
}

// 删除对话
function handleDeleteConversation(convId: string) {
  // 如果删除的是当前对话，创建新对话
  if (currentConversationId.value === convId) {
    startNewConversation(generateWelcomeMessage())
  }
}

// 初始化
onMounted(async () => {
  await checkLLMConfig()
  await updateMaxMessages()

  // 初始化欢迎消息
  startNewConversation(generateWelcomeMessage())
})

// 监听消息变化，自动滚动
watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  }
)

// 监听 AI 响应流式更新
watch(
  () => messages.value[messages.value.length - 1]?.content,
  () => {
    scrollToBottom()
  }
)
</script>

<template>
  <div class="flex h-full gap-4 overflow-hidden">
    <!-- 左侧：对话记录列表 -->
    <ConversationList
      ref="conversationListRef"
      :session-id="sessionId"
      :active-id="currentConversationId"
      @select="handleSelectConversation"
      @create="handleCreateConversation"
      @delete="handleDeleteConversation"
    />

    <!-- 中间：对话区域 -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
      <!-- 对话区域头部 -->
      <div
        class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-violet-500" />
          <span class="font-medium text-gray-900 dark:text-white">AI 对话探索</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- 配置状态指示 -->
          <div
            v-if="!isCheckingConfig"
            class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            :class="[
              hasLLMConfig
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            ]"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="[hasLLMConfig ? 'bg-green-500' : 'bg-amber-500']"
            />
            {{ hasLLMConfig ? '已配置' : '未配置' }}
          </div>
          <UButton
            icon="i-heroicons-cog-6-tooth"
            color="gray"
            variant="ghost"
            size="sm"
            @click="showConfigModal = true"
          >
            配置
          </UButton>
        </div>
      </div>

      <!-- 消息列表 -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4">
        <div class="mx-auto max-w-2xl space-y-4">
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :role="msg.role"
            :content="msg.content"
            :timestamp="msg.timestamp"
            :is-streaming="msg.isStreaming"
          />

          <!-- AI 思考中指示器 -->
          <div v-if="isAIThinking && !messages[messages.length - 1]?.isStreaming" class="flex items-start gap-3">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600"
            >
              <UIcon name="i-heroicons-sparkles" class="h-4 w-4 text-white" />
            </div>
            <div
              class="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-gray-800"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {{ isLoadingSource ? '正在搜索相关记录...' : '正在生成回复...' }}
                </span>
                <span class="flex gap-1">
                  <span class="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
                  <span class="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
                  <span class="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <ChatInput :disabled="isAIThinking" @send="handleSend" />
    </div>

    <!-- 右侧：数据源面板（限制高度） -->
    <div class="flex w-80 flex-col gap-4">
      <DataSourcePanel
        :messages="sourceMessages"
        :keywords="currentKeywords"
        :is-loading="isLoadingSource"
        :is-collapsed="isSourcePanelCollapsed"
        class="max-h-[60vh]"
        @toggle="toggleSourcePanel"
        @load-more="handleLoadMore"
      />
    </div>

    <!-- AI 配置弹窗 -->
    <AIConfigModal v-model:open="showConfigModal" @saved="handleConfigSaved" />
  </div>
</template>
