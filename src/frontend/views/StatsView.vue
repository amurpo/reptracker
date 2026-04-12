<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { matchStandard, getLevel, LEVEL_COLORS } from '../lib/strengthStandards'
import { use } from 'echarts/core'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { api } from '../lib/api'
import type { StatsSummary } from '../lib/api'

use([LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const stats = ref<StatsSummary | null>(null)
const loading = ref(true)
const error = ref('')
const today = new Date()

// Progresión
const progExercises = ref<{ id: number; name: string; muscleGroup: string }[]>([])
const selectedExId = ref<number | null>(null)
const progData = ref<{ date: string; maxWeightKg: number; estimated1RM: number }[]>([])
const progLoading = ref(false)
const progError = ref('')

onMounted(async () => {
  const month = today.toISOString().slice(0, 7)
  const todayStr = today.toISOString().split('T')[0]

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const muscleGroupLabel: Record<string, string> = {
  chest:      'Pecho',
  back:       'Espalda',
  legs:       'Piernas',
  shoulders:  'Hombros',
  arms:       'Brazos',
  core:       'Core',
  cardio:     'Cardio',
  full_body:  'Cuerpo completo',
  glutes:     'Glúteos',
  calves:     'Pantorrillas',
}

function mgLabel(mg: string) {
  return muscleGroupLabel[mg] ?? mg
}

const MG_COLORS: Record<string, string> = {
  // English keys
  chest:     '#f97316',
  back:      '#3b82f6',
  legs:      '#a855f7',
  shoulders: '#22c55e',
  arms:      '#eab308',
  core:      '#ec4899',
  cardio:    '#14b8a6',
  full_body: '#6366f1',
  glutes:    '#f43f5e',
  calves:    '#84cc16',
  // Spanish keys (DB)
  pecho:              '#f97316',
  espalda:            '#3b82f6',
  'espalda media':    '#3b82f6',
  'espalda alta':     '#60a5fa',
  lumbar:             '#6366f1',
  piernas:            '#a855f7',
  'cuádriceps':       '#a855f7',
  cuadriceps:         '#a855f7',
  isquiotibiales:     '#7c3aed',
  hombros:            '#22c55e',
  brazos:             '#eab308',
  'bíceps':           '#eab308',
  biceps:             '#eab308',
  'tríceps':          '#f59e0b',
  triceps:            '#f59e0b',
  antebrazos:         '#d97706',
  abdominales:        '#ec4899',
  gluteos:            '#f43f5e',
  'glúteos':          '#f43f5e',
  pantorrillas:       '#84cc16',
  'cuerpo completo':  '#6366f1',
}

function getAccentColor() {
  const style = getComputedStyle(document.documentElement)
  const raw = style.getPropertyValue('--accent-500').trim()
  // La variable CSS usa espacios: "99 102 241" — ECharts requiere comas
  const csv = raw.replace(/\s+/g, ', ')
  return {
    solid:   csv ? `rgb(${csv})` : '#6366f1',
    alpha20: csv ? `rgba(${csv}, 0.2)` : 'rgba(99, 102, 241, 0.2)',
  }
}

// ─── Computed ────────────────────────────────────────────────────────────────

const missingProfileFields = computed(() => {
  if (!stats.value) return []
  const missing: string[] = []
  if (!stats.value.weightKg) missing.push('peso')
  if (!stats.value.heightCm) missing.push('altura')
  if (!stats.value.sex)      missing.push('sexo')
  if (!stats.value.age)      missing.push('edad')
  return missing
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
  if (b < 18.5) return { label: 'Bajo peso', color: 'text-sky-400',    bar: 'bg-sky-500' }
  if (b < 25)   return { label: 'Normal',    color: 'text-emerald-400', bar: 'bg-emerald-500' }
  if (b < 30)   return { label: 'Sobrepeso', color: 'text-yellow-400',  bar: 'bg-yellow-500' }
  return               { label: 'Obesidad',  color: 'text-red-400',     bar: 'bg-red-500' }
})

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

// Datos para donut de grupos musculares
const muscleGroupData = computed(() => {
  if (!stats.value?.topExercises.length) return []
  const grouped: Record<string, number> = {}
  stats.value.topExercises.forEach(ex => {
    grouped[ex.muscleGroup] = (grouped[ex.muscleGroup] ?? 0) + ex.sets
  })
  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([mg, sets]) => ({
      name: mgLabel(mg),
      value: sets,
      itemStyle: { color: MG_COLORS[mg] ?? '#6366f1' },
    }))
})

const muscleGroupChartOption = computed(() => {
  if (muscleGroupData.value.length === 0) return null
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: '{b}: {c} series ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
    },
    series: [{
      type: 'pie',
      radius: ['50%', '76%'],
      center: ['36%', '50%'],
      data: muscleGroupData.value,
      label: { show: false },
      itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 2 },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' } },
    }],
  }
})

// Barras horizontales para top ejercicios
const topExercisesChartOption = computed(() => {
  if (!stats.value?.topExercises.length) return null
  const { solid } = getAccentColor()
  const exs = stats.value.topExercises.slice(0, 6)
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 36, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) =>
        `${params[0].name}: <b>${params[0].value} series</b>`,
    },
    yAxis: {
      type: 'category',
      data: exs.map(e => e.name),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'bar',
      data: exs.map(e => e.sets),
      barMaxWidth: 14,
      itemStyle: { color: solid, borderRadius: [0, 6, 6, 0] },
      label: {
        show: true,
        position: 'right',
        color: '#64748b',
        fontSize: 11,
        formatter: '{c}',
      },
    }],
  }
})

