export type StrengthLevel = 'Principiante' | 'Novato' | 'Intermedio' | 'Avanzado' | 'Élite'

export const LEVELS: StrengthLevel[] = ['Principiante', 'Novato', 'Intermedio', 'Avanzado', 'Élite']

export const LEVEL_COLORS: Record<StrengthLevel, string> = {
  'Principiante': 'text-gray-400',
  'Novato':       'text-sky-400',
  'Intermedio':   'text-emerald-400',
  'Avanzado':     'text-yellow-400',
  'Élite':        'text-orange-400',
}

// Tablas de estándares (ratio 1RM / peso corporal) por sexo
// Fuente: ExRx / Symmetric Strength (valores redondeados)
const STANDARDS: Record<string, { male: number[]; female: number[] }> = {
  squat:    { male: [0.5, 1.0, 1.25, 1.75, 2.0],  female: [0.3, 0.65, 0.85, 1.2, 1.5]  },
  bench:    { male: [0.35, 0.75, 1.0, 1.25, 1.5],  female: [0.2, 0.4,  0.6,  0.8, 1.0]  },
  deadlift: { male: [0.75, 1.25, 1.5, 2.0, 2.5],   female: [0.4, 0.8,  1.0,  1.4, 1.75] },
  ohp:      { male: [0.25, 0.5,  0.75, 1.0, 1.25], female: [0.15, 0.3, 0.5,  0.65, 0.8] },
  row:      { male: [0.35, 0.65, 0.85, 1.1, 1.35], female: [0.2, 0.45, 0.65, 0.85, 1.05] },
}

// Palabras clave por grupo de estándar (español e inglés)
const NAME_MAP: Record<string, string[]> = {
  squat:    ['squat', 'sentadilla', 'goblet', 'frontal'],
  bench:    ['bench', 'press', 'pecho', 'prensa', 'banca'],
  deadlift: ['deadlift', 'peso muerto', 'pesomuerto', 'sumo'],
  ohp:      ['overhead', 'ohp', 'militar', 'hombro', 'shoulder'],
  row:      ['row', 'remo', 'jalada', 'jalon', 'pull'],
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matchStandard(name: string): string | null {
  const n = norm(name)
  for (const [key, keywords] of Object.entries(NAME_MAP)) {
    if (keywords.some(k => n.includes(norm(k)))) return key
  }
  return null
}

// Factor de ajuste por edad:
// < 23: umbral 10% más fácil (aún en desarrollo)
// 23-39: sin ajuste (referencia)
// 40-49: +5% de crédito, 50-59: +10%, 60-69: +15%, 70+: +20%
function ageAdjustedRatio(ratio: number, age: number | null): number {
  if (!age) return ratio
  if (age < 23) return ratio * (1 / 0.90)
  if (age < 40) return ratio
  if (age < 50) return ratio * 1.05
  if (age < 60) return ratio * 1.10
  if (age < 70) return ratio * 1.15
  return ratio * 1.20
}

export function getLevel(
  ratio: number,
  standardKey: string,
  sex: string | null,
  age: number | null,
): StrengthLevel | null {
  const table = STANDARDS[standardKey]
  if (!table) return null
  const thresholds = sex === 'female' ? table.female : table.male
  const adjusted = ageAdjustedRatio(ratio, age)
  let level: StrengthLevel = 'Principiante'
  for (let i = 0; i < thresholds.length; i++) {
    if (adjusted >= thresholds[i]) level = LEVELS[i]
  }
  return level
}
