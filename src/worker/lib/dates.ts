/**
 * Calcula el inicio de semana para una fecha dada según la preferencia del usuario.
 * weekStartPref: 0 = lunes primero, 1 = domingo primero
 */
export function calcWeekStart(dateStr: string, weekStartPref: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Dom, 1=Lun, ..., 6=Sáb
  const offset = weekStartPref === 1 ? day : (day === 0 ? 6 : day - 1)
  d.setDate(d.getDate() - offset)
  return d.toISOString().split('T')[0]
}

/**
 * Devuelve el día de semana relativo (0 = primer día según preferencia del usuario, 6 = último).
 */
export function calcDayOfWeek(dateStr: string, weekStartPref: number): number {
  const weekStart = calcWeekStart(dateStr, weekStartPref)
  const d1 = new Date(dateStr + 'T12:00:00')
  const d2 = new Date(weekStart + 'T12:00:00')
  return Math.round((d1.getTime() - d2.getTime()) / 86400000)
}
