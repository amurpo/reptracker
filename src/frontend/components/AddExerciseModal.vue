<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api, matchesSearch, type PlanEntry, type Exercise } from '../lib/api'
import ExerciseImage from './ExerciseImage.vue'

const MUSCLE_COLORS: Record<string, string> = {
  'pecho': 'text-rose-400', 'hombros': 'text-orange-400', 'tríceps': 'text-orange-300',
  'dorsales': 'text-blue-400', 'bíceps': 'text-sky-400', 'espalda media': 'text-blue-300',
  'lumbar': 'text-blue-300', 'trapecios': 'text-sky-300', 'antebrazos': 'text-sky-300',
  'cuádriceps': 'text-violet-400', 'isquiotibiales': 'text-violet-300', 'pantorrillas': 'text-violet-300',
  'glúteos': 'text-purple-400', 'abductores': 'text-violet-300', 'aductores': 'text-violet-300',
  'abdominales': 'text-amber-400', 'cuello': 'text-gray-400',
}
const muscleColor = (id: string) => MUSCLE_COLORS[id] ?? 'text-gray-400'

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

const props = defineProps<{
  show: boolean
  exercises: Exercise[]
  dayPlan: PlanEntry[]
  selectedDay: number
  dayLabel: string
  currentWeekStart: string
}>()

const emit = defineEmits<{
  close: []
  added: [entry: PlanEntry]
}>()

const step = ref<'search' | 'config'>('search')
const exerciseId = ref<number | null>(null)
const exerciseName = ref('')
const exerciseImageUrl = ref<string | null>(null)
const sets = ref(3)
const reps = ref(10)
const repsConfig = ref<number[] | null>(null)
const weightKg = ref<number | null>(null)
const isCardio = ref(false)
const durationMinutes = ref<number | null>(30)
const saving = ref(false)
const searchQuery = ref('')
// Filtrar la lista completa en cada tecla se siente lento; se espera una
// pausa breve en el tipeo antes de aplicar el filtro.
const debouncedQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedQuery.value = q }, 150)
})
const filterGroup = ref('all')
const customImages = ref<Record<number, string>>({})

watch(() => props.show, async (visible) => {
  if (!visible) return
  const kvExercises = props.exercises.filter(e => e.imageUrl?.startsWith('kv:') && !customImages.value[e.id])
  await Promise.all(kvExercises.map(async (e) => {
    const r = await api.exercises.getImage(e.id)
    if (r.image) customImages.value[e.id] = r.image
  }))
})

function exerciseImage(ex: Exercise): string | null {
  if (ex.imageUrl?.startsWith('kv:')) return customImages.value[ex.id] ?? null
  return ex.imageUrl
}

const available = computed(() => {
  const q = debouncedQuery.value.toLowerCase().trim()
  return props.exercises.filter((e) => {
    if (props.dayPlan.find((p) => p.exerciseId === e.id)) return false
    if (filterGroup.value === 'mine') return e.isCustom === 1
    if (filterGroup.value !== 'all' && e.muscleGroup !== filterGroup.value) return false
    if (!q) return true
    return matchesSearch(e, q)
  })
})

function selectExercise(ex: Exercise) {
  exerciseId.value = ex.id
  exerciseName.value = ex.name
  exerciseImageUrl.value = exerciseImage(ex)
  step.value = 'config'
}

function enableRepsConfig() {
  repsConfig.value = Array(sets.value).fill(reps.value)
}
function disableRepsConfig() {
  repsConfig.value = null
}
function updateRepsConfig(i: number, v: number) {
  if (!repsConfig.value) return
  repsConfig.value = repsConfig.value.map((x, idx) => idx === i ? v : x)
}

watch(sets, (n) => {
  if (!repsConfig.value) return
  const cur = repsConfig.value
  repsConfig.value = n > cur.length
    ? [...cur, ...Array(n - cur.length).fill(reps.value)]
    : cur.slice(0, n)
})

