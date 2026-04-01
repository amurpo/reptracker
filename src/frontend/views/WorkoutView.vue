<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api, type SessionData } from '../lib/api'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()

const today = new Date().toISOString().split('T')[0]

const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const todayLabel = (() => {
  const d = new Date().getDay()
  return DAYS_FULL[d === 0 ? 6 : d - 1]
})()

const now = ref(new Date())
let clockInterval: ReturnType<typeof setInterval> | undefined

onUnmounted(() => clearInterval(clockInterval))

const sessionData = ref<SessionData>({ session: null, plan: [], completedSets: [] })
const loading = ref(true)
const togglingSet = ref<string | null>(null)

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

const totalSets = computed(() => sessionData.value.plan.reduce((sum, e) => sum + e.sets, 0))
const completedTotal = computed(() => sessionData.value.completedSets.length)
const progress = computed(() =>
  totalSets.value === 0 ? 0 : Math.round((completedTotal.value / totalSets.value) * 100)
)
const allDone = computed(() => totalSets.value > 0 && completedTotal.value >= totalSets.value)

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
    }
  } finally {
    togglingSet.value = null
  }
}

onMounted(async () => {
  clockInterval = setInterval(() => { now.value = new Date() }, 1000)
  try {
    sessionData.value = await api.sessions.get(today)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-lg lg:max-w-2xl mx-auto">
    <!-- Header -->
    <div class="px-4 pt-6 pb-2">
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <img src="/dumbbell.svg" class="w-5 h-5" alt="" />
          <span class="text-indigo-400 text-sm font-semibold">{{ todayLabel }}</span>
          <span class="text-gray-600 text-sm">{{ preferences.formatDate(today) }}</span>
        </div>
        <span class="text-gray-400 text-sm font-mono">{{ preferences.formatTime(now) }}</span>
      </div>
      <h1 class="text-2xl font-bold">Entrenamiento de hoy</h1>
    </div>

    <!-- Loading spinner -->
    <div v-if="loading" class="flex justify-center py-24">
      <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
        class="mt-6 text-indigo-400 text-sm font-semibold border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-500/10 transition-colors"
      >
        Ir al planificador →
      </RouterLink>
    </div>

    <template v-else>
      <!-- Progress -->
      <div class="px-4 pt-4 pb-2">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-gray-400">{{ completedTotal }}/{{ totalSets }} series</span>
          <span :class="allDone ? 'text-green-400 font-semibold' : 'text-gray-500'">{{ progress }}%</span>
        </div>
        <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="allDone ? 'bg-green-500' : 'bg-indigo-500'"
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
              <p class="text-xs text-gray-500 mt-0.5">{{ entry.sets }} series × {{ entry.reps }} reps</p>
            </div>
            <div class="flex items-center gap-2">
              <span
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
            <button
              v-for="set in entry.sets"
              :key="set"
              @click="toggleSet(entry.id, set)"
              :disabled="togglingSet === `${entry.id}-${set}`"
              class="w-14 h-14 rounded-xl font-bold text-base transition-all active:scale-95 border-2 select-none"
              :class="
                isCompleted(entry.id, set)
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-indigo-500/50 hover:text-gray-200'
              "
            >
              <span v-if="togglingSet !== `${entry.id}-${set}`">{{ set }}</span>
              <span v-else class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
