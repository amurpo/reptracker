async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('No autorizado')
  }

  const text = await res.text()
  let data: unknown = {}
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
    register: (email: string, password: string) =>
      request<{ message: string }>('POST', '/auth/register', { email, password }),
    forgotPassword: (email: string) =>
      request<{ message: string }>('POST', '/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      request<{ ok: boolean }>('POST', '/auth/reset-password', { token, password }),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: number; email: string } }>('POST', '/auth/login', { email, password }),
  },
  exercises: {
    list: () => request<Exercise[]>('GET', '/exercises'),
    create: (name: string, muscleGroup: string) =>
      request<Exercise>('POST', '/exercises', { name, muscleGroup }),
    delete: (id: number) => request<{ ok: boolean }>('DELETE', `/exercises/${id}`),
  },
  plan: {
    get: () => request<PlanEntry[]>('GET', '/plan'),
    add: (dayOfWeek: number, exerciseId: number, sets: number, reps: number) =>
      request<PlanEntry>('POST', '/plan', { dayOfWeek, exerciseId, sets, reps }),
    update: (id: number, sets: number, reps: number) =>
      request<PlanEntry>('PUT', `/plan/${id}`, { sets, reps }),
    remove: (id: number) => request<{ ok: boolean }>('DELETE', `/plan/${id}`),
  },
  profile: {
    get: () => request<UserProfile>('GET', '/profile'),
    update: (data: Partial<Pick<UserProfile, 'name' | 'age' | 'weightKg' | 'dateFormat' | 'timeFormat'>>) =>
      request<UserProfile>('PUT', '/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('PUT', '/profile/password', { currentPassword, newPassword }),
  },
  sessions: {
    get: (date: string) => request<SessionData>('GET', `/sessions/${date}`),
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
  dateFormat: string
  timeFormat: string
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
  dayOfWeek: number
  exerciseId: number
  sets: number
  reps: number
  orderIndex: number
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
  orderIndex: number
  exerciseName: string
  muscleGroup: string
}

export interface SessionData {
  session: { id: number; userId: number; date: string } | null
  plan: PlanSessionEntry[]
  completedSets: CompletedSet[]
}
