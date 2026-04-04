<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api, type PlanEntry, type Exercise, type SessionData } from '../lib/api'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()

// ── Días base (dow: 0=Lun … 6=Dom) ──────────────────────────────────────────
const BASE_DAYS = [
  { short: 'Lun', full: 'Lunes',      dow: 0 },
  { short: 'Mar', full: 'Martes',     dow: 1 },
  { short: 'Mié', full: 'Miércoles',  dow: 2 },
  { short: 'Jue', full: 'Jueves',     dow: 3 },
  { short: 'Vie', full: 'Viernes',    dow: 4 },
  { short: 'Sáb', full: 'Sábado',     dow: 5 },
  { short: 'Dom', full: 'Domingo',    dow: 6 },
]

const MUSCLE_GROUPS = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'dorsales', label: 'Dorsales' },
  { id: 'hombros', label: 'Hombros' },
  { id: 'bíceps', label: 'Bíceps' },
  { id: 'tríceps', label: 'Tríceps' },
  { id: 'cuádriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'abdominales', label: 'Abdominales' },
  { id: 'glúteos', label: 'Glúteos' },
  { id: 'pantorrillas', label: 'Pantorrillas' },
  { id: 'trapecios', label: 'Trapecios' },
  { id: 'antebrazos', label: 'Antebrazos' },
  { id: 'lumbar', label: 'Lumbar' },
  { id: 'espalda media', label: 'Espalda media' },
  { id: 'abductores', label: 'Abductores' },
  { id: 'aductores', label: 'Aductores' },
  { id: 'cuello', label: 'Cuello' },
]

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Días ordenados según preferencia de inicio de semana
const orderedDays = computed(() =>
  preferences.weekStart === 1
    ? [BASE_DAYS[6], ...BASE_DAYS.slice(0, 6)]  // Dom primero
    : BASE_DAYS                                   // Lun primero
)

// Día de hoy (dow 0-6)
const todayDow = (() => {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
})()

// ── Vista activa ─────────────────────────────────────────────────────────────
const view = ref<'week' | 'history'>('week')

// ── Plan semanal ─────────────────────────────────────────────────────────────
const selectedDay = ref(todayDow)
const plan = ref<PlanEntry[]>([])
const exercises = ref<Exercise[]>([])
const showAddModal = ref(false)
const addExerciseId = ref<number | null>(null)
const addSets = ref(3)
const addReps = ref(10)
const addWeightKg = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editSets = ref(3)
const editReps = ref(10)
const editWeightKg = ref<number | null>(null)
const saving = ref(false)
const searchQuery = ref('')
const modalFilterGroup = ref('all')

const dayPlan = computed(() =>
  plan.value
    .filter((e) => e.dayOfWeek === selectedDay.value)
    .sort((a, b) => a.orderIndex - b.orderIndex)
)

const availableExercises = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return exercises.value.filter((e) => {
    if (dayPlan.value.find((p) => p.exerciseId === e.id)) return false
    if (modalFilterGroup.value !== 'all' && e.muscleGroup !== modalFilterGroup.value) return false
    if (!q) return true
    return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
  })
})

const dayHasPlan = (dow: number) => plan.value.some((e) => e.dayOfWeek === dow)

async function load() {
  const [planData, exData] = await Promise.all([api.plan.get(), api.exercises.list()])
  plan.value = planData
  exercises.value = exData
}

async function addToPlan() {
  if (!addExerciseId.value) return
  saving.value = true
  try {
    const entry = await api.plan.add(selectedDay.value, addExerciseId.value, addSets.value, addReps.value, addWeightKg.value)
    plan.value.push(entry)
    showAddModal.value = false
    addExerciseId.value = null
    addSets.value = 3
    addReps.value = 10
    addWeightKg.value = null
    searchQuery.value = ''
    modalFilterGroup.value = 'all'
  } finally {
    saving.value = false
  }
}

async function removeFromPlan(id: number) {
  await api.plan.remove(id)
  plan.value = plan.value.filter((e) => e.id !== id)
}

function startEdit(entry: PlanEntry) {
  editingId.value = entry.id
  editSets.value = entry.sets
  editReps.value = entry.reps
  editWeightKg.value = entry.weightKg
}

async function saveEdit(id: number) {
  const updated = await api.plan.update(id, editSets.value, editReps.value, editWeightKg.value)
  const idx = plan.value.findIndex((e) => e.id === id)
  if (idx >= 0) plan.value[idx] = { ...plan.value[idx], sets: updated.sets, reps: updated.reps, weightKg: updated.weightKg }
  editingId.value = null
}

