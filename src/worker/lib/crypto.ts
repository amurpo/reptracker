// Iteraciones actuales para PBKDF2-SHA256 (recomendación OWASP).
const ITERATIONS = 600_000
// Hashes creados antes de versionar el formato usaban este valor fijo.
const LEGACY_ITERATIONS = 100_000

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256
  )
  return new Uint8Array(bits)
}

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

// Comparación en tiempo constante para evitar timing attacks.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveHash(password, salt, ITERATIONS)
  return `${ITERATIONS}:${toB64(salt)}:${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  // Formato nuevo: "iteraciones:salt:hash". Formato legacy: "salt:hash" (100k iteraciones).
  const [iterStr, saltB64, hashB64] =
    parts.length === 3 ? parts : [String(LEGACY_ITERATIONS), parts[0], parts[1]]
  if (!saltB64 || !hashB64) return false

  const iterations = Number(iterStr)
  if (!Number.isFinite(iterations) || iterations < 1) return false

  const salt = fromB64(saltB64)
  const expected = fromB64(hashB64)
  const actual = await deriveHash(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

// True si el hash almacenado usa un formato/iteraciones por debajo del estándar actual
// y conviene regenerarlo de forma transparente tras un login exitoso.
export function needsRehash(stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3) return true
  return Number(parts[0]) < ITERATIONS
}
