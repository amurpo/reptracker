// Descarga ejercicios y vuelca un JSON con los nombres en inglés
// Uso: node scripts/dump-names.mjs
// Salida: scripts/names-en.json

import { writeFileSync } from 'fs'

const EXERCISES_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

const res = await fetch(EXERCISES_URL)
const exercises = await res.json()

const entries = exercises.map((ex) => ({
  name: ex.name,
  muscle: ex.primaryMuscles?.[0] ?? 'other',
}))

writeFileSync(
  new URL('./names-en.json', import.meta.url),
  JSON.stringify(entries, null, 2)
)

process.stderr.write(`✓ scripts/names-en.json generado con ${entries.length} ejercicios\n`)
