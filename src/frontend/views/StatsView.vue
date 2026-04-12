<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { matchStandard, getLevel, LEVEL_COLORS } from '../lib/strengthStandards'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { api } from '../lib/api'
import type { StatsSummary } from '../lib/api'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const stats = ref<StatsSummary | null>(null)
const loading = ref(true)
const error = ref('')
const today = new Date()

// Progresión
const progExercises = ref<{ id: number; name: string; muscleGroup: string }[]>([])
const selectedExId = ref<number | null>(null)
const progData = ref<{ date: string; maxWeightKg: number; estimated1RM: number }[]>([])
const progLoading = ref(false)

onMounted(async () => {
  const month = today.toISOString().slice(0, 7)
  const todayStr = today.toISOString().split('T')[0]

  // Las dos queries son independientes: si una falla no rompe la otra
  const [summaryResult, exercisesResult] = await Promise.allSettled([
    api.stats.summary(month, todayStr),
    api.stats.progressionExercises(),
  ])

  if (summaryResult.status === 'fulfilled') {
    stats.value = summaryResult.value
  } else {
    error.value = (summaryResult.reason as Error).message
  }

  if (exercisesResult.status === 'fulfilled') {
    progExercises.value = exercisesResult.value
    if (exercisesResult.value.length > 0) {
      selectedExId.value = exercisesResult.value[0].id
      await loadProgression(exercisesResult.value[0].id)
    }
  }

  loading.value = false
})

const progError = ref('')

async function loadProgression(exId: number) {
  selectedExId.value = exId
  progLoading.value = true
  progError.value = ''
  try {
    progData.value = await api.stats.progression(exId)
  } catch (e) {
    progError.value = (e as Error).message
    progData.value = []
  } finally {
    progLoading.value = false
  }
}

// Datos de perfil que faltan y afectan los cálculos
const missingProfileFields = computed(() => {
  if (!stats.value) return []
  const missing: string[] = []
  if (!stats.value.weightKg) missing.push('peso')
  if (!stats.value.heightCm) missing.push('altura')
  if (!stats.value.sex)      missing.push('sexo')
  if (!stats.value.age)      missing.push('edad')
  return missing
})

const chartOption = computed(() => {
  const style = getComputedStyle(document.documentElement)
  const raw = style.getPropertyValue('--accent-500').trim()
  const color = raw ? `rgb(${raw})` : '#6366f1'
  const colorA = raw ? `rgba(${raw}, 0.2)` : 'rgba(99,102,241,0.2)'

  const dates = progData.value.map(d => d.date)
  const weights = progData.value.map(d => Math.round(d.estimated1RM * 10) / 10)

  return {
    backgroundColor: 'transparent',
    grid: { left: 44, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) =>
        `${params[0].name}<br/><b>${params[0].value} kg</b>`,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: string) => v.slice(5) },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
    },
    series: [{
      type: 'line',
      data: weights,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: colorA }, { offset: 1, color: 'rgba(0,0,0,0)' }] },
      },
    }],
  }
})

const monthName = computed(() =>
  today.toLocaleString('es', { month: 'long', year: 'numeric' })
)

const bmi = computed(() => {
  const w = stats.value?.weightKg
  const h = stats.value?.heightCm
  if (!w || !h) return null
  const val = w / ((h / 100) ** 2)
  return Math.round(val * 10) / 10
})

const bmiCategory = computed(() => {
  const b = bmi.value
  if (b === null) return null
  if (b < 18.5) return { label: 'Bajo peso', color: 'text-sky-400' }
  if (b < 25)   return { label: 'Normal',    color: 'text-emerald-400' }
  if (b < 30)   return { label: 'Sobrepeso', color: 'text-yellow-400' }
  return               { label: 'Obesidad',  color: 'text-red-400' }
})

const muscleGroupLabel: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  legs: 'Piernas',
  shoulders: 'Hombros',
  arms: 'Brazos',
  core: 'Core',
  cardio: 'Cardio',
  full_body: 'Cuerpo completo',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
}

function mgLabel(mg: string) {
  return muscleGroupLabel[mg] ?? mg
}

