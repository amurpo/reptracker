/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth'
import exercisesRoutes from './routes/exercises'
import planRoutes from './routes/plan'
import sessionsRoutes from './routes/sessions'
import profileRoutes from './routes/profile'

export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

// CORS for local dev (Vite runs on 5173, worker on 8787)
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.route('/api/auth', authRoutes)
app.route('/api/exercises', exercisesRoutes)
app.route('/api/plan', planRoutes)
app.route('/api/sessions', sessionsRoutes)
app.route('/api/profile', profileRoutes)

export default app
