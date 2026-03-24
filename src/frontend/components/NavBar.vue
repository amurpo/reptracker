<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex safe-area-inset-bottom">
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
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M3 9.5h2v5H3zM19 9.5h2v5h-2zM1 11.5h2M21 11.5h2"/>
      </svg>
      Ejercicios
    </RouterLink>
  </nav>
</template>
