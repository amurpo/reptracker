export function formatDate(isoDate: string, format: string): string {
  const [y, m, d] = isoDate.split('-')
  if (format === 'mm-dd-yyyy') return `${m}-${d}-${y}`
  if (format === 'yyyy-mm-dd') return isoDate
  return `${d}-${m}-${y}`
}

export function formatTime(date: Date, format: string): string {
  if (format === '12h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  }
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
