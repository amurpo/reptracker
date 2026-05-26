<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  src: string | null
  animated?: boolean
  alt?: string
}>()

function secondFrame(url: string): string | null {
  if (url.startsWith('kv:') || url.startsWith('data:')) return null
  if (url.endsWith('_1.jpg')) return null
  return url.replace(/\.jpg$/, '_1.jpg')
}

const frame1Failed = ref(false)
const showFrame1 = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

const frame1 = computed(() => props.src ? secondFrame(props.src) : null)

const displaySrc = computed(() => {
  if (props.animated && showFrame1.value && frame1.value && !frame1Failed.value) {
    return frame1.value
  }
  return props.src
})

function start() {
  if (!frame1.value || frame1Failed.value) return
  interval = setInterval(() => { showFrame1.value = !showFrame1.value }, 700)
}

function stop() {
  if (interval) { clearInterval(interval); interval = null }
  showFrame1.value = false
}

function onError() {
  if (showFrame1.value) {
    frame1Failed.value = true
    stop()
  }
}

watch(() => props.animated, val => { if (val) start(); else stop() }, { immediate: true })
onUnmounted(stop)
</script>

<template>
  <img v-if="displaySrc" v-bind="$attrs" :src="displaySrc" :alt="alt ?? ''" @error="onError" />
  <slot v-else name="placeholder" />
</template>
