/**
 * sync-waf.mjs
 *
 * Actualiza el bloque WAF de UN subdominio específico dentro de una regla
 * compartida, sin tocar los bloques de otros subdominios.
 *
 * Variables de entorno requeridas:
 *   CF_ZONE_ID       — ID de la zona en Cloudflare
 *   CF_WAF_RULE_ID   — ID de la regla WAF a actualizar
 *   CF_API_TOKEN     — Token con permiso Zone → WAF → Edit
 *
 * Variables de entorno opcionales:
 *   CF_HOST          — Subdominio a gestionar (default: lee de wrangler.toml)
 *
 * Uso:
 *   node scripts/sync-waf.mjs [--dry-run] [--pages-dir <ruta>] [--vue-router <ruta>]
 *
 * Reutilizable en otros proyectos: solo cambia CF_HOST y --pages-dir / --vue-router
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Cargar .dev.vars como fallback (mismo formato KEY=VALUE que .env)
try {
  const devVars = readFileSync(join(ROOT, '.dev.vars'), 'utf8');
  for (const line of devVars.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .dev.vars no existe — se usarán solo las variables del entorno
}

const DRY_RUN = process.argv.includes('--dry-run');

// --pages-dir <ruta> apunta a un directorio de páginas Astro
const pagesDirArg = (() => {
  const i = process.argv.indexOf('--pages-dir');
  return i !== -1 ? process.argv[i + 1] : null;
})();

// --vue-router <ruta> apunta al archivo router/index.ts de Vue
const vueRouterArg = (() => {
  const i = process.argv.indexOf('--vue-router');
  return i !== -1 ? process.argv[i + 1] : null;
})();

// ── Resolver el host ──────────────────────────────────────────────────────────

function hostFromWrangler() {
  try {
    const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
    const match = toml.match(/pattern\s*=\s*"([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const HOST = process.env.CF_HOST ?? hostFromWrangler();
if (!HOST) {
  console.error(
    'No se pudo determinar el host. Usa CF_HOST=sub.dominio.com o configura wrangler.toml',
  );
  process.exit(1);
}

// ── Variables de entorno ──────────────────────────────────────────────────────

const ZONE_ID = process.env.CF_ZONE_ID;
const RULE_ID = process.env.CF_WAF_RULE_ID;
const TOKEN = process.env.CF_API_TOKEN;

if (!DRY_RUN && (!ZONE_ID || !RULE_ID || !TOKEN)) {
  console.error('Faltan variables: CF_ZONE_ID, CF_WAF_RULE_ID, CF_API_TOKEN');
  process.exit(1);
}

// ── Detectar rutas desde páginas Astro ───────────────────────────────────────

function getAstroFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...getAstroFiles(full));
    } else if (entry.endsWith('.astro') && !entry.startsWith('[')) {
      files.push(full);
    }
  }
  return files;
}

function fileToRoute(filePath, pagesDir) {
  const rel = relative(pagesDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\.astro$/, '');
  if (rel === 'index') return '/';
  if (rel.endsWith('/index')) return `/${rel.replace('/index', '')}`;
  return `/${rel}`;
}

// ── Detectar rutas desde Vue Router ─────────────────────────────────────────

function getVueRouterRoutes(routerFile) {
  const content = readFileSync(routerFile, 'utf8');
  const routes = [];
  for (const match of content.matchAll(/path:\s*['"]([^'"]+)['"]/g)) {
    const p = match[1];
    // Excluir rutas dinámicas (:param) y wildcards
    if (!p.includes(':') && !p.includes('*')) {
      routes.push(p);
    }
  }
  return routes;
}

// ── Resolver rutas de la app ─────────────────────────────────────────────────

let routes = [];

if (vueRouterArg) {
  const routerFile = join(process.cwd(), vueRouterArg);
  routes = getVueRouterRoutes(routerFile);
  console.log('Modo: Vue Router →', routerFile);
} else if (pagesDirArg) {
  const pagesDir = join(process.cwd(), pagesDirArg);
  routes = getAstroFiles(pagesDir).map(f => fileToRoute(f, pagesDir));
  console.log('Modo: Astro pages →', pagesDir);
} else {
  // Auto-detectar: primero Vue Router, luego Astro pages
  const vueRouterDefault = join(ROOT, 'src/frontend/router/index.ts');
  const astroDefault = join(ROOT, 'frontend/src/pages');
  try {
    routes = getVueRouterRoutes(vueRouterDefault);
    console.log('Modo: Vue Router (auto) →', vueRouterDefault);
  } catch {
    try {
      routes = getAstroFiles(astroDefault).map(f => fileToRoute(f, astroDefault));
      console.log('Modo: Astro pages (auto) →', astroDefault);
    } catch {
      console.error('No se encontró router Vue ni pages Astro. Usa --vue-router o --pages-dir');
      process.exit(1);
    }
  }
}

routes = [...new Set(routes)].sort();

console.log(`Host: ${HOST}`);
console.log('Rutas detectadas:');
for (const r of routes) console.log(' ', r);

// ── Directorios estáticos siempre permitidos ─────────────────────────────────
// Mirrors del allowlist en src/worker/index.ts

const STATIC_PREFIXES = ['/api', '/assets', '/sounds', '/exercises', '/.well-known'];

// ── Construir el bloque compatible con estructura not (...) ──────────────────

const rootSegments = [
  ...new Set(
    routes.map((r) => {
      if (r === '/') return '/';
      const parts = r.split('/').filter(Boolean);
      return `/${parts[0]}`;
    }),
  ),
].sort();

const allPrefixes = [...new Set([...rootSegments, ...STATIC_PREFIXES])].sort();

const pathConditions = allPrefixes
  .map((seg) =>
    seg === '/' ? `http.request.uri.path eq "/"` : `starts_with(http.request.uri.path, "${seg}")`,
  )
  .join(' or\n      ');

const newBlock = `(\n    http.host eq "${HOST}" and (\n      ${pathConditions}\n    )\n  )`;

if (DRY_RUN) {
  console.log('\nBloque generado para este host:');
  console.log(newBlock);
  console.log('\n[dry-run] Sin cambios aplicados.');
  process.exit(0);
}

// ── Obtener regla actual desde CF ─────────────────────────────────────────────

const rsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const rsData = await rsRes.json();
if (!rsRes.ok) {
  console.error('Error al obtener rulesets:', rsData.errors);
  process.exit(1);
}

const ruleset = rsData.result.find((r) => r.phase === 'http_request_firewall_custom');
if (!ruleset) {
  console.error('No se encontró el ruleset http_request_firewall_custom');
  process.exit(1);
}

const rulesetRes = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${ruleset.id}`,
  { headers: { Authorization: `Bearer ${TOKEN}` } },
);
const rulesetData = await rulesetRes.json();
const currentRule = rulesetData.result.rules.find((r) => r.id === RULE_ID);

if (!currentRule) {
  console.error(`Regla ${RULE_ID} no encontrada en el ruleset`);
  process.exit(1);
}

// ── Reemplazar solo el bloque de este host, preservar los demás ───────────────

const currentExpr = currentRule.expression;

function findHostBlock(expr, host) {
  const marker = `http.host eq "${host}"`;
  const markerIdx = expr.indexOf(marker);
  if (markerIdx === -1) return null;

  let start = markerIdx - 1;
  while (start >= 0 && expr[start] !== '(') start--;
  if (start < 0) return null;

  let depth = 0;
  let end = start;
  while (end < expr.length) {
    if (expr[end] === '(') depth++;
    else if (expr[end] === ')') {
      depth--;
      if (depth === 0) break;
    }
    end++;
  }

  return { start, end: end + 1 };
}

// Normalizar reglas de archivos estáticos independientes del host
function normalizeStaticFileRules(expr) {
  return expr
    .replace(
      /http\.request\.uri\.path contains "\.ico"/g,
      'ends_with(http.request.uri.path, ".ico")',
    )
    .replace(
      /http\.request\.uri\.path contains "\.woff"/g,
      'ends_with(http.request.uri.path, ".woff") or\n  ends_with(http.request.uri.path, ".woff2")',
    );
}

const existing = findHostBlock(currentExpr, HOST);
let newExpression;

if (existing) {
  newExpression = currentExpr.slice(0, existing.start) + newBlock + currentExpr.slice(existing.end);
} else {
  const lastParen = currentExpr.lastIndexOf(')');
  newExpression = `${currentExpr.slice(0, lastParen)} or\n  ${newBlock}\n${currentExpr.slice(lastParen)}`;
}

newExpression = normalizeStaticFileRules(newExpression);

console.log('\nExpresión actualizada:');
console.log(newExpression);

// ── Aplicar el cambio ─────────────────────────────────────────────────────────

const patchRes = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${ruleset.id}/rules/${RULE_ID}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: currentRule.action,
      expression: newExpression,
    }),
  },
);
const patchData = await patchRes.json();

if (!patchRes.ok) {
  console.error('Error al actualizar:', JSON.stringify(patchData.errors, null, 2));
  process.exit(1);
}

console.log(`\nRegla WAF de ${HOST} actualizada. Otros subdominios intactos.`);
