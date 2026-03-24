<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, type PlanEntry, type Exercise } from '../lib/api'

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const todayDow = (() => {
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
})()

const selectedDay = ref(todayDow)
const plan = ref<PlanEntry[]>([])
const exercises = ref<Exercise[]>([])
const showAddModal = ref(false)
const addExerciseId = ref<number | null>(null)
const addSets = ref(3)
const addReps = ref(10)
const editingId = ref<number | null>(null)
const editSets = ref(3)
const editReps = ref(10)
const saving = ref(false)
const searchQuery = ref('')

const dayPlan = computed(() =>
  plan.value
    .filter((e) => e.dayOfWeek === selectedDay.value)
    .sort((a, b) => a.orderIndex - b.orderIndex)
)

const availableExercises = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return exercises.value.filter((e) => {
    if (dayPlan.value.find((p) => p.exerciseId === e.id)) return false
    if (!q) return true
    return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)
  })
})

const dayHasPlan = (day: number) => plan.value.some((e) => e.dayOfWeek === day)

async function load() {
  const [planData, exData] = await Promise.all([api.plan.get(), api.exercises.list()])
  plan.value = planData
  exercises.value = exData
}

async function addToPlan() {
  if (!addExerciseId.value) return
  saving.value = true
  try {
    const entry = await api.plan.add(selectedDay.value, addExerciseId.value, addSets.value, addReps.value)
    plan.value.push(entry)
    showAddModal.value = false
    addExerciseId.value = null
    addSets.value = 3
    addReps.value = 10
    searchQuery.value = ''
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
}

async function saveEdit(id: number) {
  const updated = await api.plan.update(id, editSets.value, editReps.value)
  const idx = plan.value.findIndex((e) => e.id === id)
  if (idx >= 0) {
    plan.value[idx] = { ...plan.value[idx], sets: updated.sets, reps: updated.reps }
  }
  editingId.value = null
}

onMounted(load)
</script>

<template>
  <div class="max-w-lg mx-auto">
    <!-- Sticky day selector -->
    <div class="sticky top-0 bg-gray-950 pt-4 pb-3 px-4 z-10 border-b border-gray-800/50">
      <h1 class="text-xl font-bold mb-3">Plan semanal</h1>
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="(day, i) in DAYS_SHORT"
          :key="i"
          @click="selectedDay = i"
          class="flex flex-col items-center py-2 rounded-xl text-xs font-semibold transition-all"
          :class="
            selectedDay === i
              ? 'bg-indigo-600 text-white'
              : i === todayDow
              ? 'bg-gray-900 text-indigo-400 ring-1 ring-indigo-500/40'
              : 'text-gray-600 hover:text-gray-300'
          "
        >
          {{ day }}
          <span
            v-if="dayHasPlan(i)"
            class="w-1 h-1 rounded-full mt-1"
            :class="selectedDay === i ? 'bg-white/50' : 'bg-indigo-500'"
          />
          <span v-else class="w-1 h-1 mt-1" />
        </button>
      </div>
    </div>

    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="font-semibold text-white">{{ DAYS_FULL[selectedDay] }}</h2>
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
              <p class="text-xs text-indigo-400 mt-0.5">{{ entry.sets }} series × {{ entry.reps }} reps</p>
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
                  <input
                    v-model.number="editSets"
                    type="number" min="1" max="20"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-500 block mb-1">Reps</label>
                  <input
                    v-model.number="editReps"
                    type="number" min="1" max="200"
                    class="w-full bg-gray-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  @click="saveEdit(entry.id)"
                  class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                >
                  OK
                </button>
                <button @click="editingId = null" class="text-gray-500 hover:text-gray-300 px-2 py-2 text-sm transition-colors">
                  ✕
                </button>
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

    <!-- Add modal (bottom sheet) -->
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
            <div v-if="showAddModal" class="bg-gray-900 rounded-t-3xl w-full p-6 max-h-[80vh] flex flex-col border-t border-gray-800">
              <div class="flex items-center justify-between mb-5">
                <h3 class="font-bold text-lg">Agregar a {{ DAYS_FULL[selectedDay] }}</h3>
                <button @click="showAddModal = false" class="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <div class="flex-1 overflow-y-auto space-y-4 min-h-0">
                <!-- Exercise selection -->
                <div>
                  <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Buscar ejercicio..."
                    class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors mb-3"
                    autofocus
                  />
                  <div class="space-y-2 max-h-52 overflow-y-auto">
                    <button
                      v-for="ex in availableExercises"
                      :key="ex.id"
                      @click="addExerciseId = ex.id"
                      class="w-full text-left px-4 py-3 rounded-xl text-sm transition-all border"
                      :class="
                        addExerciseId === ex.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-gray-800 border-transparent text-gray-300 hover:border-gray-600'
                      "
                    >
                      <span class="font-semibold">{{ ex.name }}</span>
                      <span class="text-xs ml-2 text-gray-500">{{ ex.muscleGroup }}</span>
                    </button>
                    <p v-if="availableExercises.length === 0" class="text-gray-600 text-sm px-2 py-3 text-center">
                      Todos tus ejercicios ya están en este día
                    </p>
                  </div>
                </div>

                <!-- Sets & Reps -->
                <div class="flex gap-4">
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Series</label>
                    <input
                      v-model.number="addSets"
                      type="number" min="1" max="20"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="text-sm text-gray-400 block mb-1.5">Reps</label>
                    <input
                      v-model.number="addReps"
                      type="number" min="1" max="200"
                      class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
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
