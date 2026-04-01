<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { usePreferencesStore } from '../stores/preferences'

const auth = useAuthStore()
const preferences = usePreferencesStore()

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

const name = ref('')
const age = ref<number | null>(null)
const weightKg = ref<number | null>(null)
const dateFormat = ref('dd-mm-yyyy')
const timeFormat = ref('24h')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')

async function changePassword() {
  passwordError.value = ''
  passwordSaved.value = false
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Las contraseñas no coinciden'
    return
  }
  passwordSaving.value = true
  try {
    await api.profile.changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordSaved.value = true
    setTimeout(() => { passwordSaved.value = false }, 2500)
  } catch (e) {
    passwordError.value = e instanceof Error ? e.message : 'Error al cambiar contraseña'
  } finally {
    passwordSaving.value = false
  }
}

onMounted(async () => {
  try {
    const profile = await api.profile.get()
    name.value = profile.name ?? ''
    age.value = profile.age
    weightKg.value = profile.weightKg
    dateFormat.value = profile.dateFormat
    timeFormat.value = profile.timeFormat
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    await api.profile.update({
      name: name.value || undefined,
      age: age.value ?? undefined,
      weightKg: weightKg.value ?? undefined,
      dateFormat: dateFormat.value,
      timeFormat: timeFormat.value,
    })
    preferences.dateFormat = dateFormat.value
    preferences.timeFormat = timeFormat.value
    localStorage.setItem('dateFormat', dateFormat.value)
    localStorage.setItem('timeFormat', timeFormat.value)
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-lg lg:max-w-2xl mx-auto px-4 pt-6 pb-8">
    <h1 class="text-xl font-bold mb-6">Perfil</h1>

    <div v-if="loading" class="flex justify-center py-24">
      <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <template v-else>
      <!-- Avatar -->
      <div class="flex items-center gap-4 mb-8">
        <div class="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white select-none">
          {{ auth.user?.email?.[0].toUpperCase() }}
        </div>
        <div>
          <p class="font-semibold text-white">{{ name || 'Sin nombre' }}</p>
          <p class="text-sm text-gray-500">{{ auth.user?.email }}</p>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="save" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Nombre</label>
          <input
            v-model="name"
            type="text"
            placeholder="Tu nombre"
            class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Edad</label>
            <input
              v-model.number="age"
              type="number"
              min="1"
              max="120"
              placeholder="—"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Peso (kg)</label>
            <input
              v-model.number="weightKg"
              type="number"
              min="1"
              max="500"
              step="0.1"
              placeholder="—"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <!-- Formato de fecha y hora -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Formato de fecha</label>
            <select
              v-model="dateFormat"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="dd-mm-yyyy">DD-MM-YYYY</option>
              <option value="mm-dd-yyyy">MM-DD-YYYY</option>
              <option value="yyyy-mm-dd">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Formato de hora</label>
            <select
              v-model="timeFormat"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="24h">24 horas</option>
              <option value="12h">12 horas (AM/PM)</option>
            </select>
          </div>
        </div>

        <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </form>

      <!-- Cambiar contraseña -->
      <div class="mt-8 pt-6 border-t border-gray-800">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Cambiar contraseña</h2>
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Contraseña actual</label>
            <input
              v-model="currentPassword"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Nueva contraseña</label>
              <input
                v-model="newPassword"
                type="password"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Confirmar</label>
              <input
                v-model="confirmPassword"
                type="password"
                required
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div v-if="passwordError" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
            {{ passwordError }}
          </div>

          <button
            type="submit"
            :disabled="passwordSaving"
            class="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            {{ passwordSaving ? 'Guardando...' : 'Cambiar contraseña' }}
          </button>
        </form>
      </div>
    </template>

    <!-- Toast -->
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-300"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="saved || passwordSaved"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {{ passwordSaved ? 'Contraseña actualizada' : 'Cambios guardados' }}
      </div>
    </Transition>
  </div>
</template>
