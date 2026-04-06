// Descarga imágenes de ejercicios a public/exercises/ y genera migración SQL
// Uso: node scripts/download-images.mjs
// Salida: public/exercises/*.jpg + migrations/0007_local_exercise_images.sql

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const EXERCISES_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE    = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const OUT_DIR       = new URL('../public/exercises', import.meta.url).pathname
const CONCURRENCY   = 10

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const res = await fetch(EXERCISES_URL)
const exercises = await res.json()
const total = exercises.length

let downloaded = 0
let skipped = 0
let failed = 0
const sqlLines = []

async function downloadOne(ex) {
  if (!ex.images?.[0]) return
  const filePath  = join(OUT_DIR, `${ex.id}.jpg`)
  const localUrl  = `/exercises/${ex.id}.jpg`
  const remoteUrl = `${IMAGE_BASE}/${ex.images[0]}`

  // Escapar comillas simples por seguridad SQL
  const safeRemote = remoteUrl.replace(/'/g, "''")

  try {
    if (existsSync(filePath)) {
      skipped++
    } else {
      const r = await fetch(remoteUrl)
      if (!r.ok) { failed++; return }
      writeFileSync(filePath, Buffer.from(await r.arrayBuffer()))
      downloaded++
    }
    sqlLines.push(
      `UPDATE exercises SET image_url = '${localUrl}' WHERE image_url = '${safeRemote}';`
    )
  } catch {
    failed++
  }
  process.stderr.write(`\r  ${downloaded + skipped}/${total} (${failed} errores)   `)
}

// Procesar en lotes paralelos
for (let i = 0; i < exercises.length; i += CONCURRENCY) {
  await Promise.all(exercises.slice(i, i + CONCURRENCY).map(downloadOne))
}

process.stderr.write('\n')

// Generar migración
const sql = [
  '-- Actualizar image_url de ejercicios a rutas locales',
  '-- Generado con: node scripts/download-images.mjs',
  '',
  ...sqlLines,
].join('\n') + '\n'

writeFileSync(
  new URL('../migrations/0007_local_exercise_images.sql', import.meta.url).pathname,
  sql
)

process.stderr.write(`✓ ${downloaded} descargadas, ${skipped} ya existían, ${failed} fallidas\n`)
process.stderr.write(`✓ migrations/0007_local_exercise_images.sql generado con ${sqlLines.length} updates\n`)