// ── Historial mensual ────────────────────────────────────────────────────────
const now = new Date()
const historyYearMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const monthSessions = ref<{ date: string; completedSets: number }[]>([])
const historyLoading = ref(false)
const selectedHistoryDate = ref<string | null>(null)
const historyDayData = ref<SessionData | null>(null)
const dayLoading = ref(false)

const historyTitle = computed(() => {
  const [y, m] = historyYearMonth.value.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
})

async function loadMonth() {
  historyLoading.value = true
  try {
    monthSessions.value = await api.sessions.getMonth(historyYearMonth.value)
  } finally {
    historyLoading.value = false
  }
}

function prevMonth() {
  const [y, m] = historyYearMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  historyYearMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadMonth()
}

function nextMonth() {
  const [y, m] = historyYearMonth.value.split('-').map(Number)
  const d = new Date(y, m, 1)
  historyYearMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadMonth()
}

// Grilla del calendario
const calendarCells = computed(() => {
  const [y, m] = historyYearMonth.value.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const jsFirstDay = new Date(y, m - 1, 1).getDay() // 0=Dom
  const dowFirst = jsFirstDay === 0 ? 6 : jsFirstDay - 1 // 0=Lun

  // Posición del primer día en el orden actual
  const startPos = orderedDays.value.findIndex(d => d.dow === dowFirst)

  const sessionMap = new Map(monthSessions.value.map(s => [s.date, s.completedSets]))
  const todayStr = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })()

  const cells: ({ day: number; date: string; hasSess: boolean; sets: number; isToday: boolean } | null)[] = []

  for (let i = 0; i < startPos; i++) cells.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date, hasSess: sessionMap.has(date), sets: sessionMap.get(date) ?? 0, isToday: date === todayStr })
  }

  while (cells.length % 7 !== 0) cells.push(null)

  return cells
})

function goToPlanDay(date: string) {
  const js = new Date(date + 'T12:00:00').getDay()
  selectedDay.value = js === 0 ? 6 : js - 1
  view.value = 'week'
}

async function selectHistoryDay(date: string) {
  if (selectedHistoryDate.value === date) {
    selectedHistoryDate.value = null
    historyDayData.value = null
    return
  }
  selectedHistoryDate.value = date
  historyDayData.value = null
  dayLoading.value = true
  try {
    historyDayData.value = await api.sessions.get(date)
  } finally {
    dayLoading.value = false
  }
}

watch(view, (v) => {
  if (v === 'history') loadMonth()
  selectedHistoryDate.value = null
  historyDayData.value = null
})

onMounted(load)
</script>

