<script setup lang="ts">
import { ref, watch } from 'vue'
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
  <div class="login-page">

    <!-- Logo -->
    <div class="login-header">
      <div class="logo-wrap">
        <img src="/logo-transparency.png" class="logo-img" alt="RepTracker" />
      </div>
      <h1 class="app-name">RepTracker</h1>
      <p class="app-tagline">Registra tus entrenamientos, sigue tu progreso.</p>
    </div>

    <!-- Email confirmado tras registro -->
    <div v-if="registered" class="login-card">
      <div class="success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
        </svg>
      </div>
      <h2>Revisa tu email</h2>
      <p class="hint">Te enviamos un enlace de confirmación a <strong>{{ email }}</strong></p>
      <button class="rt-btn" style="margin-top:16px" @click="registered = false; switchMode('login')">
        Volver al inicio de sesión
      </button>
    </div>

    <div v-else class="login-card">

      <!-- Tabs login / registro -->
      <div v-if="mode !== 'forgot'" class="mode-tabs">
        <button :class="['tab', mode === 'login' && 'tab-active']" @click="switchMode('login')">
          Iniciar sesión
        </button>
        <button :class="['tab', mode === 'register' && 'tab-active']" @click="switchMode('register')">
          Registrarse
        </button>
      </div>

      <!-- Olvidé contraseña -->
      <template v-if="mode === 'forgot'">
        <button class="back-btn" @click="switchMode('login')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver
        </button>

        <div v-if="forgotSent" class="text-center" style="padding:8px 0">
          <p class="hint">Si <strong>{{ email }}</strong> está registrado, recibirás el enlace en breve.</p>
          <button class="rt-btn" style="margin-top:16px" @click="switchMode('login')">Volver al inicio de sesión</button>
        </div>

        <form v-else @submit.prevent="submitForgot" class="form-body">
          <div class="field">
            <label>Email</label>
            <input v-model="email" class="rt-input" type="email" required autocomplete="email" placeholder="tu@email.com" />
          </div>
          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <TurnstileWidget ref="turnstileRef" :sitekey="SITE_KEY" v-model="turnstileToken" />
          <button type="submit" class="rt-btn" :disabled="loading || !turnstileToken">
            {{ loading ? 'Enviando...' : 'Enviar enlace' }}
          </button>
        </form>
      </template>

      <!-- Login / Registro -->
      <form v-else @submit.prevent="submit" class="form-body">
        <div class="field">
          <label>Email</label>
          <input v-model="email" class="rt-input" type="email" required autocomplete="email" placeholder="tu@email.com" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" class="rt-input" type="password" required maxlength="72"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="••••••••" />
          <span v-if="mode === 'register'" class="field-hint">Mínimo 8 caracteres</span>
        </div>

        <div v-if="notVerified" class="alert alert-warn">
          Tu email aún no está verificado. Revisa tu bandeja de entrada.
        </div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <TurnstileWidget ref="turnstileRef" :sitekey="SITE_KEY" v-model="turnstileToken" />

        <button type="submit" class="rt-btn" :disabled="loading || !turnstileToken">
          {{ loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
        </button>

        <button v-if="mode === 'login'" type="button" class="forgot-link" @click="switchMode('forgot')">
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  background: var(--clr-bg);
  gap: 24px;
}

.login-header {
  text-align: center;
}

.logo-wrap {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--clr-accent-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.logo-img {
  width: 44px;
  height: 44px;
}

.app-name {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
  color: var(--clr-text);
  letter-spacing: -0.5px;
}

.app-tagline {
  margin: 0;
  font-size: 14px;
  color: var(--clr-text-3);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: 20px;
  padding: 24px 20px;
}

.mode-tabs {
  display: flex;
  background: var(--clr-bg);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 20px;
  border: 1px solid var(--clr-border);
}

.tab {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--clr-text-3);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-active {
  background: var(--clr-accent);
  color: #fff;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--clr-text-2);
}

.field-hint {
  font-size: 12px;
  color: var(--clr-text-3);
  padding-left: 2px;
}

.alert {
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
}

.alert-error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: var(--clr-error);
}

.alert-warn {
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  color: var(--clr-warning);
}

.forgot-link {
  background: none;
  border: none;
  color: var(--clr-text-3);
  font-size: 13px;
  cursor: pointer;
  text-align: center;
  padding: 4px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--clr-text-2);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 16px;
  padding: 0;
}

.back-btn svg {
  width: 16px;
  height: 16px;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--clr-accent-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.success-icon svg {
  width: 28px;
  height: 28px;
  color: var(--clr-accent);
}

.text-center { text-align: center; }

h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--clr-text);
}

.hint {
  font-size: 14px;
  color: var(--clr-text-2);
  margin: 0;
}
</style>
