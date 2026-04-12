<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMsg = ref('')

onMounted(async () => {
  const token = route.query.token as string
  if (!token) {
    status.value = 'error'
    errorMsg.value = 'Enlace inválido'
    return
  }

  try {
    const res = await fetch(`/api/auth/verify/${token}`)
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) {
      status.value = 'error'
      errorMsg.value = data.error ?? 'Error al verificar'
    } else {
      status.value = 'success'
    }
  } catch {
    status.value = 'error'
    errorMsg.value = 'Error de conexión'
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-6">
    <div class="w-full max-w-sm text-center">
      <!-- Loading -->
      <div v-if="status === 'loading'" class="flex flex-col items-center gap-4">
        <div class="w-10 h-10 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        <p class="text-gray-500 text-sm">Verificando tu cuenta...</p>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'" class="flex flex-col items-center">
        <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-white mb-2">¡Email verificado!</h1>
        <p class="text-gray-500 text-sm mb-6">Tu cuenta está lista. Ya puedes iniciar sesión.</p>
        <button
          class="w-full bg-accent-600 hover:bg-accent-500 text-white font-semibold py-3 rounded-2xl transition-colors"
          @click="router.push('/login')"
        >
          Iniciar sesión
        </button>
      </div>

      <!-- Error -->
      <div v-else class="flex flex-col items-center">
        <div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-white mb-2">Enlace inválido</h1>
        <p class="text-gray-500 text-sm mb-6">{{ errorMsg }}</p>
        <button
          class="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-2xl transition-colors"
          @click="router.push('/login')"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  </div>
</template>
