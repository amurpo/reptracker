const FROM = 'RepTracker <noreply@reptracker.amurpo.icu>'
const LOGO = 'https://reptracker.amurpo.icu/logo-transparency.png'

function baseLayout(content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#f1f5f9;border-radius:16px;">
      <img src="${LOGO}" alt="RepTracker" style="display:block;width:80px;margin:0 auto 24px;" />
      ${content}
    </div>
  `
}

export async function sendVerificationEmail(apiKey: string, to: string, verifyUrl: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: 'Confirma tu cuenta en RepTracker',
      html: baseLayout(`
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Confirma tu cuenta</h1>
        <p style="color:#94a3b8;margin:0 0 28px;">Haz clic en el botón para verificar tu email y empezar a usar RepTracker.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
          Verificar email
        </a>
        <p style="color:#475569;font-size:13px;margin:28px 0 0;">El enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.</p>
      `),
    }),
  })
}

export async function sendPasswordResetEmail(apiKey: string, to: string, resetUrl: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: 'Restablecer contraseña — RepTracker',
      html: baseLayout(`
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Restablecer contraseña</h1>
        <p style="color:#94a3b8;margin:0 0 28px;">Haz clic en el botón para crear una nueva contraseña. El enlace expira en 1 hora.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
          Restablecer contraseña
        </a>
        <p style="color:#475569;font-size:13px;margin:28px 0 0;">Si no solicitaste esto, ignora este mensaje.</p>
      `),
    }),
  })
}