<template>
  <div class="max-w-lg lg:max-w-2xl mx-auto">

    <!-- Tabs Semana / Historial -->
    <div class="sticky top-0 bg-gray-950 pt-4 pb-3 px-4 z-10 border-b border-gray-800/50">
      <div class="flex bg-gray-900 rounded-2xl p-1 mb-3 border border-gray-800">
        <button
          @click="view = 'week'"
          class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
          :class="view === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-300'"
        >
          Plan semanal
        </button>
        <button
          @click="view = 'history'"
          class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
          :class="view === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-300'"
        >
          Historial
        </button>
      </div>

      <!-- Selector de días (solo en vista semana) -->
      <div v-if="view === 'week'" class="grid grid-cols-7 gap-1">
        <button
          v-for="d in orderedDays"
          :key="d.dow"
          @click="selectedDay = d.dow"
          class="flex flex-col items-center py-2 rounded-xl text-xs font-semibold transition-all"
          :class="
            selectedDay === d.dow
              ? 'bg-indigo-600 text-white'
              : d.dow === todayDow
              ? 'bg-gray-900 text-indigo-400 ring-1 ring-indigo-500/40'
              : 'text-gray-600 hover:text-gray-300'
          "
        >
          {{ d.short }}
          <span
            v-if="dayHasPlan(d.dow)"
            class="w-1 h-1 rounded-full mt-1"
            :class="selectedDay === d.dow ? 'bg-white/50' : 'bg-indigo-500'"
          />
          <span v-else class="w-1 h-1 mt-1" />
        </button>
      </div>

      <!-- Navegación de mes (solo en vista historial) -->
      <div v-else class="flex items-center justify-between px-1">
        <button @click="prevMonth" class="p-1.5 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="text-sm font-semibold text-white">{{ historyTitle }}</span>
        <button @click="nextMonth" class="p-1.5 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ── VISTA: PLAN SEMANAL ─────────────────────────────────────────── -->
    <div v-if="view === 'week'" class="p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="font-semibold text-white">{{ orderedDays.find(d => d.dow === selectedDay)?.full }}</h2>
          <p class="text-xs text-gray-500 mt-0.5">{{ dayPlan.length }} ejercicio{{ dayPlan.length !== 1 ? 's' : '' }}</p>
        </div>
        <button
          @click="showAddModal = true"
          class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          :disabled="exercises.length === 0"
        >
          + Agregar
        </button>
      </div>

      <!-- Plan entries -->
      <div class="space-y-3">
        <div
          v-for="entry in dayPlan"
          :key="entry.id"
          class="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden"
        >
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-white text-sm truncate">{{ entry.exerciseName }}</p>
              <p class="text-xs text-indigo-400 mt-0.5">
                {{ entry.sets }} series × {{ entry.reps }} reps
                <span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span>
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                @click="startEdit(entry)"
                class="text-gray-600 hover:text-gray-300 p-1.5 transition-colors rounded-lg hover:bg-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                @click="removeFromPlan(entry.id)"
                class="text-gray-700 hover:text-red-400 p-1.5 transition-colors rounded-lg hover:bg-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Edit inline -->
          <Transition
            enter-active-class="transition-all duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition-all duration-100"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="editingId === entry.id" class="px-4 pb-3.5 border-t border-gray-800 pt-3">
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <label class="text-xs text-gray-500 block mb-1">Series</label>
                  <input v-model.number="editSets" type="number" min="1" max="20"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-500 block mb-1">Reps</label>
                  <input v-model.number="editReps" type="number" min="1" max="200"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-500 block mb-1">Peso (kg)</label>
                  <input v-model.number="editWeightKg" type="number" min="0" step="0.5" placeholder="—"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <button @click="saveEdit(entry.id)"
                  class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  OK
                </button>
                <button @click="editingId = null" class="text-gray-500 hover:text-gray-300 px-2 py-2 text-sm transition-colors">✕</button>
              </div>
            </div>
          </Transition>
        </div>

        <div v-if="dayPlan.length === 0" class="text-center py-14">
          <div class="text-4xl mb-3">📅</div>
          <p class="text-gray-500 font-medium">Día libre</p>
          <p class="text-gray-600 text-sm mt-1">
            {{ exercises.length === 0 ? 'Primero crea ejercicios en la pestaña Ejercicios' : 'Agrega ejercicios con el botón de arriba' }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── VISTA: HISTORIAL MENSUAL ───────────────────────────────────── -->
    <div v-else class="p-4">
      <div v-if="historyLoading" class="flex justify-center py-16">
        <div class="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>

      <template v-else>
        <!-- Cabecera días de la semana -->
        <div class="grid grid-cols-7 gap-1 mb-1">
          <div
            v-for="d in orderedDays"
            :key="d.dow"
            class="text-center text-xs text-gray-600 font-semibold py-1"
          >
            {{ d.short }}
          </div>
        </div>

        <!-- Grilla de días -->
        <div class="grid grid-cols-7 gap-1">
          <component
            :is="cell?.hasSess ? 'button' : 'div'"
            v-for="(cell, i) in calendarCells"
            :key="i"
            @click="cell?.hasSess && selectHistoryDay(cell.date)"
            class="aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors"
            :class="
              !cell
                ? ''
                : selectedHistoryDate === cell.date
                ? 'bg-indigo-600 text-white'
                : cell.isToday && cell.hasSess
                ? 'ring-1 ring-indigo-500 bg-indigo-600/20 text-indigo-300 cursor-pointer hover:bg-indigo-600/30'
                : cell.isToday
                ? 'ring-1 ring-indigo-500 text-white'
                : cell.hasSess
                ? 'bg-indigo-600/20 text-indigo-300 cursor-pointer hover:bg-indigo-600/30'
                : 'text-gray-600'
            "
          >
            <template v-if="cell">
              <span>{{ cell.day }}</span>
              <span v-if="cell.hasSess" class="w-1.5 h-1.5 rounded-full mt-0.5"
                :class="selectedHistoryDate === cell.date ? 'bg-white/60' : 'bg-indigo-400'" />
            </template>
          </component>
        </div>

        <!-- Resumen del mes -->
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-4 text-center">
            <p class="text-2xl font-bold text-white">{{ monthSessions.length }}</p>
            <p class="text-xs text-gray-500 mt-1">Días entrenados</p>
          </div>
          <div class="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-4 text-center">
            <p class="text-2xl font-bold text-white">{{ monthSessions.reduce((s, r) => s + r.completedSets, 0) }}</p>
            <p class="text-xs text-gray-500 mt-1">Series completadas</p>
          </div>
        </div>

        <!-- Panel detalle día seleccionado -->
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="transition-all duration-150"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div v-if="selectedHistoryDate" class="mt-4 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <p class="text-sm font-semibold text-white">{{ selectedHistoryDate }}</p>
              <button @click="selectedHistoryDate = null; historyDayData = null" class="text-gray-600 hover:text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div v-if="dayLoading" class="flex justify-center py-6">
              <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>

            <template v-else-if="historyDayData">
              <div v-if="historyDayData.plan.length === 0" class="px-4 py-6 text-center text-gray-600 text-sm">
                Sin ejercicios registrados
              </div>
              <div v-else class="divide-y divide-gray-800">
                <button
                  v-for="entry in historyDayData.plan"
                  :key="entry.id"
                  @click="goToPlanDay(selectedHistoryDate!)"
                  class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors text-left"
                >
                  <div>
                    <p class="text-sm font-medium text-white">{{ entry.exerciseName }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">
                      {{ entry.sets }} series × {{ entry.reps }} reps
                      <span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span>
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-sm font-bold"
                      :class="historyDayData.completedSets.filter(s => s.weeklyPlanId === entry.id).length === entry.sets ? 'text-green-400' : 'text-gray-500'">
                      {{ historyDayData.completedSets.filter(s => s.weeklyPlanId === entry.id).length }}/{{ entry.sets }}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </button>
              </div>
            </template>
          </div>
        </Transition>
      </template>
    </div>

    <!-- ── MODAL AGREGAR ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-all duration-150"
        leave-to-class="opacity-0"
      >
        <div v-if="showAddModal" class="fixed inset-0 bg-black/70 z-50 flex items-end" @click.self="showAddModal = false">
          <Transition
            enter-active-class="transition-all duration-200"
            enter-from-class="translate-y-full"
            leave-active-class="transition-all duration-150"
            leave-to-class="translate-y-full"
          >
            <div v-if="showAddModal" class="bg-gray-900 rounded-t-3xl w-full p-6 max-h-[85vh] flex flex-col border-t border-gray-800">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-lg text-white">Agregar a {{ orderedDays.find(d => d.dow === selectedDay)?.full }}</h3>
                <button @click="showAddModal = false" class="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto space-y-4 min-h-0">
                <!-- Filtro por categoría -->
                <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    @click="modalFilterGroup = 'all'"
                    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    :class="modalFilterGroup === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'"
                  >
                    Todos
                  </button>
                  <button
                    v-for="g in MUSCLE_GROUPS"
                    :key="g.id"
                    @click="modalFilterGroup = g.id"
                    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    :class="modalFilterGroup === g.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'"
                  >
                    {{ g.label }}
                  </button>
                </div>

                <!-- Búsqueda -->
                <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="Buscar ejercicio..."
                  class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  autofocus
                />

                <!-- Lista de ejercicios -->
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  <button
                    v-for="ex in availableExercises"
                    :key="ex.id"
                    @click="addExerciseId = ex.id"
                    class="w-full text-left px-4 py-3 rounded-xl text-sm transition-all border"
                    :class="addExerciseId === ex.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-gray-800 border-transparent text-gray-300 hover:border-gray-600'"
                  >
                    <span class="font-semibold">{{ ex.name }}</span>
                    <span class="text-xs ml-2 text-gray-500">{{ ex.muscleGroup }}</span>
                  </button>
                  <p v-if="availableExercises.length === 0" class="text-gray-600 text-sm px-2 py-3 text-center">
                    Sin ejercicios disponibles
                  </p>
                </div>

                <!-- Sets, Reps y Peso -->
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Series</label>
                    <input v-model.number="addSets" type="number" min="1" max="20"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Reps</label>
                    <input v-model.number="addReps" type="number" min="1" max="200"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Peso (kg)</label>
                    <input v-model.number="addWeightKg" type="number" min="0" step="0.5" placeholder="—"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>

              <button
                @click="addToPlan"
                :disabled="!addExerciseId || saving"
                class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3.5 rounded-2xl font-semibold transition-colors mt-4"
              >
                {{ saving ? 'Guardando...' : 'Agregar al plan' }}
              </button>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
