<script setup lang="ts">
import { ref, watch } from 'vue'
import backImg from '../../assets/back.jpg'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import TurnstileWidget from '../components/TurnstileWidget.vue'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'login' | 'register' | 'forgot'>('login')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const registered = ref(false)
const notVerified = ref(false)
const forgotSent = ref(false)

const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
// En localhost se usa el site key de prueba de Cloudflare (siempre pasa)
const SITE_KEY = window.location.hostname === 'localhost'
  ? '1x00000000000000000000AA'
  : '0x4AAAAAAC0rD5hjSIcMTPH6'

watch(mode, () => {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
})

async function submit() {
  error.value = ''
  notVerified.value = false
  loading.value = true
  try {
    if (mode.value === 'register') {
      await api.auth.register(email.value, password.value, turnstileToken.value)
      registered.value = true
    } else {
      const res = await api.auth.login(email.value, password.value, turnstileToken.value)
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
    turnstileRef.value?.reset()
  } finally {
    loading.value = false
  }
}

async function submitForgot() {
  error.value = ''
  loading.value = true
  try {
    await api.auth.forgotPassword(email.value, turnstileToken.value)
    forgotSent.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido'
    turnstileRef.value?.reset()
  } finally {
    loading.value = false
  }
}

function switchMode(m: 'login' | 'register' | 'forgot') {
  mode.value = m
  error.value = ''
  forgotSent.value = false
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Left: image panel (hidden on mobile) -->
    <div class="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
      <img :src="backImg" alt="RepTracker" class="absolute inset-0 w-full h-full object-cover" />
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
        <div class="flex items-center justify-center w-12 h-12 bg-accent-500/20 rounded-2xl mb-2">
          <img src="/logo-transparency.png" class="w-10 h-10" alt="RepTracker" />
        </div>
        <h1 class="text-xl font-bold text-white">RepTracker</h1>
      </div>

      <div class="w-full max-w-sm">
        <!-- Email enviado tras registro -->
        <div v-if="registered" class="text-center py-4">
          <div class="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold text-white mb-2">Revisa tu email</h2>
          <p class="text-gray-500 text-sm leading-relaxed">
            Te enviamos un enlace de confirmación a<br/>
            <span class="text-gray-300 font-medium">{{ email }}</span>
          </p>
          <button class="mt-6 text-accent-400 hover:text-accent-300 text-sm font-medium transition-colors" @click="registered = false; switchMode('login')">
            Volver al inicio de sesión
          </button>
        </div>

        <template v-else>
          <!-- Tabs login / registro -->
          <div v-if="mode !== 'forgot'" class="hidden lg:block mb-6">
            <h2 class="text-2xl font-bold text-white">
              {{ mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta' }}
            </h2>
            <p class="text-gray-500 text-sm mt-1">
              {{ mode === 'login' ? 'Ingresa tus credenciales para continuar' : 'Completa los datos para registrarte' }}
            </p>
          </div>

          <div v-if="mode !== 'forgot'" class="flex bg-gray-900 rounded-2xl p-1 mb-5 border border-gray-800">
            <button
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              :class="mode === 'login' ? 'bg-accent-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'"
              @click="switchMode('login')"
            >
              Iniciar sesión
            </button>
            <button
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              :class="mode === 'register' ? 'bg-accent-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'"
              @click="switchMode('register')"
            >
              Registrarse
            </button>
          </div>

          <!-- ── MODO OLVIDÉ CONTRASEÑA ── -->
          <template v-if="mode === 'forgot'">
            <button class="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors" @click="switchMode('login')">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Volver al inicio de sesión
            </button>

            <div v-if="forgotSent" class="text-center py-4">
              <div class="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-white mb-2">Revisa tu email</h2>
              <p class="text-gray-500 text-sm leading-relaxed">
                Si <span class="text-gray-300 font-medium">{{ email }}</span> está registrado, recibirás un enlace para restablecer tu contraseña.
              </p>
              <button class="mt-6 text-accent-400 hover:text-accent-300 text-sm font-medium transition-colors" @click="switchMode('login')">
                Volver al inicio de sesión
              </button>
            </div>

            <template v-else>
              <h2 class="text-2xl font-bold text-white mb-2">¿Olvidaste tu contraseña?</h2>
              <p class="text-gray-500 text-sm mb-6">Ingresa tu email y te enviaremos un enlace para restablecerla.</p>
              <form class="space-y-4" @submit.prevent="submitForgot">
                <div>
                  <label class="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    v-model="email" type="email" required autocomplete="email" placeholder="tu@email.com"
                    class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
                  />
                </div>
                <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">{{ error }}</div>
                <TurnstileWidget ref="turnstileRef" v-model="turnstileToken" :sitekey="SITE_KEY" />
                <button
                  type="submit" :disabled="loading || !turnstileToken"
                  class="w-full bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
                >
                  {{ loading ? 'Enviando...' : 'Enviar enlace' }}
                </button>
              </form>
            </template>
          </template>

          <!-- ── MODO LOGIN / REGISTRO ── -->
          <template v-else>
            <form class="space-y-4" @submit.prevent="submit">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  v-model="email" type="email" required autocomplete="email"
                  class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Contraseña</label>
                <input
                  v-model="password" type="password" required maxlength="72"
                  :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                  class="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
                  placeholder="••••••••"
                />
                <p v-if="mode === 'register'" class="text-xs text-gray-600 mt-1.5 pl-1">Mínimo 8 caracteres</p>
              </div>

              <div v-if="notVerified" class="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-amber-400 text-sm">
                Tu email aún no está verificado. Revisa tu bandeja de entrada.
              </div>
              <div v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm">{{ error }}</div>

              <TurnstileWidget ref="turnstileRef" v-model="turnstileToken" :sitekey="SITE_KEY" />

              <button
                type="submit" :disabled="loading || !turnstileToken"
                class="w-full bg-accent-600 hover:bg-accent-500 active:bg-accent-700 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors mt-1"
              >
                {{ loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
              </button>

              <div v-if="mode === 'login'" class="text-center">
                <button type="button" class="text-sm text-gray-500 hover:text-gray-300 transition-colors" @click="switchMode('forgot')">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
