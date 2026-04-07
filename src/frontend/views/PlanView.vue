<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api, matchesSearch, type PlanEntry, type Exercise, type Routine } from '../lib/api'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()

// ── Días base
// dow = offset desde el inicio de semana del usuario (0 = primer día, 6 = último)
const BASE_DAYS_MON = [
  { short: 'Lun', full: 'Lunes',      dow: 0 },
  { short: 'Mar', full: 'Martes',     dow: 1 },
  { short: 'Mié', full: 'Miércoles',  dow: 2 },
  { short: 'Jue', full: 'Jueves',     dow: 3 },
  { short: 'Vie', full: 'Viernes',    dow: 4 },
  { short: 'Sáb', full: 'Sábado',     dow: 5 },
  { short: 'Dom', full: 'Domingo',    dow: 6 },
]
const BASE_DAYS_SUN = [
  { short: 'Dom', full: 'Domingo',    dow: 0 },
  { short: 'Lun', full: 'Lunes',      dow: 1 },
  { short: 'Mar', full: 'Martes',     dow: 2 },
  { short: 'Mié', full: 'Miércoles',  dow: 3 },
  { short: 'Jue', full: 'Jueves',     dow: 4 },
  { short: 'Vie', full: 'Viernes',    dow: 5 },
  { short: 'Sáb', full: 'Sábado',     dow: 6 },
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

const orderedDays = computed(() => preferences.weekStart === 1 ? BASE_DAYS_SUN : BASE_DAYS_MON)

// Calcula el inicio de semana (YYYY-MM-DD) según preferencia del usuario
function calcWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Dom
  const offset = preferences.weekStart === 1 ? day : (day === 0 ? 6 : day - 1)
  d.setDate(d.getDate() - offset)
  return d.toISOString().split('T')[0]
}

// Offset del día dentro de la semana (0 = primer día, 6 = último)
function calcDayOfWeek(dateStr: string): number {
  const ws = calcWeekStart(dateStr)
  const d1 = new Date(dateStr + 'T12:00:00')
  const d2 = new Date(ws + 'T12:00:00')
  return Math.round((d1.getTime() - d2.getTime()) / 86400000)
}

