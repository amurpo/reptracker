export async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  })
  const data = await res.json<{ success: boolean }>()
  return data.success
}
