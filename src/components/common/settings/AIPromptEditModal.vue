<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PromptPreset } from '@/types/ai'
import {
  getDefaultRoleDefinition,
  getDefaultResponseRules,
  getLockedPromptSectionPreview,
  getOriginalBuiltinPreset,
} from '@/config/prompts'
import { usePromptStore } from '@/stores/prompt'

// Props
const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit'
  preset: PromptPreset | null
  defaultChatType: 'group' | 'private'
}>()

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

// Store
const promptStore = usePromptStore()

// 表单数据
const formData = ref({
  name: '',
  chatType: 'group' as 'group' | 'private',
  roleDefinition: '',
  responseRules: '',
})

// 计算属性
const isBuiltIn = computed(() => props.preset?.isBuiltIn ?? false)
const isEditMode = computed(() => props.mode === 'edit')
const isModified = computed(() => {
  if (!isBuiltIn.value || !props.preset) return false
  return promptStore.isBuiltinPresetModified(props.preset.id)
})

const modalTitle = computed(() => {
  if (isBuiltIn.value) return '编辑系统提示词'
  return isEditMode.value ? '编辑自定义提示词' : '添加自定义提示词'
})

const canSave = computed(() => {
  return formData.value.name.trim() && formData.value.roleDefinition.trim() && formData.value.responseRules.trim()
})

// 监听打开状态，初始化表单
watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      if (props.preset) {
        // 编辑模式：加载现有预设
        formData.value = {
          name: props.preset.name,
          chatType: props.preset.chatType,
          roleDefinition: props.preset.roleDefinition,
          responseRules: props.preset.responseRules,
        }
      } else {
        // 添加模式：重置为默认（根据当前选中的聊天类型）
        formData.value = {
          name: '',
          chatType: props.defaultChatType,
          roleDefinition: getDefaultRoleDefinition(props.defaultChatType),
          responseRules: getDefaultResponseRules(props.defaultChatType),
        }
      }
    }
  }
)

/** 关闭弹窗 */
function closeModal() {
  emit('update:open', false)
}

/** 保存提示词预设 */
function handleSave() {
  if (!canSave.value) return

  if (isEditMode.value && props.preset) {
    // 更新现有预设（支持内置和自定义）
    promptStore.updatePromptPreset(props.preset.id, {
      name: formData.value.name.trim(),
      chatType: formData.value.chatType,
      roleDefinition: formData.value.roleDefinition.trim(),
      responseRules: formData.value.responseRules.trim(),
    })
  } else {
    // 添加新预设
    promptStore.addPromptPreset({
      name: formData.value.name.trim(),
      chatType: formData.value.chatType,
      roleDefinition: formData.value.roleDefinition.trim(),
      responseRules: formData.value.responseRules.trim(),
    })
  }

  emit('saved')
  closeModal()
}

/** 重置内置预设为原始值 */
function handleReset() {
  if (!props.preset || !isBuiltIn.value) return

  const original = getOriginalBuiltinPreset(props.preset.id)
  if (original) {
    // 重置表单为原始值
    formData.value = {
      name: original.name,
      chatType: original.chatType,
      roleDefinition: original.roleDefinition,
      responseRules: original.responseRules,
    }
    // 清除覆盖
    promptStore.resetBuiltinPreset(props.preset.id)
  }
}

// 完整提示词预览
const previewContent = computed(() => {
  const chatType = formData.value.chatType

  // 获取锁定的系统部分（用于预览）
  const lockedSection = getLockedPromptSectionPreview(chatType)

  // 组合完整提示词
  return `${formData.value.roleDefinition}

${lockedSection}

回答要求：
${formData.value.responseRules}`
})
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)" :ui="{ content: 'md:w-full max-w-2xl' }">
    <template #content>
      <div class="p-6">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ modalTitle }}</h2>
          <UButton icon="i-heroicons-x-mark" variant="ghost" size="sm" @click="closeModal" />
        </div>

        <!-- 表单 -->
        <div class="max-h-[500px] space-y-4 overflow-y-auto pr-1">
          <!-- 预设名称 -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">预设名称</label>
            <UInput v-model="formData.name" placeholder="为预设起个名字" class="w-60" />
          </div>

          <!-- 适用类型（只读显示） -->
          <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <UIcon
              :name="formData.chatType === 'group' ? 'i-heroicons-chat-bubble-left-right' : 'i-heroicons-user'"
              class="h-4 w-4"
            />
            <span>适用于{{ formData.chatType === 'group' ? '群聊' : '私聊' }}</span>
          </div>

          <!-- 角色定义 -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">角色定义</label>
            <UTextarea
              v-model="formData.roleDefinition"
              :rows="8"
              placeholder="定义 AI 助手的角色和任务..."
              class="font-mono text-sm w-120"
            />
          </div>

          <!-- 回答要求 -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              回答要求
              <span class="font-normal text-gray-500">（指导 AI 如何回答）</span>
            </label>
            <UTextarea
              v-model="formData.responseRules"
              :rows="5"
              placeholder="定义 AI 回答的格式和要求..."
              class="font-mono text-sm w-120"
            />
          </div>

          <!-- 完整提示词预览 -->
          <div>
            <label class="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <UIcon name="i-heroicons-eye" class="h-4 w-4 text-violet-500" />
              完整提示词预览
            </label>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <pre class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{{ previewContent }}</pre>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-6 flex justify-end gap-2">
          <!-- 内置预设：显示重置按钮 -->
          <UButton v-if="isBuiltIn && isModified" variant="outline" color="warning" @click="handleReset">
            <UIcon name="i-heroicons-arrow-path" class="mr-1 h-4 w-4" />
            重置为默认
          </UButton>
          <UButton variant="ghost" @click="closeModal">取消</UButton>
          <UButton color="primary" :disabled="!canSave" @click="handleSave">
            {{ isEditMode ? '保存修改' : '添加预设' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
