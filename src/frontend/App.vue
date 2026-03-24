<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const showNav = computed(() => !route.meta.public)
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
    <main class="flex-1 overflow-auto" :class="showNav ? 'pb-20' : ''">
      <RouterView />
    </main>
    <NavBar v-if="showNav" />
  </div>
</template>
