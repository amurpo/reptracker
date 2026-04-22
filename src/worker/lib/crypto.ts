export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
  )
  const saltB64 = btoa(String.fromCharCode(...new Uint8Array(salt)))
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
  return `${saltB64}:${hashB64}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
  )
  return btoa(String.fromCharCode(...new Uint8Array(hash))) === hashB64
}
