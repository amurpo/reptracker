// Genera migrations/seed_aliases.sql: aliases de búsqueda para el catálogo global.
// - Nombre original en inglés de cada ejercicio (names-en.json, paralelo a names-es.json).
// - Sinónimos curados a mano en scripts/aliases-extra.json (clave: nombre en español del catálogo).
// Uso: node scripts/generate-aliases-seed.mjs > migrations/seed_aliases.sql

import { readFileSync } from 'fs'

function load(file) {
  return JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8'))
}

const namesEn = load('names-en.json')
const namesEs = load('names-es.json')
const extras = load('aliases-extra.json')

if (namesEn.length !== namesEs.length) {
  process.stderr.write(`Error: names-en.json (${namesEn.length}) y names-es.json (${namesEs.length}) no tienen la misma cantidad de entradas\n`)
  process.exit(1)
}

function escapeSql(str) {
  return str.replace(/'/g, "''")
}

// Normaliza para comparar: sin acentos, minúsculas
function norm(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// nombre español del catálogo -> set de aliases
const aliasesByName = new Map()

function addAlias(esName, alias) {
  // Omitir aliases que no aportan nada a la búsqueda (iguales al nombre visible)
  if (norm(alias) === norm(esName)) return
  if (!aliasesByName.has(esName)) aliasesByName.set(esName, new Set())
  aliasesByName.get(esName).add(alias)
}

namesEn.forEach((en, i) => addAlias(namesEs[i].name, en.name))

const validEsNames = new Set(namesEs.map((e) => e.name))
for (const extra of extras) {
  if (!validEsNames.has(extra.name)) {
    process.stderr.write(`Advertencia: "${extra.name}" (aliases-extra.json) no existe en names-es.json\n`)
  }
  for (const alias of extra.aliases) addAlias(extra.name, alias)
}

const output = []
output.push('-- Seed: aliases de búsqueda del catálogo (nombres en inglés + sinónimos)')
output.push('-- Generado con: node scripts/generate-aliases-seed.mjs')
output.push('')
output.push('DELETE FROM exercise_aliases;')
output.push('')

for (const [esName, aliases] of aliasesByName) {
  for (const alias of aliases) {
    output.push(
      `INSERT OR IGNORE INTO exercise_aliases (catalog_id, alias)` +
      ` SELECT id, '${escapeSql(alias)}' FROM exercise_catalog WHERE name = '${escapeSql(esName)}';`
    )
  }
}

process.stdout.write(output.join('\n') + '\n')
