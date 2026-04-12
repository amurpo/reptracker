<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'

const router = useRouter()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.auth.forgotPassword(email.value)
    sent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-6">
    <div class="w-full max-w-sm">
      <button class="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors" @click="router.push('/login')">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Volver al inicio de sesión
      </button>

      <div v-if="sent" class="text-center">
        <div class="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Revisa tu email</h2>
        <p class="text-gray-500 text-sm leading-relaxed">
          Si <span class="text-gray-300 font-medium">{{ email }}</span> está registrado, recibirás un enlace para restablecer tu contraseña.
        </p>
      </div>

      <template v-else>
        <h1 class="text-2xl font-bold text-white mb-2">¿Olvidaste tu contraseña?</h1>
        <p class="text-gray-500 text-sm mb-6">Ingresa tu email y te enviaremos un enlace para restablecerla.</p>

        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              placeholder="tu@email.com"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>

          <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            {{ loading ? 'Enviando...' : 'Enviar enlace' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
