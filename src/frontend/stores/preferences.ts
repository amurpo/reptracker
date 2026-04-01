import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../lib/api'

export const usePreferencesStore = defineStore('preferences', () => {
  const dateFormat = ref(localStorage.getItem('dateFormat') || 'dd-mm-yyyy')
  const timeFormat = ref(localStorage.getItem('timeFormat') || '24h')

  async function load() {
    try {
      const profile = await api.profile.get()
      dateFormat.value = profile.dateFormat
      timeFormat.value = profile.timeFormat
      localStorage.setItem('dateFormat', profile.dateFormat)
      localStorage.setItem('timeFormat', profile.timeFormat)
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

  return { dateFormat, timeFormat, load, formatDate, formatTime }
})
