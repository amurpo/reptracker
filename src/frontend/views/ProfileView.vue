<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { usePreferencesStore, THEMES, applyTheme } from '../stores/preferences'

const auth = useAuthStore()
const preferences = usePreferencesStore()

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

// Avatar
const avatarSrc = ref<string | null>(null)
const avatarUploading = ref(false)
const avatarError = ref('')
const avatarSaved = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function onAvatarClick() {
  avatarError.value = ''
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarError.value = ''

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    avatarError.value = 'Solo se aceptan JPG, PNG o WebP'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'La imagen no puede superar 5 MB'
    return
  }

  avatarUploading.value = true
  try {
    // Usar FileReader (data:) en lugar de createObjectURL (blob:) para respetar CSP
    const dataUrl = await new Promise<string>((res, rej) => {
      const reader = new FileReader()
      reader.onload = (ev) => res(ev.target!.result as string)
      reader.onerror = () => rej(new Error('No se pudo leer la imagen'))
      reader.readAsDataURL(file)
    })

    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('No se pudo cargar la imagen'))
      img.src = dataUrl
    })

    if (img.width > 4000 || img.height > 4000) {
      avatarError.value = 'Las dimensiones no pueden superar 4000 × 4000 px'
      return
    }

    const size = Math.min(img.width, img.height)
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200
    canvas.getContext('2d')!.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200)
    const base64 = canvas.toDataURL('image/jpeg', 0.85)

    await api.profile.uploadAvatar(base64)
    avatarSrc.value = base64
    avatarSaved.value = true
    setTimeout(() => { avatarSaved.value = false }, 2500)
  } catch (err) {
    avatarError.value = err instanceof Error ? err.message : 'Error al subir la imagen'
  } finally {
    avatarUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const name = ref('')
const age = ref<number | null>(null)
const weightKg = ref<number | null>(null)
const heightCm = ref<number | null>(null)
const sex = ref<string | null>(null)
const dateFormat = ref('dd-mm-yyyy')
const timeFormat = ref('24h')
const weekStart = ref(0)
const theme = ref(preferences.theme || 'indigo')
const themeSaving = ref(false)

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
    heightCm.value = profile.heightCm
    sex.value = profile.sex
    dateFormat.value = profile.dateFormat
    timeFormat.value = profile.timeFormat
    weekStart.value = profile.weekStart
    theme.value = profile.theme || 'indigo'
    const { avatar } = await api.profile.getAvatar()
    avatarSrc.value = avatar
  } finally {
    loading.value = false
  }
})

async function saveTheme(themeId: string) {
  theme.value = themeId
  applyTheme(themeId)
  themeSaving.value = true
  try {
    await api.profile.update({ theme: themeId })
    preferences.theme = themeId
    localStorage.setItem('theme', themeId)
  } catch {
    // fallo silencioso — el tema visual ya se aplicó
  } finally {
    themeSaving.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    await api.profile.update({
      name: name.value || undefined,
      age: age.value ?? undefined,
      weightKg: weightKg.value ?? undefined,
      heightCm: heightCm.value ?? undefined,
      sex: sex.value ?? undefined,
      dateFormat: dateFormat.value,
      timeFormat: timeFormat.value,
      weekStart: weekStart.value,
      theme: theme.value,
    })
    preferences.dateFormat = dateFormat.value
    preferences.timeFormat = timeFormat.value
    preferences.weekStart = weekStart.value
    preferences.theme = theme.value
    localStorage.setItem('dateFormat', dateFormat.value)
    localStorage.setItem('timeFormat', timeFormat.value)
    localStorage.setItem('weekStart', String(weekStart.value))
    applyTheme(theme.value)
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
      <div class="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <template v-else>
      <!-- Avatar -->
      <input
        ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;"
        @change="onFileChange"
      />
      <div class="flex items-center gap-4 mb-8">
        <button
          class="relative w-16 h-16 rounded-full overflow-hidden shrink-0 group focus:outline-none"
          :disabled="avatarUploading"
          @click="onAvatarClick"
        >
          <img v-if="avatarSrc" :src="avatarSrc" class="w-full h-full object-cover" alt="Avatar" />
          <div v-else class="w-full h-full bg-accent-600 flex items-center justify-center text-2xl font-bold text-white select-none">
            {{ auth.user?.email?.[0].toUpperCase() }}
          </div>
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg v-if="!avatarUploading" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </button>
        <div>
          <p class="font-semibold text-white">{{ name || 'Sin nombre' }}</p>
          <p class="text-sm text-gray-500">{{ auth.user?.email }}</p>
          <p v-if="avatarError" class="text-xs text-red-400 mt-1">{{ avatarError }}</p>
          <p v-else class="text-xs text-gray-600 mt-1">Toca para cambiar la foto</p>
        </div>
      </div>

      <!-- Form -->
      <form class="space-y-4" @submit.prevent="save">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Nombre</label>
          <input
            v-model="name"
            type="text"
            placeholder="Tu nombre"
            maxlength="50"
            class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
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
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
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
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Altura (cm)</label>
            <input
              v-model.number="heightCm"
              type="number"
              min="50"
              max="300"
              placeholder="—"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Sexo</label>
            <select
              v-model="sex"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
            >
              <option :value="null">—</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        <!-- Formato de fecha y hora -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Formato de fecha</label>
            <select
              v-model="dateFormat"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
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
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
            >
              <option value="24h">24 horas</option>
              <option value="12h">12 horas (AM/PM)</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Inicio de semana</label>
          <select
            v-model.number="weekStart"
            class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 transition-colors"
          >
            <option :value="0">Lunes</option>
            <option :value="1">Domingo</option>
          </select>
        </div>

        <!-- Tema de color -->
        <div>
          <label class="block text-sm text-gray-400 mb-3">Tema de color</label>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="t in THEMES"
              :key="t.id"
              type="button"
              class="relative text-left p-3 rounded-2xl border transition-all"
              :class="theme === t.id
                ? 'bg-gray-800 border-white/30 ring-1 ring-white/20'
                : 'bg-gray-900 border-gray-800 hover:border-gray-600'"
              @click="saveTheme(t.id)"
            >
              <!-- Checkmark -->
              <svg v-if="theme === t.id" xmlns="http://www.w3.org/2000/svg" class="absolute top-2.5 right-2.5 w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <p class="text-sm font-semibold text-white mb-2">{{ t.label }}</p>
              <!-- Swatches -->
              <div class="flex gap-1">
                <span
                  v-for="(color, i) in t.swatches"
                  :key="i"
                  class="flex-1 h-3 rounded-sm"
                  :style="{ backgroundColor: color }"
                />
              </div>
            </button>
          </div>
        </div>

        <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </form>

      <!-- Cambiar contraseña -->
      <div class="mt-8 pt-6 border-t border-gray-800">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Cambiar contraseña</h2>
        <form class="space-y-4" @submit.prevent="changePassword">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Contraseña actual</label>
            <input
              v-model="currentPassword"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
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
                class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
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
                class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
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
        v-if="saved || passwordSaved || avatarSaved"
        class="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {{ passwordSaved ? 'Contraseña actualizada' : avatarSaved ? 'Foto actualizada' : 'Cambios guardados' }}
      </div>
    </Transition>
  </div>
</template>
