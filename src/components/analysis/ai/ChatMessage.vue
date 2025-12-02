<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import MarkdownIt from 'markdown-it'

// Props
const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
}>()

// 格式化时间
const formattedTime = computed(() => {
  return dayjs(props.timestamp).format('HH:mm')
})

// 是否是用户消息
const isUser = computed(() => props.role === 'user')

// 创建 markdown-it 实例
const md = new MarkdownIt({
  html: false, // 禁用 HTML 标签
  breaks: true, // 将换行转为 <br>
  linkify: true, // 自动将 URL 转为链接
  typographer: true, // 启用排版优化
})

// 渲染后的 HTML
const renderedContent = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})
</script>

<template>
  <div class="flex items-start gap-3" :class="[isUser ? 'flex-row-reverse' : '']">
    <!-- 头像 -->
    <div
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="[
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
          : 'bg-gradient-to-br from-violet-500 to-purple-600',
      ]"
    >
      <UIcon
        :name="isUser ? 'i-heroicons-user' : 'i-heroicons-sparkles'"
        class="h-4 w-4 text-white"
      />
    </div>

    <!-- 消息内容 -->
    <div class="max-w-[80%] min-w-0">
      <div
        class="rounded-2xl px-4 py-3"
        :class="[
          isUser
            ? 'rounded-tr-sm bg-blue-500 text-white'
            : 'rounded-tl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
        ]"
      >
        <!-- 消息内容 -->
        <div
          class="prose prose-sm max-w-none leading-relaxed"
          :class="[isUser ? 'prose-invert' : 'dark:prose-invert']"
          v-html="renderedContent"
        />

        <!-- 流式输出光标 -->
        <span
          v-if="isStreaming"
          class="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-500"
        />
      </div>

      <!-- 时间戳 -->
      <div class="mt-1 px-1" :class="[isUser ? 'text-right' : '']">
        <span class="text-xs text-gray-400">{{ formattedTime }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown 渲染样式 */
.prose :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

.prose :deep(p:first-child) {
  margin-top: 0;
}

.prose :deep(p:last-child) {
  margin-bottom: 0;
}

/* 标题 */
.prose :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1em 0 0.5em;
  line-height: 1.3;
}

.prose :deep(h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.875em 0 0.5em;
  line-height: 1.4;
}

.prose :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75em 0 0.375em;
  line-height: 1.4;
}

.prose :deep(h1:first-child),
.prose :deep(h2:first-child),
.prose :deep(h3:first-child) {
  margin-top: 0;
}

/* 列表 */
.prose :deep(ul),
.prose :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.prose :deep(ul) {
  list-style-type: disc;
}

.prose :deep(ol) {
  list-style-type: decimal;
}

.prose :deep(li) {
  margin: 0.25em 0;
  line-height: 1.5;
}

.prose :deep(li > p) {
  margin: 0.25em 0;
}

/* 嵌套列表 */
.prose :deep(ul ul),
.prose :deep(ol ol),
.prose :deep(ul ol),
.prose :deep(ol ul) {
  margin: 0.25em 0;
}

/* 代码 */
.prose :deep(code) {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
  padding: 0.15em 0.4em;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.08);
}

.dark .prose :deep(code) {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 代码块 */
.prose :deep(pre) {
  margin: 0.75em 0;
  padding: 0.875em 1em;
  border-radius: 0.5rem;
  background-color: #1e293b;
  overflow-x: auto;
}

.prose :deep(pre code) {
  padding: 0;
  background: none;
  color: #e2e8f0;
  font-size: 0.8125rem;
  line-height: 1.6;
}

/* 引用块 */
.prose :deep(blockquote) {
  margin: 0.75em 0;
  padding: 0.5em 0 0.5em 1em;
  border-left: 3px solid #8b5cf6;
  background-color: rgba(139, 92, 246, 0.05);
  border-radius: 0 0.25rem 0.25rem 0;
}

.prose :deep(blockquote p) {
  margin: 0;
  color: #6b7280;
}

.dark .prose :deep(blockquote p) {
  color: #9ca3af;
}

/* 链接 */
.prose :deep(a) {
  color: #8b5cf6;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose :deep(a:hover) {
  color: #7c3aed;
}

/* 分割线 */
.prose :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.dark .prose :deep(hr) {
  border-top-color: #374151;
}

/* 加粗和斜体 */
.prose :deep(strong) {
  font-weight: 600;
}

.prose :deep(em) {
  font-style: italic;
}

/* 表格 */
.prose :deep(table) {
  width: 100%;
  margin: 0.75em 0;
  border-collapse: collapse;
  font-size: 0.875em;
}

.prose :deep(th),
.prose :deep(td) {
  padding: 0.5em 0.75em;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.dark .prose :deep(th),
.dark .prose :deep(td) {
  border-color: #374151;
}

.prose :deep(th) {
  background-color: #f9fafb;
  font-weight: 600;
}

.dark .prose :deep(th) {
  background-color: #1f2937;
}

/* 用户消息中的样式调整 */
.prose-invert :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
}

.prose-invert :deep(a) {
  color: #c4b5fd;
}

.prose-invert :deep(a:hover) {
  color: #ddd6fe;
}

.prose-invert :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.1);
}

.prose-invert :deep(blockquote p) {
  color: rgba(255, 255, 255, 0.8);
}
</style>

