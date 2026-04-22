import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'

export const THEMES = [
  { id: 'indigo',  label: 'Índigo',    swatches: ['#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca'] },
  { id: 'violet',  label: 'Violeta',   swatches: ['#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9'] },
  { id: 'emerald', label: 'Esmeralda', swatches: ['#6ee7b7','#34d399','#10b981','#059669','#047857'] },
  { id: 'sky',     label: 'Cielo',     swatches: ['#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1'] },
  { id: 'rose',    label: 'Rosa',      swatches: ['#fda4af','#fb7185','#f43f5e','#e11d48','#be123c'] },
  { id: 'amber',   label: 'Ámbar',     swatches: ['#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309'] },
] as const

export type ThemeId = typeof THEMES[number]['id']

export function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

export const usePreferencesStore = defineStore('preferences', () => {
  const dateFormat = ref(localStorage.getItem('dateFormat') || 'dd-mm-yyyy')
  const timeFormat = ref(localStorage.getItem('timeFormat') || '24h')
  const weekStart = ref(parseInt(localStorage.getItem('weekStart') || '0'))
  const theme = ref(localStorage.getItem('theme') || 'indigo')
  const restTimerSeconds = ref(parseInt(localStorage.getItem('restTimerSeconds') || '0'))
  const restTimerSound = ref(localStorage.getItem('restTimerSound') || 'bell')
  const restTimerRepeat = ref(parseInt(localStorage.getItem('restTimerRepeat') || '1'))

  async function load() {
    try {
      const profile = await api.profile.get()
      dateFormat.value = profile.dateFormat
      timeFormat.value = profile.timeFormat
      weekStart.value = profile.weekStart
      theme.value = profile.theme || 'indigo'
      restTimerSeconds.value = profile.restTimerSeconds ?? 90
      restTimerSound.value = profile.restTimerSound ?? 'bell'
      restTimerRepeat.value = profile.restTimerRepeat ?? 1
      localStorage.setItem('dateFormat', profile.dateFormat)
      localStorage.setItem('timeFormat', profile.timeFormat)
      localStorage.setItem('weekStart', String(profile.weekStart))
      localStorage.setItem('restTimerSeconds', String(restTimerSeconds.value))
      localStorage.setItem('restTimerSound', restTimerSound.value)
      localStorage.setItem('restTimerRepeat', String(restTimerRepeat.value))
      applyTheme(theme.value)
    } catch { /* usa el valor en caché */ }
  }

  function formatDate(isoDate: string): string {
    const [y, m, d] = isoDate.split('-')
    if (dateFormat.value === 'mm-dd-yyyy') return `${m}-${d}-${y}`
    if (dateFormat.value === 'yyyy-mm-dd') return isoDate
    return `${d}-${m}-${y}`
  }

  function formatTime(date: Date): string {
    if (timeFormat.value === '12h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    }
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }

  return { dateFormat, timeFormat, weekStart, theme, restTimerSeconds, restTimerSound, restTimerRepeat, load, formatDate, formatTime }
})
