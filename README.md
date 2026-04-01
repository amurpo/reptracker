# RepTracker

App de seguimiento de entrenamientos personales. Registra tu plan semanal, completa series y lleva el control de tu progreso.

## Stack

- **Frontend:** Vue 3 + TypeScript + Tailwind CSS + Vite
- **Backend:** Hono en Cloudflare Workers
- **Base de datos:** Cloudflare D1 (SQLite)
- **Email:** Resend
- **Auth:** JWT + verificación de email

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
```

## Deploy

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy
```
