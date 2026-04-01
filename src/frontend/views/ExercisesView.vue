<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, type Exercise } from '../lib/api'

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
]

const MUSCLE_COLORS: Record<string, string> = {
  // Push — rojo/naranja
  'pecho': 'text-rose-400',
  'hombros': 'text-orange-400',
  'tríceps': 'text-orange-300',
  // Pull — azul
  'dorsales': 'text-blue-400',
  'bíceps': 'text-sky-400',
  'espalda media': 'text-blue-300',
  'lumbar': 'text-blue-300',
  'trapecios': 'text-sky-300',
  'antebrazos': 'text-sky-300',
  // Piernas — violeta
  'cuádriceps': 'text-violet-400',
  'isquiotibiales': 'text-violet-300',
  'pantorrillas': 'text-violet-300',
  'glúteos': 'text-purple-400',
  // Core — ámbar
  'abdominales': 'text-amber-400',
}

const exercises = ref<Exercise[]>([])
const filter = ref('all')
const showAdd = ref(false)
const newName = ref('')
const newGroup = ref('')
const error = ref('')
const loading = ref(false)
const deletingId = ref<number | null>(null)

const filtered = computed(() =>
  filter.value === 'all'
    ? exercises.value
    : exercises.value.filter((e) => e.muscleGroup === filter.value)
)

async function load() {
  exercises.value = await api.exercises.list()
}

async function addExercise() {
  if (!newName.value.trim() || !newGroup.value) return
  error.value = ''
  loading.value = true
  try {
    const ex = await api.exercises.create(newName.value.trim(), newGroup.value)
    exercises.value.push(ex)
    newName.value = ''
    newGroup.value = ''
    showAdd.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error'
  } finally {
    loading.value = false
  }
}

async function deleteExercise(id: number) {
  deletingId.value = id
  try {
    await api.exercises.delete(id)
    exercises.value = exercises.value.filter((e) => e.id !== id)
  } finally {
    deletingId.value = null
  }
}

const muscleLabel = (id: string) => MUSCLE_GROUPS.find((m) => m.id === id)?.label ?? id
const muscleColor = (id: string) => MUSCLE_COLORS[id] ?? 'text-gray-400'

onMounted(load)
</script>

<template>
  <div class="p-4 max-w-lg lg:max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5 pt-2">
      <h1 class="text-xl font-bold">Ejercicios</h1>
      <button
        @click="showAdd = !showAdd"
        class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
      >
        + Nuevo
      </button>
    </div>

    <!-- Add form -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition-all duration-150"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="showAdd" class="bg-gray-900 rounded-2xl p-4 mb-4 border border-gray-800">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Nuevo ejercicio</h2>
        <div class="space-y-3">
          <input
            v-model="newName"
            type="text"
            placeholder="Nombre del ejercicio"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            @keyup.enter="addExercise"
          />
          <select
            v-model="newGroup"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="" disabled>Grupo muscular</option>
            <option v-for="g in MUSCLE_GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
          <div v-if="error" class="text-red-400 text-sm">{{ error }}</div>
          <div class="flex gap-2">
            <button
              @click="addExercise"
              :disabled="loading || !newName.trim() || !newGroup"
              class="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {{ loading ? 'Guardando...' : 'Agregar' }}
            </button>
            <button
              @click="showAdd = false; newName = ''; newGroup = ''; error = ''"
              class="px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 py-2.5 rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Filter chips -->
    <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      <button
        @click="filter = 'all'"
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
        :class="filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'"
      >
        Todos
      </button>
      <button
        v-for="g in MUSCLE_GROUPS"
        :key="g.id"
        @click="filter = g.id"
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
        :class="filter === g.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'"
      >
        {{ g.label }}
      </button>
    </div>

    <!-- Exercise list -->
    <div class="space-y-2">
      <div
        v-for="ex in filtered"
        :key="ex.id"
        class="bg-gray-900 rounded-2xl px-4 py-3.5 flex items-center justify-between border border-gray-800"
      >
        <div>
          <p class="font-semibold text-white text-sm">{{ ex.name }}</p>
          <p class="text-xs mt-0.5" :class="muscleColor(ex.muscleGroup)">
            {{ muscleLabel(ex.muscleGroup) }}
          </p>
        </div>
        <button
          v-if="ex.isCustom === 1"
          @click="deleteExercise(ex.id)"
          :disabled="deletingId === ex.id"
          class="text-gray-700 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      <div v-if="filtered.length === 0" class="text-center py-16">
        <div class="text-4xl mb-3">💪</div>
        <p class="text-gray-500 font-medium">Sin ejercicios</p>
        <p class="text-gray-600 text-sm mt-1">Toca "+ Nuevo" para crear uno</p>
      </div>
    </div>
  </div>
</template>
