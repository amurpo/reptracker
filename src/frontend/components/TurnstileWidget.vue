<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const props = defineProps<{
  sitekey: string
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null

function renderWidget() {
  if (!container.value || !window.turnstile) return
  widgetId = window.turnstile.render(container.value, {
    sitekey: props.sitekey,
    theme: 'dark',
    callback: (token: string) => emit('update:modelValue', token),
    'expired-callback': () => emit('update:modelValue', ''),
    'error-callback': () => emit('update:modelValue', ''),
  })
}

onMounted(() => {
  if (window.turnstile) {
    renderWidget()
  } else {
    pollInterval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(pollInterval!)
        pollInterval = null
        renderWidget()
      }
    }, 50)
  }
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
    widgetId = null
  }
})

function reset() {
  if (widgetId && window.turnstile) {
    window.turnstile.reset(widgetId)
    emit('update:modelValue', '')
  }
}

defineExpose({ reset })
</script>

<template>
  <div ref="container" />
</template>
