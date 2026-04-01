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
const registered = ref(false)
const notVerified = ref(false)

async function submit() {
  error.value = ''
  notVerified.value = false
  loading.value = true
  try {
    if (mode.value === 'register') {
      await api.auth.register(email.value, password.value)
      registered.value = true
    } else {
      const res = await api.auth.login(email.value, password.value)
      auth.setAuth(res.token, res.user)
      router.push('/')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    if (msg === 'email_not_verified') {
      notVerified.value = true
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Left: image panel (hidden on mobile) -->
    <div class="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
      <img
        src="/back.jpg"
        alt="RepTracker"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <!-- dark overlay + branding -->
      <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-transparent" />
      <div class="relative z-10 flex flex-col justify-end p-12 pb-16">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-12 h-12 bg-white/10 backdrop-blur rounded-2xl">
            <img src="/logo-transparency.png" class="w-10 h-10" alt="" />
          </div>
          <span class="text-white text-2xl font-bold tracking-tight">RepTracker</span>
        </div>
        <p class="text-white/60 text-base max-w-xs leading-relaxed">
          Registra tus entrenamientos, sigue tu progreso y supera tus límites.
        </p>
      </div>
    </div>

    <!-- Right: form panel -->
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-6 bg-gray-950">
      <!-- Mobile logo -->
      <div class="flex lg:hidden flex-col items-center mb-6">
        <div class="flex items-center justify-center w-12 h-12 bg-indigo-500/20 rounded-2xl mb-2">
          <img src="/logo-transparency.png" class="w-10 h-10" alt="RepTracker" />
        </div>
        <h1 class="text-xl font-bold text-white">RepTracker</h1>
      </div>

      <div class="w-full max-w-sm">

        <!-- Email sent state -->
        <div v-if="registered" class="text-center py-4">
          <div class="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Revisa tu email</h2>
          <p class="text-gray-500 text-sm leading-relaxed">
            Te enviamos un enlace de confirmación a<br/>
            <span class="text-gray-300 font-medium">{{ email }}</span>
          </p>
          <button
            @click="registered = false; mode = 'login'"
            class="mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
          >
            Volver al inicio de sesión
          </button>
        </div>

        <template v-else>
        <!-- Desktop heading -->
        <div class="hidden lg:block mb-6">
          <h2 class="text-2xl font-bold text-white">
            {{ mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta' }}
          </h2>
          <p class="text-gray-500 text-sm mt-1">
            {{ mode === 'login' ? 'Ingresa tus credenciales para continuar' : 'Completa los datos para registrarte' }}
          </p>
        </div>

        <!-- Tabs -->
        <div class="flex bg-gray-900 rounded-2xl p-1 mb-5 border border-gray-800">
          <button
            @click="mode = 'login'; error = ''"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            :class="mode === 'login' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'"
          >
            Iniciar sesión
          </button>
          <button
            @click="mode = 'register'; error = ''"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            :class="mode === 'register' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'"
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
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
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
              class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
            <p v-if="mode === 'register'" class="text-xs text-gray-600 mt-1.5 pl-1">Mínimo 8 caracteres</p>
          </div>

          <div v-if="notVerified" class="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-amber-400 text-sm">
            Tu email aún no está verificado. Revisa tu bandeja de entrada.
          </div>

          <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors mt-1"
          >
            {{ loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
          </button>

          <div v-if="mode === 'login'" class="text-center">
            <RouterLink to="/forgot-password" class="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              ¿Olvidaste tu contraseña?
            </RouterLink>
          </div>
        </form>
        </template>
      </div>
    </div>
  </div>
</template>
