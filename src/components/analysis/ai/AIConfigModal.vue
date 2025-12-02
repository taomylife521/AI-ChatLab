<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

// Props
const props = defineProps<{
  open: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

// 状态
const isLoading = ref(false)
const isValidating = ref(false)
const isSaving = ref(false)
const providers = ref<Array<{
  id: string
  name: string
  description: string
  models: Array<{ id: string; name: string; description?: string }>
}>>([])

// 表单数据
const selectedProvider = ref('')
const apiKey = ref('')
const selectedModel = ref('')
const maxTokens = ref(50)

// 当前配置状态
const hasExistingConfig = ref(false)
const existingConfigDisplay = ref('')

// 验证结果
const validationResult = ref<'idle' | 'valid' | 'invalid'>('idle')
const validationMessage = ref('')

// 当前选中的提供商信息
const currentProvider = computed(() => {
  return providers.value.find((p) => p.id === selectedProvider.value)
})

// 模型选项
const modelOptions = computed(() => {
  if (!currentProvider.value) return []
  return currentProvider.value.models.map((m) => ({
    label: m.name,
    value: m.id,
    description: m.description,
  }))
})

// 是否可以保存
const canSave = computed(() => {
  return selectedProvider.value && apiKey.value && validationResult.value === 'valid'
})

// 加载提供商列表
async function loadProviders() {
  isLoading.value = true
  try {
    providers.value = await window.llmApi.getProviders()
    if (providers.value.length > 0 && !selectedProvider.value) {
      selectedProvider.value = providers.value[0].id
    }
  } catch (error) {
    console.error('加载提供商列表失败：', error)
  } finally {
    isLoading.value = false
  }
}

// 加载当前配置
async function loadCurrentConfig() {
  try {
    const config = await window.llmApi.getConfig()
    if (config && config.apiKeySet) {
      hasExistingConfig.value = true
      existingConfigDisplay.value = config.apiKey
      selectedProvider.value = config.provider
      selectedModel.value = config.model || ''
      maxTokens.value = config.maxTokens || 50
    }
  } catch (error) {
    console.error('加载当前配置失败：', error)
  }
}

// 验证 API Key
async function validateKey() {
  if (!selectedProvider.value || !apiKey.value) {
    validationResult.value = 'idle'
    validationMessage.value = ''
    return
  }

  isValidating.value = true
  validationResult.value = 'idle'

  try {
    const isValid = await window.llmApi.validateApiKey(selectedProvider.value, apiKey.value)
    validationResult.value = isValid ? 'valid' : 'invalid'
    validationMessage.value = isValid ? 'API Key 验证成功' : 'API Key 无效，请检查'
  } catch (error) {
    validationResult.value = 'invalid'
    validationMessage.value = '验证失败：' + String(error)
  } finally {
    isValidating.value = false
  }
}

// 保存配置
async function saveConfig() {
  if (!canSave.value) return

  isSaving.value = true
  try {
    const result = await window.llmApi.saveConfig({
      provider: selectedProvider.value,
      apiKey: apiKey.value,
      model: selectedModel.value || undefined,
      maxTokens: maxTokens.value,
    })

    if (result.success) {
      emit('saved')
      closeModal()
    } else {
      console.error('保存配置失败：', result.error)
    }
  } catch (error) {
    console.error('保存配置失败：', error)
  } finally {
    isSaving.value = false
  }
}

// 删除配置
async function deleteConfig() {
  try {
    await window.llmApi.deleteConfig()
    hasExistingConfig.value = false
    existingConfigDisplay.value = ''
    apiKey.value = ''
    validationResult.value = 'idle'
    validationMessage.value = ''
  } catch (error) {
    console.error('删除配置失败：', error)
  }
}

// 关闭弹窗
function closeModal() {
  emit('update:open', false)
}

// 监听提供商变化，自动选择默认模型
watch(selectedProvider, (newProvider) => {
  const provider = providers.value.find((p) => p.id === newProvider)
  if (provider && provider.models.length > 0) {
    selectedModel.value = provider.models[0].id
  }
  // 重置验证状态
  validationResult.value = 'idle'
  validationMessage.value = ''
})

// 监听 API Key 变化，重置验证状态
watch(apiKey, () => {
  validationResult.value = 'idle'
  validationMessage.value = ''
})

// 监听弹窗打开
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadProviders()
    loadCurrentConfig()
  }
})