async function addToPlan() {
  if (!exerciseId.value) return
  saving.value = true
  try {
    const entry = await api.plan.add(
      props.currentWeekStart,
      props.selectedDay,
      exerciseId.value,
      sets.value,
      isCardio.value ? 1 : reps.value,
      isCardio.value ? null : repsConfig.value,
      isCardio.value ? null : weightKg.value,
      isCardio.value ? 1 : 0,
      isCardio.value ? durationMinutes.value : null,
    )
    emit('added', entry)
    close()
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
  step.value = 'search'
  exerciseId.value = null
  exerciseName.value = ''
  exerciseImageUrl.value = null
  sets.value = 3
  reps.value = 10
  repsConfig.value = null
  weightKg.value = null
  isCardio.value = false
  durationMinutes.value = 30
  clearTimeout(searchTimer)
  searchQuery.value = ''
  debouncedQuery.value = ''
  filterGroup.value = 'all'
}
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
      <div v-if="show" class="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" @click.self="close">
        <Transition enter-active-class="transition-all duration-200" enter-from-class="translate-y-full" leave-active-class="transition-all duration-150" leave-to-class="translate-y-full">
          <div v-if="show" class="bg-gray-900 rounded-t-3xl w-full max-w-lg max-h-[88dvh] flex flex-col border-t border-gray-800">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <div class="flex items-center gap-3">
                <button v-if="step === 'config'" class="text-gray-400 hover:text-white transition-colors" @click="step = 'search'">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                  <h3 class="font-bold text-white leading-tight">{{ step === 'search' ? 'Elegir ejercicio' : exerciseName }}</h3>
                  <p class="text-xs text-gray-500 mt-0.5">{{ dayLabel }}</p>
                </div>
              </div>
              <button class="text-gray-500 hover:text-gray-300 transition-colors" @click="close">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- PASO 1: buscar -->
            <template v-if="step === 'search'">
              <div class="px-6 pb-3 shrink-0 space-y-3">
                <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="Buscar ejercicio..."
                  class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent-500 transition-colors"
                  autofocus
                />
                <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1 lg:flex-wrap lg:overflow-x-visible">
                  <button
                    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    :class="filterGroup === 'all' ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'"
                    @click="filterGroup = 'all'"
                  >Todos</button>
                  <button
                    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    :class="filterGroup === 'mine' ? 'bg-accent-600 text-white' : 'bg-accent-600/20 text-accent-400'"
                    @click="filterGroup = 'mine'"
                  >✦ Mis ejercicios</button>
                  <button
                    v-for="g in MUSCLE_GROUPS" :key="g.id"
                    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    :class="filterGroup === g.id ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'"
                    @click="filterGroup = g.id"
                  >{{ g.label }}</button>
                </div>
              </div>

              <div class="overflow-y-auto flex-1 min-h-0 px-6 pb-6 space-y-1">
                <button
                  v-for="ex in available"
                  :key="ex.id"
                  class="w-full text-left px-3 py-2.5 rounded-xl text-sm bg-gray-800 border border-transparent hover:border-gray-600 transition-all flex items-center gap-3"
                  @click="selectExercise(ex)"
                >
                  <ExerciseImage :src="exerciseImage(ex)" class="w-10 h-10 rounded-lg object-contain shrink-0 bg-gray-900">
                    <template #placeholder>
                      <div class="w-10 h-10 rounded-lg bg-gray-700 shrink-0 flex items-center justify-center text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                      </div>
                    </template>
                  </ExerciseImage>
                  <span class="flex-1 min-w-0">
                    <span class="font-semibold text-white block truncate">{{ ex.name }}</span>
                    <span class="text-xs" :class="muscleColor(ex.muscleGroup)">{{ ex.muscleGroup }}</span>
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                <p v-if="available.length === 0" class="text-gray-600 text-sm text-center py-8">
                  Sin ejercicios disponibles
                </p>
              </div>
            </template>

            <!-- PASO 2: configurar -->
            <template v-else>
              <div class="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
                <ExerciseImage
                  v-if="exerciseImageUrl"
                  :src="exerciseImageUrl"
                  :animated="true"
                  class="w-full rounded-xl"
                />

                <div class="flex justify-end">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors"
                    :class="isCardio ? 'border-accent-500 text-accent-400 bg-accent-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-600'"
                    @click="isCardio = !isCardio"
                  >🏃 Usa tiempo (cardio)</button>
                </div>

                <div v-if="!isCardio" class="flex gap-3">
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Series</label>
                    <input
                      v-model.number="sets" type="number" min="1" max="20"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Reps</label>
                    <input
                      v-model.number="reps" type="number" min="1" max="200"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Peso (kg)</label>
                    <input
                      v-model.number="weightKg" type="number" min="0" step="0.5" placeholder="—"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
                    />
                  </div>
                </div>

                <div v-if="!isCardio && sets > 1">
                  <div v-if="!repsConfig" class="flex">
                    <button type="button" class="text-sm text-gray-500 hover:text-accent-400 transition-colors" @click="enableRepsConfig">
                      + Personalizar reps por serie
                    </button>
                  </div>
                  <div v-else>
                    <div class="flex items-center justify-between mb-3">
                      <label class="text-sm text-gray-400">Reps por serie</label>
                      <button type="button" class="text-xs text-gray-600 hover:text-red-400 transition-colors" @click="disableRepsConfig">Quitar</button>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                      <div v-for="(_, i) in repsConfig" :key="i" class="text-center">
                        <span class="text-xs text-gray-600 block mb-1">{{ i + 1 }}</span>
                        <input
                          type="number" :value="repsConfig[i]" min="1" max="200"
                          class="w-14 bg-gray-800 border border-gray-700 rounded-xl px-1 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500 transition-colors"
                          @change="updateRepsConfig(i, Number(($event.target as HTMLInputElement).value))"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="isCardio" class="flex justify-end">
                  <div class="w-[180px]">
                    <label class="text-sm text-gray-400 block mb-1.5">Duración (min)</label>
                    <input
                      v-model.number="durationMinutes" type="number" min="1" max="300"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  :disabled="saving"
                  class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white py-3.5 rounded-2xl font-semibold transition-colors"
                  @click="addToPlan"
                >{{ saving ? 'Guardando...' : 'Agregar al plan' }}</button>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
