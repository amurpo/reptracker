// Genera migrations/0001_seed_catalog.sql
// Requiere: scripts/names-es.json (traducido manualmente)
// Uso: node scripts/generate-catalog-seed.mjs

import { readFileSync } from 'fs'

const EXERCISES_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

const MUSCLE_ES = {
  abdominals: 'abdominales',
  abductors: 'abductores',
  adductors: 'aductores',
  biceps: 'bíceps',
  calves: 'pantorrillas',
  chest: 'pecho',
  forearms: 'antebrazos',
  glutes: 'glúteos',
  hamstrings: 'isquiotibiales',
  'hip flexors': 'flexores de cadera',
  'it band': 'banda IT',
  lats: 'dorsales',
  'lower back': 'lumbar',
  'middle back': 'espalda media',
  neck: 'cuello',
  quadriceps: 'cuádriceps',
  shoulders: 'hombros',
  traps: 'trapecios',
  triceps: 'tríceps',
}

function escapeSql(str) {
  return str.replace(/'/g, "''")
}

// Leer nombres traducidos
let translatedNames
try {
  translatedNames = JSON.parse(
    readFileSync(new URL('./names-es.json', import.meta.url), 'utf8')
  )
} catch {
  process.stderr.write('Error: scripts/names-es.json no encontrado.\nEjecutá primero: node scripts/dump-names.mjs\nTradució names-en.json y guardalo como names-es.json\n')
  process.exit(1)
}

const res = await fetch(EXERCISES_URL)
const exercises = await res.json()

// Soporta array de strings o array de objetos {name, muscle}
const resolvedNames = translatedNames.map((entry) =>
  typeof entry === 'string' ? entry : entry.name
)

if (resolvedNames.length !== exercises.length) {
  process.stderr.write(`Error: names-es.json tiene ${resolvedNames.length} entradas pero el catálogo tiene ${exercises.length}\n`)
  process.exit(1)
}

const BATCH = 50

function batches(rows) {
  const result = []
  for (let i = 0; i < rows.length; i += BATCH) {
    result.push(rows.slice(i, i + BATCH))
  }
  return result
}

const output = []

output.push('-- Seed: catálogo global de ejercicios (fuente: free-exercise-db)')
output.push('-- Generado con: node scripts/generate-catalog-seed.mjs')
output.push('')

// 1. exercise_catalog en batches
const catalogRows = exercises.map((ex, i) => {
  const name = escapeSql(resolvedNames[i])
  const raw = ex.primaryMuscles?.[0] ?? 'otros'
  const muscle = escapeSql(MUSCLE_ES[raw] ?? raw)
  const imageUrl = ex.images?.[0] ? `${IMAGE_BASE}/${ex.images[0]}` : null
  const img = imageUrl ? `'${imageUrl}'` : 'NULL'
  return `  ('${name}', '${muscle}', ${img})`
})

for (const batch of batches(catalogRows)) {
  output.push('INSERT INTO exercise_catalog (name, muscle_group, image_url) VALUES')
  output.push(batch.join(',\n') + ';')
  output.push('')
}

// 2. exercises globales (user_id NULL) desde el catalog recién insertado
output.push('INSERT INTO exercises (catalog_id, name, muscle_group, image_url, is_custom)')
output.push('  SELECT id, name, muscle_group, image_url, 0 FROM exercise_catalog;')

process.stdout.write(output.join('\n') + '\n')