const _n = new Date()
const todayStr = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`

// Semana actualmente visible
const currentWeekStart = ref(calcWeekStart(todayStr))

// Offset del día de hoy dentro de la semana del usuario
const todayDow = computed(() => calcDayOfWeek(todayStr))

// Label de la semana actual, muestra mes en caso de cruce
const weekLabel = computed(() => {
  const start = new Date(currentWeekStart.value + 'T12:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const s0 = orderedDays.value[0].short
  const s6 = orderedDays.value[6].short
  const mEnd = MONTH_NAMES[end.getMonth()].slice(0, 3)
  if (start.getMonth() !== end.getMonth()) {
    const mStart = MONTH_NAMES[start.getMonth()].slice(0, 3)
    return `${s0} ${pad(start.getDate())} ${mStart} – ${s6} ${pad(end.getDate())} ${mEnd}`
  }
  return `${s0} ${pad(start.getDate())} – ${s6} ${pad(end.getDate())}, ${mEnd}`
})

// Número de día del mes para el offset dow en la semana actual
function weekDayDate(dow: number): string {
  const d = new Date(currentWeekStart.value + 'T12:00:00')
  d.setDate(d.getDate() + dow)
  return String(d.getDate()).padStart(2, '0')
}

function prevWeek() {
  const d = new Date(currentWeekStart.value + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d.toISOString().split('T')[0]
}

function nextWeek() {
  const d = new Date(currentWeekStart.value + 'T12:00:00')
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d.toISOString().split('T')[0]
}

function goToCurrentWeek() {
  currentWeekStart.value = calcWeekStart(todayStr)
  selectedDay.value = todayDow.value
}

// ── Vista activa ─────────────────────────────────────────────────────────────
const view = ref<'week' | 'month'>('week')

// ── Plan semanal ─────────────────────────────────────────────────────────────
const selectedDay = ref(todayDow.value)
const plan = ref<PlanEntry[]>([])
const exercises = ref<Exercise[]>([])
const ready = ref(false)
// ── Modal agregar ─────────────────────────────────────────────────────────────
const showAddModal = ref(false)
const addStep = ref<'search' | 'config'>('search')
const addExerciseId = ref<number | null>(null)
const addExerciseName = ref('')
const addSets = ref(3)
const addReps = ref(10)
const addWeightKg = ref<number | null>(null)
const addIsCardio = ref(false)
const addDurationMinutes = ref<number | null>(30)
const saving = ref(false)
const searchQuery = ref('')
const modalFilterGroup = ref('all')

// ── Modal editar ──────────────────────────────────────────────────────────────
const editingId = ref<number | null>(null)
const editSets = ref(3)
const editReps = ref(10)
const editWeightKg = ref<number | null>(null)
const editIsCardio = ref(false)
const editDurationMinutes = ref<number | null>(null)

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
    return matchesSearch(e.name, e.muscleGroup, q)
  })
})

const dayHasPlan = (dow: number) => plan.value.some((e) => e.dayOfWeek === dow)

async function load() {
  const [planData, exData] = await Promise.all([api.plan.get(currentWeekStart.value), api.exercises.list()])
  plan.value = planData
  exercises.value = exData
  ready.value = true
}

function selectExercise(ex: Exercise) {
  addExerciseId.value = ex.id
  addExerciseName.value = ex.name
  addStep.value = 'config'
}

function resetAddModal() {
  addStep.value = 'search'
  addExerciseId.value = null
  addExerciseName.value = ''
  addSets.value = 3
  addReps.value = 10
  addWeightKg.value = null
  addIsCardio.value = false
  addDurationMinutes.value = 30
  searchQuery.value = ''
  modalFilterGroup.value = 'all'
}

async function addToPlan() {
  if (!addExerciseId.value) return
  saving.value = true
  try {
    const entry = await api.plan.add(
      currentWeekStart.value,
      selectedDay.value,
      addExerciseId.value,
      addSets.value,
      addIsCardio.value ? 1 : addReps.value,
      addIsCardio.value ? null : addWeightKg.value,
      addIsCardio.value ? 1 : 0,
      addIsCardio.value ? addDurationMinutes.value : null,
    )
    plan.value.push(entry)
    showAddModal.value = false
    resetAddModal()
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
  editIsCardio.value = entry.isCardio === 1
  editDurationMinutes.value = entry.durationMinutes
}

async function saveEdit(id: number) {
  const updated = await api.plan.update(
    id,
    editSets.value,
    editIsCardio.value ? 1 : editReps.value,
    editIsCardio.value ? null : editWeightKg.value,
    editIsCardio.value ? 1 : 0,
    editIsCardio.value ? editDurationMinutes.value : null,
  )
  const idx = plan.value.findIndex((e) => e.id === id)
  if (idx >= 0) plan.value[idx] = { ...plan.value[idx], ...updated }
  editingId.value = null
}

// ── Rutinas ──────────────────────────────────────────────────────────────────
const routines = ref<Routine[]>([])
const showSaveRoutine = ref(false)
const showLoadRoutine = ref(false)
const routineName = ref('')
const routineSaving = ref(false)
const routineLoading = ref(false)

async function loadRoutines() {
  routines.value = await api.routines.list()
}

async function saveRoutine() {
  if (!routineName.value.trim() || !dayPlan.value.length) return
  routineSaving.value = true
  try {
    const ex = dayPlan.value.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      weightKg: e.weightKg,
      orderIndex: e.orderIndex,
    }))
    const saved = await api.routines.save(routineName.value, ex)
    routines.value.push(saved)
    showSaveRoutine.value = false
    routineName.value = ''
  } finally {
    routineSaving.value = false
  }
}

async function applyRoutine(routineId: number) {
  routineLoading.value = true
  try {
    const entries = await api.routines.apply(routineId, selectedDay.value, currentWeekStart.value)
    plan.value = plan.value.filter((e) => e.dayOfWeek !== selectedDay.value)
    plan.value.push(...entries)
    showLoadRoutine.value = false
  } finally {
    routineLoading.value = false
  }
}

async function deleteRoutine(id: number) {
  await api.routines.delete(id)
  routines.value = routines.value.filter((r) => r.id !== id)
}

// ── Planificación mensual ────────────────────────────────────────────────────
const now = new Date()
const historyYearMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const monthPlanDates = ref<string[]>([])
const historyLoading = ref(false)

const historyTitle = computed(() => {
  const [y, m] = historyYearMonth.value.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
})

async function loadMonth() {
  historyLoading.value = true
  try {
    monthPlanDates.value = await api.plan.getMonth(historyYearMonth.value)
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
  const dowFirst = preferences.weekStart === 1 ? jsFirstDay : (jsFirstDay === 0 ? 6 : jsFirstDay - 1)
  const startPos = orderedDays.value.findIndex(d => d.dow === dowFirst)

  const planSet = new Set(monthPlanDates.value)

  const cells: ({ day: number; date: string; hasPlan: boolean; isToday: boolean } | null)[] = []

  for (let i = 0; i < startPos; i++) cells.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, date, hasPlan: planSet.has(date), isToday: date === todayStr })
  }

  while (cells.length % 7 !== 0) cells.push(null)

  return cells
})

// Seleccionar un día en la vista mensual: muestra resumen sin navegar aún
const selectedMonthDay = ref<string | null>(null)
const selectedMonthWeekStart = computed(() => selectedMonthDay.value ? calcWeekStart(selectedMonthDay.value) : null)
const monthDayPlan = ref<PlanEntry[]>([])
const monthDayLoading = ref(false)

// Devuelve si una fecha pertenece a la semana seleccionada
function isInSelectedWeek(date: string): boolean {
  return selectedMonthWeekStart.value !== null && calcWeekStart(date) === selectedMonthWeekStart.value
}

async function selectMonthDay(date: string) {
  if (selectedMonthDay.value === date) {
    selectedMonthDay.value = null
    monthDayPlan.value = []
    return
  }
  selectedMonthDay.value = date
  monthDayPlan.value = []
  monthDayLoading.value = true
  try {
    const ws = calcWeekStart(date)
    const dow = calcDayOfWeek(date)
    const weekPlan = await api.plan.get(ws)
    monthDayPlan.value = weekPlan.filter(e => e.dayOfWeek === dow).sort((a, b) => a.orderIndex - b.orderIndex)
  } finally {
    monthDayLoading.value = false
  }
}

function goToSelectedWeek() {
  if (!selectedMonthDay.value) return
  currentWeekStart.value = calcWeekStart(selectedMonthDay.value)
  selectedDay.value = calcDayOfWeek(selectedMonthDay.value)
  view.value = 'week'
}

watch(view, (v) => {
  if (v === 'month') loadMonth()
  selectedMonthDay.value = null
  monthDayPlan.value = []
})

watch(currentWeekStart, async () => {
  ready.value = false
  plan.value = []
  const planData = await api.plan.get(currentWeekStart.value)
  plan.value = planData
  ready.value = true
})

onMounted(() => { load(); loadRoutines() })
</script>

<template>
  <div class="max-w-lg lg:max-w-2xl mx-auto">

    <!-- Tabs Semana / Historial -->
    <div class="sticky top-0 bg-gray-950 pt-4 pb-3 px-4 z-10 border-b border-gray-800/50">
      <div class="flex bg-gray-900 rounded-2xl p-1 mb-3 border border-gray-800">
        <button
          @click="view = 'week'"
          class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
          :class="view === 'week' ? 'bg-accent-600 text-white' : 'text-gray-400 hover:text-gray-300'"
        >
          Semana
        </button>
        <button
          @click="view = 'month'"
          class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
          :class="view === 'month' ? 'bg-accent-600 text-white' : 'text-gray-400 hover:text-gray-300'"
        >
          Mes
        </button>
      </div>

      <!-- Navegación de semana + selector de días (vista semana) -->
      <div v-if="view === 'week'">
        <div class="flex items-center justify-between px-1 mb-2">
          <button @click="prevWeek" class="p-1.5 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button @click="goToCurrentWeek" class="text-sm font-semibold transition-colors"
            :class="currentWeekStart === calcWeekStart(todayStr) ? 'text-accent-400' : 'text-white hover:text-accent-400'">
            {{ weekLabel }}
          </button>
          <button @click="nextWeek" class="p-1.5 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="d in orderedDays"
            :key="d.dow"
            @click="selectedDay = d.dow"
            class="flex flex-col items-center py-1.5 rounded-xl text-xs font-semibold transition-all"
            :class="
              selectedDay === d.dow
                ? 'bg-accent-600 text-white'
                : d.dow === todayDow && currentWeekStart === calcWeekStart(todayStr)
                ? 'bg-gray-900 text-accent-400 ring-1 ring-accent-500/40'
                : 'text-gray-600 hover:text-gray-300'
            "
          >
            {{ d.short }}
            <span class="text-xs font-normal opacity-70">{{ weekDayDate(d.dow) }}</span>
            <span
              v-if="dayHasPlan(d.dow)"
              class="w-1 h-1 rounded-full mt-0.5"
              :class="selectedDay === d.dow ? 'bg-white/50' : 'bg-accent-500'"
            />
            <span v-else class="w-1 h-1 mt-0.5" />
          </button>
        </div>
      </div>

      <!-- Navegación de mes (vista mes) -->
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
        <div class="flex items-center gap-1">
          <!-- Cargar rutina -->
          <button
            @click="showLoadRoutine = true"
            title="Cargar rutina"
            class="flex items-center gap-1.5 text-gray-400 hover:text-accent-400 p-2 sm:px-3 rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span class="hidden sm:inline">Cargar rutina</span>
          </button>
          <!-- Guardar rutina -->
          <button
            @click="routineName = orderedDays.find(d => d.dow === selectedDay)?.full ?? ''; showSaveRoutine = true"
            :disabled="dayPlan.length === 0"
            title="Guardar rutina"
            class="flex items-center gap-1.5 text-gray-400 hover:text-accent-400 p-2 sm:px-3 rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 3v4a1 1 0 001 1h4M9 12h6M9 16h4"/>
            </svg>
            <span class="hidden sm:inline">Guardar rutina</span>
          </button>
          <button
            @click="showAddModal = true"
            class="flex items-center gap-1 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
            :disabled="exercises.length === 0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            <span class="hidden sm:inline">Ejercicio</span>
          </button>
        </div>
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
              <p class="font-semibold text-white text-sm">{{ entry.exerciseName }}</p>
              <p class="text-xs text-accent-400 mt-0.5">
                <template v-if="entry.isCardio">
                  {{ entry.durationMinutes }} min
                </template>
                <template v-else>
                  {{ entry.sets }} series × {{ entry.reps }} reps
                  <span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span>
                </template>
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
            <div v-if="editingId === entry.id" class="px-4 pb-3.5 border-t border-gray-800 pt-3 space-y-3">
              <!-- Toggle cardio + campo duración, ambos alineados a la derecha -->
              <div class="flex justify-end">
                <button type="button" @click="editIsCardio = !editIsCardio"
                  class="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors"
                  :class="editIsCardio ? 'border-accent-500 text-accent-400 bg-accent-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-600'">
                  🏃 Usa tiempo (cardio)
                </button>
              </div>
              <!-- Campos fuerza: series / reps / peso -->
              <div v-if="!editIsCardio" class="grid grid-cols-3 gap-2">
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Series</label>
                  <input v-model.number="editSets" type="number" min="1" max="20"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-500" />
                </div>
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Reps</label>
                  <input v-model.number="editReps" type="number" min="1" max="200"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-500" />
                </div>
                <div>
                  <label class="text-xs text-gray-500 block mb-1">Peso (kg)</label>
                  <input v-model.number="editWeightKg" type="number" min="0" step="0.5" placeholder="—"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-500" />
                </div>
              </div>
              <!-- Campo cardio: duración, alineado a la derecha -->
              <div v-else class="flex justify-end">
                <div class="w-[160px]">
                  <label class="text-xs text-gray-500 block mb-1">Duración (min)</label>
                  <input v-model.number="editDurationMinutes" type="number" min="1" max="300"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-500" />
                </div>
              </div>
              <!-- Fila inferior: acciones -->
              <div class="flex items-center justify-end gap-2">
                <button @click="editingId = null" class="text-gray-500 hover:text-gray-300 px-2 py-1.5 text-sm transition-colors">Cancelar</button>
                <button @click="saveEdit(entry.id)"
                  class="bg-accent-600 hover:bg-accent-500 text-white px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors">Guardar</button>
              </div>
            </div>
          </Transition>
        </div>

        <div v-if="ready && dayPlan.length === 0" class="text-center py-14">
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
        <div class="w-7 h-7 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
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
            :is="cell ? 'button' : 'div'"
            v-for="(cell, i) in calendarCells"
            :key="i"
            @click="cell && selectMonthDay(cell.date)"
            class="aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors"
            :class="
              !cell
                ? ''
                : selectedMonthDay === cell.date
                ? 'bg-accent-600 text-white'
                : isInSelectedWeek(cell.date)
                ? cell.isToday
                  ? 'ring-1 ring-accent-500 bg-accent-500/20 text-accent-300 cursor-pointer'
                  : cell.hasPlan
                  ? 'bg-accent-500/20 text-accent-300 cursor-pointer hover:bg-accent-500/30'
                  : 'bg-gray-800/60 text-gray-400 cursor-pointer hover:bg-gray-800'
                : cell.isToday
                ? 'ring-1 ring-accent-500 text-white cursor-pointer'
                : cell.hasPlan
                ? 'bg-accent-600/20 text-accent-300 cursor-pointer hover:bg-accent-600/30'
                : 'text-gray-600 hover:text-gray-400 cursor-pointer'
            "
          >
            <template v-if="cell">
              <span>{{ cell.day }}</span>
              <span v-if="cell.hasPlan" class="w-1.5 h-1.5 rounded-full mt-0.5"
                :class="selectedMonthDay === cell.date || isInSelectedWeek(cell.date) ? 'bg-accent-400' : 'bg-accent-500/70'" />
            </template>
          </component>
        </div>

        <!-- Resumen del mes -->
        <div class="mt-4 bg-gray-900 rounded-2xl border border-gray-800 px-4 py-4 text-center">
          <p class="text-2xl font-bold text-white">{{ monthPlanDates.length }}</p>
          <p class="text-xs text-gray-500 mt-1">Días planificados</p>
        </div>

        <!-- Panel resumen del día seleccionado -->
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="transition-all duration-150"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div v-if="selectedMonthDay" class="mt-4 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-white">{{ preferences.formatDate(selectedMonthDay) }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ orderedDays.find(d => d.dow === calcDayOfWeek(selectedMonthDay))?.full }}</p>
              </div>
              <button @click="selectedMonthDay = null; monthDayPlan = []" class="text-gray-600 hover:text-gray-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div v-if="monthDayLoading" class="flex justify-center py-6">
              <div class="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>

            <template v-else>
              <div v-if="monthDayPlan.length === 0" class="px-4 py-5 text-center text-gray-600 text-sm">
                Sin ejercicios planificados
              </div>
              <div v-else class="divide-y divide-gray-800">
                <div v-for="entry in monthDayPlan" :key="entry.id" class="px-4 py-3 flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ entry.exerciseName }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">
                      <template v-if="entry.isCardio">{{ entry.durationMinutes }} min</template>
                      <template v-else>
                        {{ entry.sets }} series × {{ entry.reps }} reps
                        <span v-if="entry.weightKg"> · {{ entry.weightKg }} kg</span>
                      </template>
                    </p>
                  </div>
                  <span class="text-xs text-gray-600 shrink-0">{{ entry.muscleGroup }}</span>
                </div>
              </div>
              <div class="px-4 py-3 border-t border-gray-800">
                <button @click="goToSelectedWeek"
                  class="w-full bg-accent-600 hover:bg-accent-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  Editar esta semana
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </template>
          </div>
        </Transition>
      </template>
    </div>

    <!-- ── MODAL GUARDAR RUTINA ─────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
        <div v-if="showSaveRoutine" class="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" @click.self="showSaveRoutine = false">
          <Transition enter-active-class="transition-all duration-200" enter-from-class="translate-y-full" leave-active-class="transition-all duration-150" leave-to-class="translate-y-full">
            <div v-if="showSaveRoutine" class="bg-gray-900 rounded-t-3xl w-full max-w-lg p-6 border-t border-gray-800">
              <div class="flex items-center justify-between mb-5">
                <h3 class="font-bold text-lg text-white">Guardar rutina</h3>
                <button @click="showSaveRoutine = false" class="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <p class="text-sm text-gray-500 mb-3">{{ dayPlan.length }} ejercicio{{ dayPlan.length !== 1 ? 's' : '' }} del {{ orderedDays.find(d => d.dow === selectedDay)?.full }}</p>
              <input
                v-model="routineName"
                type="text"
                placeholder="Nombre de la rutina"
                maxlength="50"
                class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent-500 transition-colors mb-4"
                @keyup.enter="saveRoutine"
                autofocus
              />
              <button
                @click="saveRoutine"
                :disabled="!routineName.trim() || routineSaving"
                class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white py-3 rounded-2xl font-semibold transition-colors"
              >
                {{ routineSaving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- ── MODAL CARGAR RUTINA ───────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
        <div v-if="showLoadRoutine" class="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" @click.self="showLoadRoutine = false">
          <Transition enter-active-class="transition-all duration-200" enter-from-class="translate-y-full" leave-active-class="transition-all duration-150" leave-to-class="translate-y-full">
            <div v-if="showLoadRoutine" class="bg-gray-900 rounded-t-3xl w-full max-w-lg p-6 border-t border-gray-800 max-h-[70vh] flex flex-col">
              <div class="flex items-center justify-between mb-5">
                <h3 class="font-bold text-lg text-white">Cargar rutina</h3>
                <button @click="showLoadRoutine = false" class="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div v-if="routines.length === 0" class="text-center py-8 text-gray-500 text-sm">
                No tienes rutinas guardadas aún
              </div>

              <div v-else class="overflow-y-auto space-y-2 flex-1 min-h-0">
                <div
                  v-for="r in routines"
                  :key="r.id"
                  class="flex items-center gap-3 bg-gray-800 rounded-2xl px-4 py-3"
                >
                  <button
                    @click="applyRoutine(r.id)"
                    :disabled="routineLoading"
                    class="flex-1 text-left"
                  >
                    <p class="text-sm font-semibold text-white">{{ r.name }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">{{ r.exerciseCount }} ejercicio{{ r.exerciseCount !== 1 ? 's' : '' }}</p>
                  </button>
                  <button
                    @click="deleteRoutine(r.id)"
                    class="text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              <p v-if="routines.length > 0" class="text-xs text-gray-600 text-center mt-4">Tocar una rutina reemplaza los ejercicios del día actual</p>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- ── MODAL AGREGAR (dos pasos) ────────────────────────────────────── -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
        <div v-if="showAddModal" class="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" @click.self="showAddModal = false; resetAddModal()">
          <Transition enter-active-class="transition-all duration-200" enter-from-class="translate-y-full" leave-active-class="transition-all duration-150" leave-to-class="translate-y-full">
            <div v-if="showAddModal" class="bg-gray-900 rounded-t-3xl w-full max-w-lg max-h-[88vh] flex flex-col border-t border-gray-800">

              <!-- Header -->
              <div class="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
                <div class="flex items-center gap-3">
                  <button v-if="addStep === 'config'" @click="addStep = 'search'" class="text-gray-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  <div>
                    <h3 class="font-bold text-white leading-tight">
                      {{ addStep === 'search' ? 'Elegir ejercicio' : addExerciseName }}
                    </h3>
                    <p class="text-xs text-gray-500 mt-0.5">{{ orderedDays.find(d => d.dow === selectedDay)?.full }}</p>
                  </div>
                </div>
                <button @click="showAddModal = false; resetAddModal()" class="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <!-- PASO 1: Buscar y elegir ejercicio -->
              <template v-if="addStep === 'search'">
                <div class="px-6 pb-3 shrink-0 space-y-3">
                  <!-- Búsqueda -->
                  <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Buscar ejercicio..."
                    class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent-500 transition-colors"
                    autofocus
                  />
                  <!-- Filtros de grupo muscular -->
                  <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    <button @click="modalFilterGroup = 'all'"
                      class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                      :class="modalFilterGroup === 'all' ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'">
                      Todos
                    </button>
                    <button v-for="g in MUSCLE_GROUPS" :key="g.id" @click="modalFilterGroup = g.id"
                      class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                      :class="modalFilterGroup === g.id ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'">
                      {{ g.label }}
                    </button>
                  </div>
                </div>
                <!-- Lista -->
                <div class="overflow-y-auto flex-1 min-h-0 px-6 pb-6 space-y-1">
                  <button
                    v-for="ex in availableExercises"
                    :key="ex.id"
                    @click="selectExercise(ex)"
                    class="w-full text-left px-4 py-3 rounded-xl text-sm bg-gray-800 hover:bg-gray-750 border border-transparent hover:border-gray-600 transition-all flex items-center justify-between"
                  >
                    <span>
                      <span class="font-semibold text-white">{{ ex.name }}</span>
                      <span class="text-xs ml-2 text-gray-500">{{ ex.muscleGroup }}</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                  <p v-if="availableExercises.length === 0" class="text-gray-600 text-sm text-center py-8">
                    Sin ejercicios disponibles
                  </p>
                </div>
              </template>

              <!-- PASO 2: Configurar -->
              <template v-else>
                <div class="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
                  <!-- Toggle cardio arriba a la derecha -->
                  <div class="flex justify-end">
                    <button type="button" @click="addIsCardio = !addIsCardio"
                      class="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors"
                      :class="addIsCardio ? 'border-accent-500 text-accent-400 bg-accent-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-600'">
                      🏃 Usa tiempo (cardio)
                    </button>
                  </div>

                  <!-- Inputs Fuerza -->
                  <div v-if="!addIsCardio" class="flex gap-3">
                    <div class="flex-1">
                      <label class="text-sm text-gray-400 block mb-1.5">Series</label>
                      <input v-model.number="addSets" type="number" min="1" max="20"
                        class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors" />
                    </div>
                    <div class="flex-1">
                      <label class="text-sm text-gray-400 block mb-1.5">Reps</label>
                      <input v-model.number="addReps" type="number" min="1" max="200"
                        class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors" />
                    </div>
                    <div class="flex-1">
                      <label class="text-sm text-gray-400 block mb-1.5">Peso (kg)</label>
                      <input v-model.number="addWeightKg" type="number" min="0" step="0.5" placeholder="—"
                        class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors" />
                    </div>
                  </div>

                  <!-- Inputs Cardio: duración alineada a la derecha -->
                  <div v-else class="flex justify-end">
                    <div class="w-[180px]">
                      <label class="text-sm text-gray-400 block mb-1.5">Duración (min)</label>
                      <input v-model.number="addDurationMinutes" type="number" min="1" max="300"
                        class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors" />
                    </div>
                  </div>

                  <button
                    @click="addToPlan"
                    :disabled="saving"
                    class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white py-3.5 rounded-2xl font-semibold transition-colors"
                  >
                    {{ saving ? 'Guardando...' : 'Agregar al plan' }}
                  </button>
                </div>
              </template>

            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
