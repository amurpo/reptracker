function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Devuelve true si todas las palabras del query aparecen en nombre o grupo muscular */
export function matchesSearch(name: string, muscleGroup: string, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = norm(name) + ' ' + norm(muscleGroup)
  return words.every(w => hay.includes(w))
}

async function request<T>(method: string, path: string, body?: unknown, skipAuthRedirect = false): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuthRedirect) {
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('No autorizado')
  }

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    if (!res.ok) throw new Error(`Error del servidor (${res.status})`)
    return {} as T
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Error en la solicitud')
  return data as T
}

export const api = {
  auth: {
    register: (email: string, password: string, turnstileToken: string) =>
      request<{ message: string }>('POST', '/auth/register', { email, password, turnstileToken }, true),
    forgotPassword: (email: string, turnstileToken: string) =>
      request<{ message: string }>('POST', '/auth/forgot-password', { email, turnstileToken }, true),
    resetPassword: (token: string, password: string) =>
      request<{ ok: boolean }>('POST', '/auth/reset-password', { token, password }, true),
    login: (email: string, password: string, turnstileToken: string) =>
      request<{ user: { id: number; email: string } }>('POST', '/auth/login', { email, password, turnstileToken }, true),
    logout: () =>
      request<{ ok: boolean }>('POST', '/auth/logout', undefined, true),
  },
  exercises: {
    list: () => request<Exercise[]>('GET', '/exercises'),
    create: (name: string, muscleGroup: string) =>
      request<Exercise>('POST', '/exercises', { name, muscleGroup }),
    update: (id: number, name: string, muscleGroup: string) =>
      request<Exercise>('PATCH', `/exercises/${id}`, { name, muscleGroup }),
    delete: (id: number) => request<{ ok: boolean }>('DELETE', `/exercises/${id}`),
    getImage: (id: number) => request<{ image: string | null }>('GET', `/exercises/${id}/image`),
    uploadImage: (id: number, image: string) => request<{ ok: boolean }>('PUT', `/exercises/${id}/image`, { image }),
    deleteImage: (id: number) => request<{ ok: boolean }>('DELETE', `/exercises/${id}/image`),
  },
  plan: {
    get: (weekStart: string) => request<PlanEntry[]>('GET', `/plan?weekStart=${encodeURIComponent(weekStart)}`),
    getMonth: (yearMonth: string) => request<string[]>('GET', `/plan/month/${yearMonth}`),
    add: (weekStart: string, dayOfWeek: number, exerciseId: number, sets: number, reps: number, repsConfig?: number[] | null, weightKg?: number | null, isCardio?: number, durationMinutes?: number | null) =>
      request<PlanEntry>('POST', '/plan', { weekStart, dayOfWeek, exerciseId, sets, reps, repsConfig, weightKg, isCardio, durationMinutes }),
    update: (id: number, sets: number, reps: number, repsConfig?: number[] | null, weightKg?: number | null, isCardio?: number, durationMinutes?: number | null) =>
      request<PlanEntry>('PUT', `/plan/${id}`, { sets, reps, repsConfig, weightKg, isCardio, durationMinutes }),
    remove: (id: number) => request<{ ok: boolean }>('DELETE', `/plan/${id}`),
  },
  profile: {
    get: () => request<UserProfile>('GET', '/profile'),
    update: (data: Partial<Pick<UserProfile, 'name' | 'age' | 'weightKg' | 'heightCm' | 'sex' | 'dateFormat' | 'timeFormat' | 'weekStart' | 'theme'>>) =>
      request<UserProfile>('PUT', '/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('PUT', '/profile/password', { currentPassword, newPassword }),
    getAvatar: () => request<{ avatar: string | null }>('GET', '/profile/avatar'),
    uploadAvatar: (avatar: string) => request<{ ok: boolean }>('PUT', '/profile/avatar', { avatar }),
    getWeightLog: () => request<WeightLogEntry[]>('GET', '/profile/weight-log'),
    logWeight: (date: string, weightKg: number) =>
      request<{ ok: boolean }>('POST', '/profile/weight-log', { date, weightKg }),
  },
  routines: {
    list: () => request<Routine[]>('GET', '/routines'),
    save: (name: string, exercises: RoutineExercise[]) =>
      request<Routine>('POST', '/routines', { name, exercises }),
    delete: (id: number) => request<{ ok: boolean }>('DELETE', `/routines/${id}`),
    apply: (id: number, dayOfWeek: number, weekStart: string) =>
      request<PlanEntry[]>('POST', `/routines/${id}/apply`, { dayOfWeek, weekStart }),
  },
  stats: {
    summary: (month: string, today: string) =>
      request<StatsSummary>('GET', `/stats/summary?month=${encodeURIComponent(month)}&today=${encodeURIComponent(today)}`),
    progressionExercises: () =>
      request<{ id: number; name: string; muscleGroup: string }[]>('GET', '/stats/progression-exercises'),
    progression: (exerciseId: number) =>
      request<{ date: string; maxWeightKg: number; estimated1RM: number }[]>('GET', `/stats/progression/${exerciseId}`),
  },
  sessions: {
    get: (date: string, localToday: string) => request<SessionData>('GET', `/sessions/${date}?today=${localToday}`),
    getMonth: (yearMonth: string) =>
      request<{ date: string; completedSets: number }[]>('GET', `/sessions/month/${yearMonth}`),
    complete: (date: string, weeklyPlanId: number, setNumber: number) =>
      request<{ ok: boolean }>('POST', `/sessions/${date}/complete`, { weeklyPlanId, setNumber }),
    uncomplete: (date: string, weeklyPlanId: number, setNumber: number) =>
      request<{ ok: boolean }>('DELETE', `/sessions/${date}/complete`, { weeklyPlanId, setNumber }),
  },
}

export interface UserProfile {
  id: number
  email: string
  name: string | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
  sex: string | null
  dateFormat: string
  timeFormat: string
  weekStart: number
  theme: string
}

export interface Exercise {
  id: number
  userId: number | null       // null = ejercicio global del catálogo
  catalogId: number | null
  name: string
  muscleGroup: string
  imageUrl: string | null
  isCustom: number            // 0 = global, 1 = custom del usuario
  isDeleted: number
  createdAt: string | null
}

export interface PlanEntry {
  id: number
  weekStart: string
  dayOfWeek: number
  exerciseId: number
  sets: number
  reps: number
  repsConfig: number[] | null
  weightKg: number | null
  orderIndex: number
  isCardio: number
  durationMinutes: number | null
  exerciseName: string
  muscleGroup: string
}

export interface CompletedSet {
  id: number
  sessionId: number
  weeklyPlanId: number
  setNumber: number
  completedAt: string | null
}

export interface PlanSessionEntry {
  id: number
  exerciseId: number
  sets: number
  reps: number
  repsConfig: number[] | null
  weightKg: number | null
  orderIndex: number
  isCardio: number
  durationMinutes: number | null
  exerciseName: string
  muscleGroup: string
}

export interface Routine {
  id: number
  userId: number
  name: string
  createdAt: string | null
  exerciseCount: number
}

export interface RoutineExercise {
  exerciseId: number
  sets: number
  reps: number
  repsConfig?: number[] | null
  weightKg?: number | null
  orderIndex: number
}

export interface StatsSummary {
  daysThisMonth: number
  setsThisMonth: number
  totalDays: number
  streak: number
  topExercises: { name: string; muscleGroup: string; sets: number }[]
  weightKg: number | null
  heightCm: number | null
  sex: string | null
  age: number | null
  strengthRatios: { name: string; muscleGroup: string; estimated1RM: number; bestWeightKg: number }[]
}

export interface WeightLogEntry {
  date: string
  weightKg: number
}

export interface SessionData {
  session: { id: number; userId: number; date: string } | null
  plan: PlanSessionEntry[]
  completedSets: CompletedSet[]
}
