<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showConfirm = ref(false)

function confirmLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 safe-area-inset-bottom">
    <div class="max-w-lg mx-auto flex">
      <RouterLink
        to="/"
        class="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors"
        :class="route.path === '/' ? 'text-indigo-400' : 'text-gray-500'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        Hoy
      </RouterLink>

      <RouterLink
        to="/plan"
        class="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors"
        :class="route.path === '/plan' ? 'text-indigo-400' : 'text-gray-500'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        Plan
      </RouterLink>

      <RouterLink
        to="/exercises"
        class="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors"
        :class="route.path === '/exercises' ? 'text-indigo-400' : 'text-gray-500'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
          <path d="m2.5 21.5 1.4-1.4"/>
          <path d="m20.1 3.9 1.4-1.4"/>
          <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>
          <path d="m9.6 14.4 4.8-4.8"/>
        </svg>
        Ejercicios
      </RouterLink>

      <RouterLink
        to="/profile"
        class="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors"
        :class="route.path === '/profile' ? 'text-indigo-400' : 'text-gray-500'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Perfil
      </RouterLink>

      <button
        @click="showConfirm = true"
        class="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors text-gray-500 hover:text-red-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Salir
      </button>
    </div>
  </nav>

  <!-- Confirmation modal -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="showConfirm"
      class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      @click.self="showConfirm = false"
    >
      <div class="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-sm p-6">
        <h3 class="text-white font-bold text-lg mb-1">Cerrar sesión</h3>
        <p class="text-gray-500 text-sm mb-6">¿Seguro que quieres salir de tu cuenta?</p>
        <div class="flex gap-3">
          <button
            @click="showConfirm = false"
            class="flex-1 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="confirmLogout"
            class="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
