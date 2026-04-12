<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'

const route = useRoute()
const router = useRouter()

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const done = ref(false)
const error = ref('')
const token = ref('')

onMounted(() => {
  token.value = route.query.token as string
  if (!token.value) error.value = 'Enlace inválido'
})

async function submit() {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  loading.value = true
  try {
    await api.auth.resetPassword(token.value, password.value)
    done.value = true
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
      <div v-if="done" class="text-center">
        <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-white mb-2">Contraseña actualizada</h2>
        <p class="text-gray-500 text-sm mb-6">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <button
          class="w-full bg-accent-600 hover:bg-accent-500 text-white font-semibold py-3 rounded-2xl transition-colors"
          @click="router.push('/login')"
        >
          Iniciar sesión
        </button>
      </div>

      <template v-else>
        <h1 class="text-2xl font-bold text-white mb-2">Nueva contraseña</h1>
        <p class="text-gray-500 text-sm mb-6">Elige una contraseña segura de al menos 8 caracteres.</p>

        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Nueva contraseña</label>
            <input
              v-model="password"
              type="password"
              required
              maxlength="72"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Confirmar contraseña</label>
            <input
              v-model="confirm"
              type="password"
              required
              maxlength="72"
              autocomplete="new-password"
              placeholder="••••••••"
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>

          <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading || !token"
            class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            {{ loading ? 'Guardando...' : 'Guardar contraseña' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
