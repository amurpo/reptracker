/**
 * download-exercise-frames.mjs
 * Descarga el frame 1 (posición final) de cada ejercicio del catálogo.
 * Los guarda como public/exercises/<Name>_1.jpg junto al frame 0 existente.
 *
 * Uso: node scripts/download-exercise-frames.mjs [--dry-run]
 */

import { readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const EXERCISES_DIR = join(ROOT, 'public/exercises')
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const DRY_RUN = process.argv.includes('--dry-run')
const CONCURRENCY = 8

const files = readdirSync(EXERCISES_DIR).filter(f => f.endsWith('.jpg') && !f.endsWith('_1.jpg'))
console.log(`Ejercicios encontrados: ${files.length}`)

let downloaded = 0
let skipped = 0
let failed = 0

async function downloadOne(file) {
  const name = file.replace(/\.jpg$/, '')
  const destPath = join(EXERCISES_DIR, `${name}_1.jpg`)

  if (existsSync(destPath)) {
    skipped++
    return
  }

  const url = `${IMAGE_BASE}/${name}/1.jpg`

  if (DRY_RUN) {
    console.log(`[dry] ${url} → ${name}_1.jpg`)
    downloaded++
    return
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      if (res.status !== 404) console.warn(`  WARN ${name}: HTTP ${res.status}`)
      failed++
      return
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(destPath, buf)
    downloaded++
    if (downloaded % 50 === 0) console.log(`  ${downloaded}/${files.length - skipped} descargados...`)
  } catch (err) {
    console.warn(`  ERROR ${name}: ${err.message}`)
    failed++
  }
}

// Procesar en lotes de CONCURRENCY
for (let i = 0; i < files.length; i += CONCURRENCY) {
  await Promise.all(files.slice(i, i + CONCURRENCY).map(downloadOne))
}

console.log(`\nListo: ${downloaded} descargados, ${skipped} ya existían, ${failed} sin frame 2`)
