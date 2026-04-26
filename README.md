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

## Créditos

- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) de [yuhonas](https://github.com/yuhonas) — catálogo de ejercicios e imágenes bajo licencia libre. Sin este repo el catálogo no existiría.
- [Cloudflare](https://cloudflare.com) — Workers, D1, KV, Queues, Turnstile, WAF. La infraestructura completa de la app corre sobre su plataforma.

## Deploy

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```
