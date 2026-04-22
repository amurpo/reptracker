# RepTracker

App de seguimiento de entrenamientos personales. Registra tu plan semanal, completa series y lleva el control de tu progreso.

## Stack

- **Frontend:** Vue 3 + TypeScript + Tailwind CSS + Vite
- **Backend:** Hono en Cloudflare Workers
- **Base de datos:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare KV (avatares e imágenes de ejercicios)
- **Email:** Resend
- **Auth:** httpOnly cookies + verificación de email
- **Anti-bot:** Cloudflare Turnstile (register y login)

## Desarrollo local

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Requiere un archivo `.dev.vars` con:
```
JWT_SECRET=...
RESEND_API_KEY=...
TURNSTILE_SECRET=...
```

> Para desarrollo local Turnstile acepta el secret `1x0000000000000000000000000000000AA` (siempre aprueba).

## Deploy

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```
