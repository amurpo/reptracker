<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { usePreferencesStore, applyTheme } from './stores/preferences'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const auth = useAuthStore()
const preferences = usePreferencesStore()
const showNav = computed(() => !route.meta.public)

// Aplica el tema guardado en localStorage antes de que llegue la respuesta del servidor,
// para evitar el flash al color por defecto
applyTheme(localStorage.getItem('theme') || 'indigo')

// Carga preferencias cuando el usuario se autentica (incluso en browser nuevo donde
// onMounted ya corrió antes del login)
watch(() => auth.user, (user) => {
  if (user) preferences.load()
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
    <main class="flex-1 overflow-auto overscroll-none" :style="showNav ? 'padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px))' : ''">
      <RouterView />
    </main>
    <NavBar v-if="showNav" />
  </div>
</template>
