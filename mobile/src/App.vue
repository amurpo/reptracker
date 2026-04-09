<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isPublic = computed(() => !!route.meta.public)
</script>

<template>
  <div id="app-root">
    <RouterView v-if="isPublic" />

    <template v-else>
      <!-- Tabs wrapper -->
      <div class="tabs-wrapper">
        <div class="tabs-content">
          <RouterView />
        </div>

        <!-- Bottom tab bar -->
        <nav class="tab-bar">
          <RouterLink to="/" class="tab-item" :class="{ active: $route.name === 'workout' }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16M9 9v6M15 9v6"/>
            </svg>
            <span>Hoy</span>
          </RouterLink>

          <RouterLink to="/plan" class="tab-item" :class="{ active: $route.name === 'plan' }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Plan</span>
          </RouterLink>

          <RouterLink to="/exercises" class="tab-item" :class="{ active: $route.name === 'exercises' }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.5 6.5h11M6.5 17.5h11M4 12h16"/>
            </svg>
            <span>Ejercicios</span>
          </RouterLink>

          <RouterLink to="/profile" class="tab-item" :class="{ active: $route.name === 'profile' }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span>Perfil</span>
          </RouterLink>
        </nav>
      </div>
    </template>
  </div>
</template>

<style scoped>
#app-root {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--clr-bg);
  overflow: hidden;
}

.tabs-wrapper {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.tabs-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  /* deja espacio al tab bar + safe area */
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
}

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--clr-surface);
  border-top: 1px solid var(--clr-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 100;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 0;
  color: var(--clr-text-3);
  text-decoration: none;
  transition: color 0.2s;
}

.tab-item svg {
  width: 22px;
  height: 22px;
}

.tab-item span {
  font-size: 10px;
  font-weight: 500;
}

.tab-item.active {
  color: var(--clr-accent);
}
</style>
