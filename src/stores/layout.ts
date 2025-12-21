import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatRecordQuery } from '@/types/format'

/**
 * 全局界面状态（侧边栏、弹窗、聊天记录抽屉等）
 */
export const useLayoutStore = defineStore(
  'layout',
  () => {
    const isSidebarCollapsed = ref(false)
    const showSettingModal = ref(false)
    const showScreenCaptureModal = ref(false)
    const screenCaptureImage = ref<string | null>(null)
    const showChatRecordDrawer = ref(false)
    const chatRecordQuery = ref<ChatRecordQuery | null>(null)

    /**
     * 切换侧边栏展开/折叠状态
     */
    function toggleSidebar() {
      isSidebarCollapsed.value = !isSidebarCollapsed.value
    }

    /**
     * 打开截屏预览弹窗
     */
    function openScreenCaptureModal(imageData: string) {
      screenCaptureImage.value = imageData
      showScreenCaptureModal.value = true
    }

    /**
     * 关闭截屏预览弹窗
     */
    function closeScreenCaptureModal() {
      showScreenCaptureModal.value = false
      setTimeout(() => {
        screenCaptureImage.value = null
      }, 300)
    }

    /**
     * 打开聊天记录抽屉并设置查询参数
     */
    function openChatRecordDrawer(query: ChatRecordQuery) {
      chatRecordQuery.value = query
      showChatRecordDrawer.value = true
    }

    /**
     * 关闭聊天记录抽屉并重置查询
     */
    function closeChatRecordDrawer() {
      showChatRecordDrawer.value = false
      setTimeout(() => {
        chatRecordQuery.value = null
      }, 300)
    }

    return {
      isSidebarCollapsed,
      showSettingModal,
      showScreenCaptureModal,
      screenCaptureImage,
      showChatRecordDrawer,
      chatRecordQuery,
      toggleSidebar,
      openScreenCaptureModal,
      closeScreenCaptureModal,
      openChatRecordDrawer,
      closeChatRecordDrawer,
    }
  },
  {
    persist: [
      {
        pick: ['isSidebarCollapsed'],
        storage: sessionStorage,
      },
    ],
  }
)
