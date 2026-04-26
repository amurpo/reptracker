<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api, matchesSearch, type Exercise } from '../lib/api'
import ExerciseImage from '../components/ExerciseImage.vue'

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

const MUSCLE_COLORS: Record<string, string> = {
  'pecho': 'text-rose-400',
  'hombros': 'text-orange-400',
  'tríceps': 'text-orange-300',
  'dorsales': 'text-blue-400',
  'bíceps': 'text-sky-400',
  'espalda media': 'text-blue-300',
  'lumbar': 'text-blue-300',
  'trapecios': 'text-sky-300',
  'antebrazos': 'text-sky-300',
  'cuádriceps': 'text-violet-400',
  'isquiotibiales': 'text-violet-300',
  'pantorrillas': 'text-violet-300',
  'glúteos': 'text-purple-400',
  'abductores': 'text-violet-300',
  'aductores': 'text-violet-300',
  'abdominales': 'text-amber-400',
  'cuello': 'text-gray-400',
}

const exercises = ref<Exercise[]>([])
const ready = ref(false)
const filter = ref('all')
const searchQuery = ref('')
const showAdd = ref(false)
const newName = ref('')
const newGroup = ref('')
const error = ref('')
const loading = ref(false)
const deletingId = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const editName = ref('')
const editGroup = ref('')
const editLoading = ref(false)
const editError = ref('')
const imageFileInput = ref<HTMLInputElement | null>(null)
const uploadingImageId = ref<number | null>(null)
const customImages = ref<Record<number, string>>({})
const newImageDataUrl = ref<string | null>(null)

function onNewImageFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
  if (file.size > 150_000) { alert('La imagen no puede superar 150 KB'); return }
  const reader = new FileReader()
  reader.onload = e => { newImageDataUrl.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

function startEdit(ex: Exercise) {
  editingId.value = ex.id
  editName.value = ex.name
  editGroup.value = ex.muscleGroup
  editError.value = ''
  // Cargar imagen custom si existe
  if (ex.imageUrl?.startsWith('kv:') && !customImages.value[ex.id]) {
    api.exercises.getImage(ex.id).then(r => {
      if (r.image) customImages.value[ex.id] = r.image
    })
  }
}

async function saveEdit(id: number) {
  if (!editName.value.trim() || !editGroup.value) return
  editLoading.value = true
  editError.value = ''
  try {
    const updated = await api.exercises.update(id, editName.value.trim(), editGroup.value)
    const idx = exercises.value.findIndex(e => e.id === id)
    if (idx !== -1) exercises.value[idx] = updated
    editingId.value = null
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Error'
  } finally {
    editLoading.value = false
  }
}

async function onImageFile(id: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
  if (file.size > 150_000) { alert('La imagen no puede superar 150 KB'); return }
  uploadingImageId.value = id
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      await api.exercises.uploadImage(id, dataUrl)
      customImages.value[id] = dataUrl
      const idx = exercises.value.findIndex(ex => ex.id === id)
      if (idx !== -1) exercises.value[idx] = { ...exercises.value[idx], imageUrl: `kv:${id}` }
      uploadingImageId.value = null
    }
    reader.readAsDataURL(file)
  } catch {
    uploadingImageId.value = null
  }
}

async function removeImage(id: number) {
  await api.exercises.deleteImage(id)
  delete customImages.value[id]
  const idx = exercises.value.findIndex(ex => ex.id === id)
  if (idx !== -1) exercises.value[idx] = { ...exercises.value[idx], imageUrl: null }
}

function exerciseImage(ex: Exercise): string | null {
  if (ex.imageUrl?.startsWith('kv:')) return customImages.value[ex.id] ?? null
  return ex.imageUrl ?? null
}

const filtered = computed(() => {
  let list = exercises.value
  if (filter.value === 'mine') list = list.filter(e => e.isCustom === 1)
  else if (filter.value !== 'all') list = list.filter(e => e.muscleGroup === filter.value)
  const q = searchQuery.value.trim()
  if (q) list = list.filter(e => matchesSearch(e.name, e.muscleGroup, q))
  return list
})

