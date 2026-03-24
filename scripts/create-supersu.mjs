// Genera SQL para crear el usuario supersu
// Uso: node scripts/create-supersu.mjs
// Requiere: SUPERSU_PASSWORD en el entorno

const email = 'supersu@reptracker.internal'
const password = process.env.SUPERSU_PASSWORD

if (!password) {
  process.stderr.write('Error: definí SUPERSU_PASSWORD en el entorno\nEj: SUPERSU_PASSWORD=mipass node scripts/create-supersu.mjs\n')
  process.exit(1)
}

// Mismo algoritmo que auth.ts
const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
)
const hash = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
)
const saltB64 = btoa(String.fromCharCode(...new Uint8Array(salt)))
const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
const passwordHash = `${saltB64}:${hashB64}`

const sql = `INSERT OR IGNORE INTO users (email, password_hash, role) VALUES ('${email}', '${passwordHash}', 'supersu');`

process.stdout.write(sql + '\n')
