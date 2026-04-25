<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api, type SessionData } from '../lib/api'
import { usePreferencesStore } from '../stores/preferences'
import { formatTime } from '../lib/formatters'
import RestTimer from '../components/RestTimer.vue'
import type { SoundId } from '../lib/sounds'

const preferences = usePreferencesStore()

const _now = new Date()
const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`

const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

const todayLabel = (() => {
  const d = new Date().getDay()
  return DAYS_FULL[d === 0 ? 6 : d - 1]
})()

const todayLong = (() => {
  const d = new Date()
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} · ${d.getFullYear()}`
})()

const now = ref(_now)
let clockInterval: ReturnType<typeof setInterval> | undefined
let syncInterval: ReturnType<typeof setInterval> | undefined

async function syncSession() {
  if (togglingSet.value) return
  try {
    sessionData.value = await api.sessions.get(today, today)
  } catch { /* silencioso */ }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') syncSession()
}

onUnmounted(() => {
  clearInterval(clockInterval)
  clearInterval(syncInterval)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

const sessionData = ref<SessionData>({ session: null, plan: [], completedSets: [] })
const loading = ref(true)
const togglingSet = ref<string | null>(null)

const timerActive = ref(false)
const timerSeconds = computed(() => preferences.restTimerSeconds)
const timerSound = computed(() => preferences.restTimerSound as SoundId)
const timerRepeat = computed(() => preferences.restTimerRepeat)

function isCompleted(weeklyPlanId: number, setNumber: number): boolean {
  return sessionData.value.completedSets.some(
    (s) => s.weeklyPlanId === weeklyPlanId && s.setNumber === setNumber
  )
}

function completedCount(weeklyPlanId: number, totalSets: number): number {
  let count = 0
  for (let i = 1; i <= totalSets; i++) {
    if (isCompleted(weeklyPlanId, i)) count++
  }
  return count
}

// "13:28:53" → "13:28" / "01:28:53 PM" → "01:28 PM"
const timeMain = computed(() => {
  const full = formatTime(now.value, preferences.timeFormat)
  const parts = full.split(':')
  const ampm = full.includes('AM') ? ' AM' : full.includes('PM') ? ' PM' : ''
  return `${parts[0]}:${parts[1]}${ampm}`
})

const totalSets = computed(() => sessionData.value.plan.filter(e => !e.isCardio).reduce((sum, e) => sum + e.sets, 0))
const totalCardio = computed(() => sessionData.value.plan.filter(e => e.isCardio).length)
const totalCardioMin = computed(() => sessionData.value.plan.filter(e => e.isCardio).reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0))
const completedSets = computed(() => sessionData.value.completedSets.filter(s =>
  sessionData.value.plan.find(e => e.id === s.weeklyPlanId && !e.isCardio)
).length)
const completedCardio = computed(() => sessionData.value.completedSets.filter(s =>
  sessionData.value.plan.find(e => e.id === s.weeklyPlanId && e.isCardio)
).length)
const progress = computed(() => {
  const total = totalSets.value + totalCardio.value
  return total === 0 ? 0 : Math.round((completedSets.value + completedCardio.value) / total * 100)
})
const allDone = computed(() => {
  const total = totalSets.value + totalCardio.value
  return total > 0 && completedSets.value >= totalSets.value && completedCardio.value >= totalCardio.value
})

async function toggleSet(weeklyPlanId: number, setNumber: number) {
  const key = `${weeklyPlanId}-${setNumber}`
  if (togglingSet.value === key) return
  togglingSet.value = key

  try {
    if (isCompleted(weeklyPlanId, setNumber)) {
      await api.sessions.uncomplete(today, weeklyPlanId, setNumber)
      sessionData.value.completedSets = sessionData.value.completedSets.filter(
        (s) => !(s.weeklyPlanId === weeklyPlanId && s.setNumber === setNumber)
      )
    } else {
      await api.sessions.complete(today, weeklyPlanId, setNumber)
      sessionData.value.completedSets.push({
        id: Date.now(),
        sessionId: sessionData.value.session?.id ?? 0,
        weeklyPlanId,
        setNumber,
        completedAt: new Date().toISOString(),
      })
      const entry = sessionData.value.plan.find(e => e.id === weeklyPlanId)
      if (!entry?.isCardio && timerSeconds.value > 0) timerActive.value = true
    }
  } finally {
    togglingSet.value = null
  }
}

onMounted(async () => {
  clockInterval = setInterval(() => { now.value = new Date() }, 1000)
  syncInterval = setInterval(syncSession, 30_000)
  document.addEventListener('visibilitychange', onVisibilityChange)
  try {
    sessionData.value = await api.sessions.get(today, today)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <RestTimer
    v-if="timerActive"
    :seconds="timerSeconds"
    :sound="timerSound"
    :repeat="timerRepeat"
    @done="timerActive = false"
    @skip="timerActive = false"
  />
  <div class="max-w-lg lg:max-w-2xl mx-auto">
    <!-- Header -->
    <div class="px-4 pt-6 pb-2">
      <div class="flex items-start justify-between gap-4 mb-3">
        <!-- Fecha -->
        <div>
          <p class="text-accent-400 text-lg font-bold leading-tight">{{ todayLabel }}</p>
          <p class="text-gray-500 text-sm mt-0.5">{{ todayLong }}</p>
        </div>
        <!-- Hora -->
        <div class="text-right shrink-0">
          <p class="font-mono font-semibold text-white text-lg leading-tight">{{ timeMain }}</p>
        </div>
      </div>
      <h1 class="text-2xl font-bold">Entrenamiento de hoy</h1>
    </div>

    <!-- Loading spinner -->
    <div v-if="loading" class="flex justify-center py-24">
      <div class="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Rest day -->
    <div v-else-if="sessionData.plan.length === 0" class="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div class="text-6xl mb-4">😴</div>
      <h2 class="text-xl font-bold text-gray-300">Día de descanso</h2>
      <p class="text-gray-600 mt-2 text-sm max-w-xs">
        No hay ejercicios planificados para hoy. ¡Descansa y vuelve mañana!
      </p>
      <RouterLink
        to="/plan"
        class="mt-6 text-accent-400 text-sm font-semibold border border-accent-500/30 px-4 py-2 rounded-xl hover:bg-accent-500/10 transition-colors"
      >
        Ir al planificador →
      </RouterLink>
    </div>

    <template v-else>
      <!-- Progress -->
      <div class="px-4 pt-4 pb-2">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-gray-400">
            <template v-if="totalSets > 0">{{ completedSets }}/{{ totalSets }} series</template>
            <template v-if="totalSets > 0 && totalCardio > 0"> · </template>
            <template v-if="totalCardio > 0">{{ totalCardioMin }} min cardio</template>
          </span>
          <span :class="allDone ? 'text-green-400 font-semibold' : 'text-gray-500'">{{ progress }}%</span>
        </div>
        <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="allDone ? 'bg-green-500' : 'bg-accent-500'"
            :style="{ width: progress + '%' }"
          />
        </div>

        <!-- Completion banner -->
        <Transition
          enter-active-class="transition-all duration-300"
          enter-from-class="opacity-0 scale-95"
          leave-active-class="transition-all duration-200"
          leave-to-class="opacity-0 scale-95"
        >
          <div v-if="allDone" class="mt-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 text-center">
            <p class="text-green-400 font-semibold text-sm">¡Entrenamiento completado! 🎉</p>
          </div>
        </Transition>
      </div>

      <!-- Exercise cards -->
      <div class="px-4 pb-4 space-y-4 mt-2">
        <div
          v-for="entry in sessionData.plan"
          :key="entry.id"
          class="bg-gray-900 rounded-2xl border overflow-hidden transition-colors"
          :class="completedCount(entry.id, entry.sets) === entry.sets ? 'border-green-500/20' : 'border-gray-800'"
        >
          <!-- Exercise header -->
          <div class="flex items-center justify-between px-4 py-3.5 border-b border-gray-800/60">
            <div>
              <p class="font-bold text-white">{{ entry.exerciseName }}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                <template v-if="entry.isCardio">{{ entry.durationMinutes }} min</template>
                <template v-else-if="entry.repsConfig">{{ entry.repsConfig.join('-') }} reps<span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span></template>
                <template v-else>{{ entry.sets }}×{{ entry.reps }} reps<span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span></template>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span
                v-if="!entry.isCardio"
                class="text-sm font-bold"
                :class="completedCount(entry.id, entry.sets) === entry.sets ? 'text-green-400' : 'text-gray-400'"
              >
                {{ completedCount(entry.id, entry.sets) }}/{{ entry.sets }}
              </span>
              <div v-if="completedCount(entry.id, entry.sets) === entry.sets" class="text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- Set buttons -->
          <div class="flex flex-wrap gap-2.5 p-3.5">
            <!-- Cardio: botón ancho de completado -->
            <template v-if="entry.isCardio">
              <button
                :disabled="togglingSet === `${entry.id}-1`"
                class="flex-1 h-12 rounded-xl font-semibold text-sm transition-all active:scale-95 border-2 select-none flex items-center justify-center gap-2"
                :class="
                  isCompleted(entry.id, 1)
                    ? 'bg-accent-600 border-accent-500 text-white shadow-lg shadow-accent-500/20'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-accent-500/50 hover:text-gray-200'
                "
                @click="toggleSet(entry.id, 1)"
              >
                <span v-if="togglingSet !== `${entry.id}-1`">
                  <span v-if="isCompleted(entry.id, 1)">✓ Completado</span>
                  <span v-else>Marcar como completado</span>
                </span>
                <span v-else class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </button>
            </template>
            <!-- Fuerza: botones por serie -->
            <template v-else>
              <button
                v-for="set in entry.sets"
                :key="set"
                :disabled="togglingSet === `${entry.id}-${set}`"
                class="w-14 h-14 rounded-xl font-bold text-base transition-all active:scale-95 border-2 select-none flex flex-col items-center justify-center gap-0.5"
                :class="
                  isCompleted(entry.id, set)
                    ? 'bg-accent-600 border-accent-500 text-white shadow-lg shadow-accent-500/20'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-accent-500/50 hover:text-gray-200'
                "
                @click="toggleSet(entry.id, set)"
              >
                <template v-if="togglingSet !== `${entry.id}-${set}`">
                  <span class="text-base font-bold leading-none">{{ set }}</span>
                  <span v-if="entry.repsConfig" class="text-[10px] font-normal leading-none opacity-80">
                    {{ entry.repsConfig[set - 1] }}
                  </span>
                </template>
                <span v-else class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