async function load() {
  exercises.value = await api.exercises.list()
  ready.value = true
  const withKv = exercises.value.filter(e => e.imageUrl?.startsWith('kv:'))
  await Promise.all(
    withKv.map(async (ex) => {
      const r = await api.exercises.getImage(ex.id)
      if (r.image) customImages.value[ex.id] = r.image
    })
  )
}

async function addExercise() {
  if (!newName.value.trim() || !newGroup.value) return
  error.value = ''
  loading.value = true
  try {
    const ex = await api.exercises.create(newName.value.trim(), newGroup.value)
    if (newImageDataUrl.value) {
      await api.exercises.uploadImage(ex.id, newImageDataUrl.value)
      customImages.value[ex.id] = newImageDataUrl.value
      ex.imageUrl = `kv:${ex.id}`
    }
    exercises.value.push(ex)
    newName.value = ''
    newGroup.value = ''
    newImageDataUrl.value = null
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
        class="bg-accent-600 hover:bg-accent-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        @click="showAdd = !showAdd"
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
            maxlength="50"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-accent-500 transition-colors"
            @keyup.enter="addExercise"
          />
          <select
            v-model="newGroup"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent-500 transition-colors"
          >
            <option value="" disabled>Grupo muscular</option>
            <option v-for="g in MUSCLE_GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
          <!-- Foto opcional -->
          <div class="flex items-center gap-3">
            <img v-if="newImageDataUrl" :src="newImageDataUrl" class="w-12 h-12 rounded-xl object-cover bg-gray-800 shrink-0" />
            <div v-else class="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-600 text-xl shrink-0">📷</div>
            <label class="cursor-pointer text-xs text-accent-400 hover:text-accent-300 transition-colors font-semibold">
              {{ newImageDataUrl ? 'Cambiar foto' : 'Agregar foto (opcional)' }}
              <input type="file" accept="image/*" class="hidden" @change="onNewImageFile" />
            </label>
            <button v-if="newImageDataUrl" class="text-xs text-red-500 hover:text-red-400 ml-auto" @click="newImageDataUrl = null">Quitar</button>
            <p v-else class="text-xs text-gray-600 ml-auto">máx 150 KB</p>
          </div>
          <div v-if="error" class="text-red-400 text-sm">{{ error }}</div>
          <div class="flex gap-2">
            <button
              :disabled="loading || !newName.trim() || !newGroup"
              class="flex-1 bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
              @click="addExercise"
            >
              {{ loading ? 'Guardando...' : 'Agregar' }}
            </button>
            <button
              class="px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 py-2.5 rounded-xl text-sm transition-colors"
              @click="showAdd = false; newName = ''; newGroup = ''; error = ''; newImageDataUrl = null"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Búsqueda -->
    <div class="relative mb-3">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
      </svg>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Buscar ejercicio..."
        class="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-500 transition-colors"
      />
    </div>

    <!-- Filter chips -->
    <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide lg:flex-wrap lg:overflow-x-visible">
      <button
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
        :class="filter === 'all' ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'"
        @click="filter = 'all'"
      >
        Todos
      </button>
      <button
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
        :class="filter === 'mine' ? 'bg-accent-600 text-white' : 'bg-accent-600/20 text-accent-400'"
        @click="filter = 'mine'"
      >
        ✦ Mis ejercicios
      </button>
      <button
        v-for="g in MUSCLE_GROUPS"
        :key="g.id"
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
        :class="filter === g.id ? 'bg-accent-600 text-white' : 'bg-gray-800 text-gray-400'"
        @click="filter = g.id"
      >
        {{ g.label }}
      </button>
    </div>

    <!-- Exercise list -->
    <div class="space-y-2">
      <div
        v-for="ex in filtered"
        :key="ex.id"
        class="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden"
      >
        <!-- Fila principal -->
        <div
          class="px-4 py-3.5 flex items-center justify-between cursor-pointer"
          @click="expandedId = expandedId === ex.id ? null : ex.id"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <!-- Miniatura -->
            <ExerciseImage
              :src="exerciseImage(ex)" :alt="ex.name"
              class="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-800"
            >
              <template #placeholder>
                <div class="w-10 h-10 rounded-xl bg-gray-800 shrink-0 flex items-center justify-center text-gray-600 text-lg">💪</div>
              </template>
            </ExerciseImage>
            <div class="min-w-0">
              <p class="font-semibold text-white text-sm">{{ ex.name }}</p>
              <p class="text-xs mt-0.5" :class="muscleColor(ex.muscleGroup)">
                {{ muscleLabel(ex.muscleGroup) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2" @click.stop>
            <div v-if="ex.isCustom === 1" class="flex items-center gap-1">
              <button
                class="text-gray-600 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-800"
                @click="editingId === ex.id ? editingId = null : startEdit(ex)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                :disabled="deletingId === ex.id"
                class="text-gray-700 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                @click="deleteExercise(ex.id)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <!-- Imagen expandida -->
        <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
          <div v-if="expandedId === ex.id && exerciseImage(ex)" class="border-t border-gray-800">
            <ExerciseImage
              :src="exerciseImage(ex)" :alt="ex.name" :animated="true"
              class="w-full max-h-72 object-contain bg-gray-950"
            />
          </div>
        </Transition>
        <!-- Formulario edición inline -->
        <Transition
          enter-active-class="transition-all duration-150"
          enter-from-class="opacity-0 -translate-y-1"
          leave-active-class="transition-all duration-100"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="editingId === ex.id" class="px-4 pb-4 border-t border-gray-800 pt-3 space-y-2">
            <input
              v-model="editName"
              type="text"
              placeholder="Nombre"
              maxlength="50"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-500 transition-colors"
              @keyup.enter="saveEdit(ex.id)"
            />
            <select
              v-model="editGroup"
              class="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-500 transition-colors"
            >
              <option value="" disabled>Grupo muscular</option>
              <option v-for="g in MUSCLE_GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
            </select>
            <!-- Foto personalizada -->
            <div class="flex items-center gap-2">
              <img v-if="customImages[ex.id]" :src="customImages[ex.id]" class="w-12 h-12 rounded-xl object-cover bg-gray-800" />
              <div v-else class="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-600 text-xl shrink-0">📷</div>
              <div class="flex flex-col gap-1">
                <label class="cursor-pointer text-xs text-accent-400 hover:text-accent-300 transition-colors font-semibold">
                  {{ uploadingImageId === ex.id ? 'Subiendo...' : customImages[ex.id] ? 'Cambiar foto' : 'Subir foto' }}
                  <input
                    ref="imageFileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    :disabled="uploadingImageId === ex.id"
                    @change="onImageFile(ex.id, $event)"
                  />
                </label>
                <button
                  v-if="customImages[ex.id]"
                  class="text-xs text-red-500 hover:text-red-400 transition-colors text-left"
                  @click="removeImage(ex.id)"
                >
                  Eliminar foto
                </button>
              </div>
              <p class="text-xs text-gray-600 ml-auto">máx 150 KB</p>
            </div>
            <div v-if="editError" class="text-red-400 text-xs">{{ editError }}</div>
            <div class="flex gap-2 justify-end">
              <button class="text-gray-500 hover:text-gray-300 px-3 py-1.5 text-sm transition-colors" @click="editingId = null">Cancelar</button>
              <button
                :disabled="editLoading || !editName.trim() || !editGroup"
                class="bg-accent-600 hover:bg-accent-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors"
                @click="saveEdit(ex.id)"
              >
                {{ editLoading ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <div v-if="ready && filtered.length === 0" class="text-center py-16">
        <div class="text-4xl mb-3">💪</div>
        <p class="text-gray-500 font-medium">Sin ejercicios</p>
        <p class="text-gray-600 text-sm mt-1">Toca "+ Nuevo" para crear uno</p>
      </div>
    </div>
  </div>
</template>
