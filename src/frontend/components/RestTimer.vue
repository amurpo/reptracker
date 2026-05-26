<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { playSound, type SoundId } from '../lib/sounds'

const props = defineProps<{
  seconds: number
  sound: SoundId
  repeat?: number
}>()

const emit = defineEmits<{
  done: []
  skip: []
}>()

const CIRCUMFERENCE = 2 * Math.PI * 54
const totalMs = props.seconds * 1000

const elapsed = ref(0)
const finished = ref(false)

const progress = computed(() => elapsed.value / totalMs)
const dashOffset = computed(() => CIRCUMFERENCE * progress.value)
const remaining = computed(() => Math.max(Math.ceil((totalMs - elapsed.value) / 1000), 0))

const lottieSrc = computed(() => {
  const map: Record<string, string> = {
    bear:    '/animations/loading-bear.lottie',
    rooster: '/animations/rooster.lottie',
    bell:    '/animations/bell.lottie',
    beep:    '/animations/robo.lottie',
    chime:   '/animations/notes.lottie',
    airhorn: '/animations/megaphone.lottie',
  }
  return map[props.sound] ?? '/animations/DeadlineLoading.lottie'
})

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : String(s)
}

let rafId: number | null = null
let doneTimeoutId: number | null = null
let startTime = 0
let endTime = 0
let wakeLock: WakeLockSentinel | null = null

async function playSoundRepeated() {
  const times = props.repeat ?? 1
  for (let i = 0; i < times; i++) {
    await playSound(props.sound)
  }
}

function finish() {
  if (finished.value) return
  elapsed.value = totalMs
  finished.value = true
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  if (doneTimeoutId !== null) { clearTimeout(doneTimeoutId); doneTimeoutId = null }
  releaseWakeLock()
  playSoundRepeated()
}

function tick() {
  const now = Date.now()
  elapsed.value = Math.min(now - startTime, totalMs)
  if (now >= endTime) {
    finish()
    return
  }
  rafId = requestAnimationFrame(tick)
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => { wakeLock = null })
    }
  } catch {
    // Permiso denegado o no soportado: se ignora, el visibilitychange cubre el fallback.
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {})
    wakeLock = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Recompute por si el rAF se pausó con la pantalla apagada.
    if (!finished.value) {
      const now = Date.now()
      elapsed.value = Math.min(now - startTime, totalMs)
      if (now >= endTime) {
        finish()
      } else {
        if (rafId !== null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(tick)
        requestWakeLock()
      }
    }
  }
}

onMounted(() => {
  startTime = Date.now()
  endTime = startTime + totalMs
  rafId = requestAnimationFrame(tick)
  // Fallback absoluto: dispara aunque rAF esté pausado en background (sujeto a throttling del navegador).
  doneTimeoutId = window.setTimeout(finish, totalMs)
  document.addEventListener('visibilitychange', onVisibilityChange)
  requestWakeLock()
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (doneTimeoutId !== null) clearTimeout(doneTimeoutId)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  releaseWakeLock()
})

function close() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  if (doneTimeoutId !== null) { clearTimeout(doneTimeoutId); doneTimeoutId = null }
  releaseWakeLock()
  if (finished.value) emit('done'); else emit('skip')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />

    <Transition
      appear
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
    >
      <div class="relative w-full max-w-sm bg-gray-900 rounded-3xl border border-gray-800 px-6 pt-6 pb-6">

        <p class="text-gray-500 text-xs text-center mb-5 tracking-wide uppercase font-medium">
          {{ finished ? '¡Listo!' : 'Descansando' }}
        </p>

        <!-- Contenedor fijo: anillo y lottie se superponen, solo uno visible a la vez -->
        <div class="relative flex items-center justify-center mb-6" style="height: 180px;">
          <!-- Anillo SVG -->
          <div
            class="absolute inset-0 flex items-center justify-center transition-all duration-300"
            :class="finished ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'"
          >
            <div class="relative w-44 h-44">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#1e293b" stroke-width="7" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="rgb(var(--accent-500))"
                  stroke-width="7"
                  stroke-linecap="round"
                  :stroke-dasharray="CIRCUMFERENCE"
                  :stroke-dashoffset="dashOffset"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-5xl font-bold text-white tabular-nums">{{ formatTime(remaining) }}</span>
              </div>
            </div>
          </div>

          <!-- Lottie: siempre montado para precargar, visible al terminar -->
          <div
            class="absolute inset-0 flex items-center justify-center transition-all duration-300"
            :class="finished ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'"
          >
            <DotLottieVue
              :src="lottieSrc"
              autoplay
              loop
              style="width: 180px; height: 180px;"
            />
          </div>
        </div>

        <button
          class="w-full py-3 rounded-2xl border border-gray-700 text-gray-400 text-sm font-medium hover:border-gray-500 hover:text-gray-200 transition-colors"
          @click="close"
        >
          {{ finished ? 'Continuar' : 'Saltar descanso' }}
        </button>
      </div>
    </Transition>
  </div>
</template>