// Gráfico de progresión lineal
const chartOption = computed(() => {
  const { solid, alpha20 } = getAccentColor()
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
      lineStyle: { color: solid, width: 2 },
      itemStyle: { color: solid },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: alpha20 }, { offset: 1, color: 'rgba(0,0,0,0)' }] },
      },
    }],
  }
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

        <!-- ── Tarjetas métricas ───────────────────────────────────────── -->
        <div class="grid grid-cols-2 gap-3 mb-6">

          <!-- Días este mes -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div class="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold text-white mb-0.5 tabular-nums">{{ stats.daysThisMonth }}</div>
            <div class="text-gray-400 text-xs">Días este mes</div>
          </div>

          <!-- Series este mes -->
          <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold text-white mb-0.5 tabular-nums">{{ stats.setsThisMonth }}</div>
            <div class="text-gray-400 text-xs">Series completadas</div>
          </div>

          <!-- Total histórico (full width) -->
          <div class="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div class="text-gray-500 text-xs mb-1">Total histórico</div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-bold text-white tabular-nums">{{ stats.totalDays }}</span>
                <span class="text-gray-500 text-sm">entrenamientos</span>
              </div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- ── IMC ────────────────────────────────────────────────────────── -->
        <div v-if="bmi !== null" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-gray-500 text-xs mb-0.5">Índice de masa corporal</div>
              <div class="flex items-baseline gap-2">
                <span class="text-3xl font-bold text-white tabular-nums">{{ bmi }}</span>
                <span :class="bmiCategory!.color" class="text-sm font-semibold">{{ bmiCategory!.label }}</span>
              </div>
            </div>
            <div class="text-right text-xs text-gray-600">
              <div>{{ stats!.weightKg }} kg</div>
              <div>{{ stats!.heightCm }} cm</div>
            </div>
          </div>
          <!-- Barra IMC visual -->
          <div class="relative h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              class="absolute left-0 top-0 h-full rounded-full transition-all"
              :class="bmiCategory!.bar"
              :style="{ width: `${Math.min(((bmi - 10) / 30) * 100, 100)}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-gray-700 text-xs mt-1">
            <span>10</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
          </div>
        </div>

        <!-- ── Distribución muscular + Top ejercicios ─────────────────── -->
        <div v-if="stats.topExercises.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-4">Actividad — {{ monthName }}</h2>

          <!-- Donut + barras lado a lado en desktop, apiladas en mobile -->
          <div class="flex flex-col gap-6 sm:flex-row">

            <!-- Donut: distribución por grupo muscular -->
            <div class="flex-1 min-w-0">
              <p class="text-gray-500 text-xs mb-2">Por grupo muscular</p>
              <VChart
                v-if="muscleGroupChartOption"
                :option="muscleGroupChartOption"
                style="height: 160px; width: 100%;"
                autoresize
              />
            </div>

            <!-- Barras horizontales: top ejercicios -->
            <div class="flex-1 min-w-0">
              <p class="text-gray-500 text-xs mb-2">Top ejercicios (series)</p>
              <VChart
                v-if="topExercisesChartOption"
                :option="topExercisesChartOption"
                :style="{ height: `${stats.topExercises.slice(0,6).length * 28 + 8}px`, width: '100%' }"
                autoresize
              />
            </div>
          </div>
        </div>

        <p v-else class="text-gray-600 text-sm text-center pb-4">
          Aún no hay series completadas este mes.
        </p>

        <!-- ── Máximos estimados / niveles de fuerza ──────────────────── -->
        <div v-if="strengthRows.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-1">Máximo estimado por ejercicio</h2>
          <p class="text-gray-600 text-xs mb-4">
            1RM estimado a partir de tus series registradas.
            <template v-if="stats!.weightKg"> El nivel compara contra estándares para {{ stats!.weightKg }} kg.</template>
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
                <div class="text-accent-400 font-bold text-sm tabular-nums">{{ row.e1rm }} kg</div>
                <div v-if="row.ratio !== null" class="text-gray-500 text-xs tabular-nums">{{ row.ratio }}× tu peso</div>
              </div>
            </div>
          </div>
          <p v-if="!stats!.weightKg" class="text-gray-600 text-xs mt-3 text-center">
            Agrega tu peso en Perfil para ver el nivel comparativo.
          </p>
        </div>

        <!-- ── Progresión por ejercicio ───────────────────────────────── -->
        <div v-if="progExercises.length > 0" class="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h2 class="text-gray-300 text-sm font-semibold mb-3">Progresión por ejercicio</h2>

          <!-- Selector -->
          <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
            <button
              v-for="ex in progExercises"
              :key="ex.id"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors sm:shrink"
              :class="selectedExId === ex.id
                ? 'bg-accent-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'"
              @click="loadProgression(ex.id)"
            >
              {{ ex.name }}
            </button>
          </div>

          <!-- Gráfico lineal -->
          <div v-if="progLoading" class="flex justify-center py-10">
            <div class="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p v-else-if="progError" class="text-red-400 text-xs text-center py-6">{{ progError }}</p>
          <template v-else-if="progData.length >= 2">
            <VChart :option="chartOption" style="height: 180px; width: 100%;" autoresize />
            <p class="text-gray-600 text-xs mt-2 text-center">1RM estimado por sesión (kg)</p>
          </template>
          <p v-else class="text-gray-600 text-xs text-center py-6">
            Necesitas al menos 2 sesiones con peso registrado para ver la progresión.
          </p>
        </div>

      </template>
    </div>
  </div>
</template>
