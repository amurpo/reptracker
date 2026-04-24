/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import exercisesRoutes from './routes/exercises'
import planRoutes from './routes/plan'
import sessionsRoutes from './routes/sessions'
import profileRoutes from './routes/profile'
import routinesRoutes from './routes/routines'
import statsRoutes from './routes/stats'
import { FROM, baseLayout, verificationHtml, passwordResetHtml } from './lib/email'

export type EmailJob =
  | { type: 'verification'; to: string; verifyUrl: string }
  | { type: 'password_reset'; to: string; resetUrl: string }

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  TURNSTILE_SECRET: string
  AVATARS: KVNamespace
  EXERCISE_IMAGES: KVNamespace
  EMAIL_QUEUE: Queue<EmailJob>
}

const app = new Hono<{ Bindings: Env }>()

// Block unknown paths (WordPress scanners, bots, etc.)
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  const allowed = ['/', '/login', '/plan', '/exercises', '/profile', '/stats', '/reset-password', '/verify', '/forgot-password', '/robots.txt']
  const isAllowed =
    allowed.includes(path) ||
    path.startsWith('/api/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/exercises/') ||
    path.startsWith('/.well-known/') ||
    /\.(js|css|ico|png|svg|webp|woff2?|jpg|jpeg|txt|ogg)$/.test(path)

  if (!isAllowed) return c.text('', 404)
  await next()
})

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-Frame-Options', 'DENY')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  c.res.headers.set('Cache-Control', 'no-store')
  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests"
  )
})

// CORS for local dev (Vite runs on 5173, worker on 8787)
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174'],
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app.route('/api/auth', authRoutes)
app.route('/api/exercises', exercisesRoutes)
app.route('/api/plan', planRoutes)
app.route('/api/sessions', sessionsRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/routines', routinesRoutes)
app.route('/api/stats', statsRoutes)

async function sendViaResend(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend error ${res.status}`)
}

export default {
  fetch: app.fetch.bind(app),

  async queue(batch: MessageBatch<EmailJob>, env: Env) {
    for (const msg of batch.messages) {
      try {
        const job = msg.body
        if (job.type === 'verification') {
          await sendViaResend(
            env.RESEND_API_KEY,
            job.to,
            'Confirma tu cuenta en RepTracker',
            baseLayout(verificationHtml(job.verifyUrl)),
          )
        } else if (job.type === 'password_reset') {
          await sendViaResend(
            env.RESEND_API_KEY,
            job.to,
            'Restablecer contraseña — RepTracker',
            baseLayout(passwordResetHtml(job.resetUrl)),
          )
        }
        msg.ack()
      } catch {
        msg.retry()
      }
    }
  },
}
