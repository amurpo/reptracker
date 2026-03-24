<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = mode.value === 'login'
      ? await api.auth.login(email.value, password.value)
      : await api.auth.register(email.value, password.value)
    auth.setAuth(res.token, res.user)
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-indigo-500/20 rounded-3xl mb-4">
          <img src="/dumbbell.svg" class="w-12 h-12" alt="RepTracker" />
        </div>
        <h1 class="text-3xl font-bold text-white">RepTracker</h1>
        <p class="text-gray-500 text-sm mt-1">Tu entrenamiento, organizado</p>
      </div>

      <!-- Tabs -->
      <div class="flex bg-gray-900 rounded-2xl p-1 mb-6 border border-gray-800">
        <button
          @click="mode = 'login'; error = ''"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          :class="mode === 'login' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'"
        >
          Iniciar sesión
        </button>
        <button
          @click="mode = 'register'; error = ''"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          :class="mode === 'register' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'"
        >
          Registrarse
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Email</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Contraseña</label>
          <input
            v-model="password"
            type="password"
            required
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="••••••••"
          />
          <p v-if="mode === 'register'" class="text-xs text-gray-600 mt-1.5 pl-1">Mínimo 8 caracteres</p>
        </div>

        <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors mt-2"
        >
          {{ loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
        </button>
      </form>
    </div>
  </div>
</template>