const strengthRows = computed(() => {
  const bodyWeight = stats.value?.weightKg
  const sex = stats.value?.sex ?? null
  const age = stats.value?.age ?? null
  return (stats.value?.strengthRatios ?? []).map(ex => {
    const e1rm = Math.round(ex.estimated1RM * 10) / 10
    const ratio = bodyWeight ? Math.round((e1rm / bodyWeight) * 100) / 100 : null
    const stdKey = matchStandard(ex.name)
    const level = (ratio !== null && stdKey) ? getLevel(ratio, stdKey, sex, age) : null
    return { ...ex, e1rm, ratio, level }
  })
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 pb-24">
    <div class="max-w-lg lg:max-w-2xl mx-auto px-4 pt-6">
      <h1 class="text-white text-xl font-bold mb-6">Estadísticas</h1>

      <div v-if="loading" class="flex justify-center pt-16">
        <div class="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <p v-else-if="error" class="text-red-400 text-sm text-center pt-16">{{ error }}</p>

      <template v-else-if="stats">
        <!-- Aviso de perfil incompleto -->
        <div v-if="missingProfileFields.length > 0" class="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-gray-500 text-xs leading-relaxed">
            Completa tu perfil para ver más estadísticas:
            <RouterLink to="/profile" class="text-accent-400 font-medium underline-offset-2 underline">
              {{ missingProfileFields.join(', ') }}
            </RouterLink>
          </p>
        </div>

        <!-- Tarjetas métricas -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <!-- Racha -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4 col-span-2 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-4xl font-bold text-white">{{ stats.streak }}</span>
                <span class="text-gray-500 text-sm">días</span>
              </div>
              <span class="text-gray-400 text-sm">Racha actual</span>
            </div>
            <div v-if="stats.streak >= 3" class="ml-auto text-xs text-accent-400 font-semibold bg-accent-500/10 rounded-full px-3 py-1">
              🔥 En racha
            </div>
          </div>

          <!-- Este mes -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div class="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold text-white mb-0.5">{{ stats.daysThisMonth }}</div>
            <div class="text-gray-400 text-xs">Días este mes</div>
          </div>

          <!-- Series este mes -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div class="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold text-white mb-0.5">{{ stats.setsThisMonth }}</div>
            <div class="text-gray-400 text-xs">Series completadas</div>
          </div>

          <!-- Total histórico -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4 col-span-2 flex items-center justify-between">
            <div>
              <div class="text-gray-400 text-xs mb-1">Total histórico</div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-bold text-white">{{ stats.totalDays }}</span>
                <span class="text-gray-500 text-sm">entrenamientos</span>
              </div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- IMC (solo si hay altura y peso) -->
        <div v-if="bmi !== null" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 col-span-2 flex items-center justify-between">
          <div>
            <div class="text-gray-400 text-xs mb-1">Índice de masa corporal</div>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold text-white">{{ bmi }}</span>
              <span :class="bmiCategory!.color" class="text-sm font-semibold">{{ bmiCategory!.label }}</span>
            </div>
          </div>
          <div class="text-right text-xs text-gray-600">
            <div>{{ stats!.weightKg }} kg</div>
            <div>{{ stats!.heightCm }} cm</div>
          </div>
        </div>

        <!-- Top ejercicios del mes -->
        <div v-if="stats.topExercises.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-3">Top ejercicios — {{ monthName }}</h2>
          <div class="flex flex-col gap-2">
            <div
              v-for="(ex, i) in stats.topExercises"
              :key="ex.name"
              class="flex items-center gap-3"
            >
              <span class="w-5 text-center text-xs font-bold" :class="i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : 'text-gray-600'">
                {{ i + 1 }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-gray-200 text-sm font-medium truncate">{{ ex.name }}</div>
                <div class="text-gray-600 text-xs">{{ mgLabel(ex.muscleGroup) }}</div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-accent-400 font-bold text-sm">{{ ex.sets }}</span>
                <span class="text-gray-600 text-xs">series</span>
              </div>
            </div>
          </div>
        </div>

        <p v-else class="text-gray-600 text-sm text-center pb-4">
          Aún no hay series completadas este mes.
        </p>

        <!-- Máximos estimados por ejercicio -->
        <div v-if="strengthRows.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-1">Máximo estimado por ejercicio</h2>
          <p class="text-gray-600 text-xs mb-4">
            Peso máximo que podrías levantar una sola vez, calculado a partir de tus series registradas.
            <template v-if="stats!.weightKg"> El nivel compara contra estándares para tu peso ({{ stats!.weightKg }} kg).</template>
          </p>
          <div class="flex flex-col gap-3">
            <div v-for="row in strengthRows" :key="row.name" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-gray-200 text-sm font-medium truncate mb-0.5">{{ row.name }}</div>
                <div class="flex items-center gap-1.5">
                  <span class="text-gray-600 text-xs">{{ mgLabel(row.muscleGroup) }}</span>
                  <span
                    v-if="row.level"
                    class="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gray-800"
                    :class="LEVEL_COLORS[row.level]"
                  >{{ row.level }}</span>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-accent-400 font-bold text-sm">{{ row.e1rm }} kg</div>
                <div v-if="row.ratio !== null" class="text-gray-500 text-xs">{{ row.ratio }}× tu peso</div>
              </div>
            </div>
          </div>
          <p v-if="!stats!.weightKg" class="text-gray-600 text-xs mt-3 text-center">
            Agrega tu peso en Perfil para ver el nivel comparativo.
          </p>
        </div>

        <!-- Progresión por ejercicio -->
        <div v-if="progExercises.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-3">Progresión por ejercicio</h2>

          <!-- Selector de ejercicio -->
          <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
            <button
              v-for="ex in progExercises"
              :key="ex.id"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              :class="selectedExId === ex.id
                ? 'bg-accent-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'"
              @click="loadProgression(ex.id)"
            >
              {{ ex.name }}
            </button>
          </div>

          <!-- Gráfico -->
          <div v-if="progLoading" class="flex justify-center py-10">
            <div class="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p v-else-if="progError" class="text-red-400 text-xs text-center py-6">{{ progError }}</p>
          <template v-else-if="progData.length >= 2">
            <VChart :option="chartOption" style="height: 180px; width: 100%;" autoresize />
            <p class="text-gray-600 text-xs mt-2 text-center">Máximo estimado por sesión (kg)</p>
          </template>
          <p v-else class="text-gray-600 text-xs text-center py-6">
            Necesitas al menos 2 sesiones con peso registrado para ver la progresión.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