onMounted(() => {
  if (props.open) {
    loadProviders()
    loadCurrentConfig()
  }
})
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="p-6">
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">AI 服务配置</h3>

        <!-- 加载中 -->
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-gray-400" />
        </div>

        <!-- 配置表单 -->
        <div v-else class="space-y-4">
          <!-- 已有配置提示 -->
          <div
            v-if="hasExistingConfig"
            class="rounded-lg bg-green-50 p-3 dark:bg-green-900/20"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-green-500" />
                <span class="text-sm text-green-700 dark:text-green-400">
                  已配置 API Key: {{ existingConfigDisplay }}
                </span>
              </div>
              <UButton size="xs" color="error" variant="ghost" @click="deleteConfig">
                删除
              </UButton>
            </div>
          </div>

          <!-- 服务商选择 -->
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              AI 服务商
            </label>
            <USelect
              v-model="selectedProvider"
              :items="providers.map((p) => ({ label: p.name, value: p.id }))"
              placeholder="选择服务商"
            />
            <p v-if="currentProvider" class="mt-1 text-xs text-gray-500">
              {{ currentProvider.description }}
            </p>
          </div>

          <!-- API Key -->
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              API Key
            </label>
            <div class="flex gap-2">
              <UInput
                v-model="apiKey"
                type="password"
                :placeholder="hasExistingConfig ? '输入新的 API Key（留空保持原有）' : '输入你的 API Key'"
                class="flex-1"
              />
              <UButton
                :loading="isValidating"
                :disabled="!apiKey"
                color="gray"
                variant="soft"
                @click="validateKey"
              >
                验证
              </UButton>
            </div>
            <!-- 验证结果 -->
            <div v-if="validationMessage" class="mt-2">
              <div
                v-if="validationResult === 'valid'"
                class="flex items-center gap-1 text-sm text-green-600 dark:text-green-400"
              >
                <UIcon name="i-heroicons-check-circle" class="h-4 w-4" />
                {{ validationMessage }}
              </div>
              <div
                v-else-if="validationResult === 'invalid'"
                class="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
              >
                <UIcon name="i-heroicons-x-circle" class="h-4 w-4" />
                {{ validationMessage }}
              </div>
            </div>
          </div>

          <!-- 模型选择 -->
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              模型
            </label>
            <USelect
              v-model="selectedModel"
              :items="modelOptions"
              placeholder="选择模型"
            />
          </div>

          <!-- 发送条数限制 -->
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              发送条数限制
            </label>
            <UInput v-model.number="maxTokens" type="number" min="10" max="200" />
            <p class="mt-1 text-xs text-gray-500">每次发送给 AI 的最大消息条数（10-200）</p>
          </div>

          <!-- 获取 API Key 链接 -->
          <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              还没有 API Key？前往获取：
            </p>
            <div class="mt-2 flex gap-2">
              <a
                href="https://platform.deepseek.com/"
                target="_blank"
                class="text-sm text-violet-600 hover:underline dark:text-violet-400"
              >
                DeepSeek →
              </a>
              <a
                href="https://dashscope.console.aliyun.com/"
                target="_blank"
                class="text-sm text-violet-600 hover:underline dark:text-violet-400"
              >
                通义千问 →
              </a>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="mt-6 flex justify-end gap-2">
          <UButton color="gray" variant="soft" @click="closeModal">取消</UButton>
          <UButton
            color="primary"
            :disabled="!canSave"
            :loading="isSaving"
            @click="saveConfig"
          >
            保存配置
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

