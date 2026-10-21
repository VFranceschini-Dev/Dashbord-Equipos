#!/usr/bin/env node
/**
 * check-internal-names.js — Control anti-regresión.
 *
 * Busca nombres internos del origen de datos (bases, tablas, proveedor,
 * endpoint) en los textos del frontend (src/) y en el bundle compilado
 * (dist/). Termina con exit code 1 si encuentra alguna aparición, de modo
 * que el build de Vercel falle si los nombres internos vuelven a colarse
 * en la interfaz.
 *
 * Corre como "postbuild" en package.json.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// Nombres internos del ORIGEN DE DATOS prohibidos en src/ y dist/.
// Case-insensitive. Los nombres de archivos e identificadores internos del
// frontend (supabase.ts, supabaseSync.ts, useSupabaseSync.ts, AuthContext,
// la clave de módulo 'collaborators', etc.) NO son textos visibles y por eso
// se excluyen con EXCLUDED_PATHS / ALLOWED_IDENTIFIERS.
const FORBIDDEN = [
  'SAI_TEST',
  'SAI-TEST',
  'USUARIOSACCESOS',
  'USERS_NUEVOS',
  'IPA_TEST',
  'IPA.DONNET',
  'DONNET.COM.AR',
  'METABASE',
  'SOLO LECTURA',
  '/API/USUARIOS',
];

// Rutas de src/ exentas de la búsqueda: son módulos de infraestructura cuyos
// nombres de archivo/exportaciones son identificadores internos legítimos
// (conexión a la base gestionada por la app, sync, auth). Ninguno muestra el
// origen interno de los datos de usuarios en pantalla.
const EXCLUDED_PATH_RE =
  /^src\/(services\/(supabase|supabaseSync|authService)\.ts|hooks\/useSupabaseSync\.ts|context\/AuthContext\.ts)$/;

// Identificadores internos permitidos (no son textos visibles).
const ALLOWED_IDENTIFIERS = [
  "'collaborators'",
  '"collaborators"',
  '`collaborators`',
  'collaborators:',
  ' collaborators,',
  '{ collaborators',
  '(collaborators',
  'syncCollaborator',
  'deleteCollaborator',
  'addCollaborator',
  'updateCollaborator',
  'setCollaborators',
];

const SRC_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'];
// En dist/ se revisa TODO (incluido .map): cualquier nombre interno compilado
// quedaría expuesto al navegador.
const DIST_EXTS = ['.js', '.mjs', '.css', '.html', '.map'];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

function findMatches(filePath, exts) {
  const ext = extname(filePath).toLowerCase();
  if (!exts.includes(ext)) return [];
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const lower = text.toLowerCase();
  const hits = [];
  for (const name of FORBIDDEN) {
    const needle = name.toLowerCase();
    let idx = lower.indexOf(needle);
    while (idx !== -1) {
      // Ventana de contexto para aplicar excepciones (identificadores conocidos).
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + needle.length + 40);
      const ctx = text.slice(start, end);
      const allowed = ALLOWED_IDENTIFIERS.some(a => ctx.includes(a));
      if (!allowed) {
        const line = text.slice(0, idx).split('\n').length;
        hits.push({ name, line });
      }
      idx = lower.indexOf(needle, idx + needle.length);
    }
  }
  return hits;
}

let problems = 0;

// --- src/ ---
const srcDir = join(ROOT, 'src');
if (existsSync(srcDir)) {
  for (const f of walk(srcDir, [])) {
    const rel = f.replace(ROOT + '/', '');
    if (EXCLUDED_PATH_RE.test(rel)) continue;
    for (const h of findMatches(f, SRC_EXTS)) {
      console.error(`❌ ${rel}:${h.line} contiene "${h.name}"`);
      problems++;
    }
  }
}

// --- dist/ (bundle compilado: cualquier nombre interno quedaría en el JS público) ---
const distDir = join(ROOT, 'dist');
if (existsSync(distDir)) {
  for (const f of walk(distDir, [])) {
    for (const h of findMatches(f, DIST_EXTS)) {
      console.error(`❌ ${f.replace(ROOT + '/', '')} contiene "${h.name}" en el bundle`);
      problems++;
    }
  }
} else {
  console.warn('⚠️  No existe dist/: ejecutá el build antes que este control (postbuild).');
}

if (problems > 0) {
  console.error(`\n❌ Control de nombres internos FALLÓ: ${problems} aparición(es).`);
  console.error('   Los textos visibles no pueden mencionar bases, tablas, endpoints ni proveedores.');
  console.error('   Centralizá los textos en src/constants/textos.ts con mensajes genéricos.');
  process.exit(1);
} else {
  console.log('✅ Control de nombres internos OK: src/ y dist/ limpios.');
}
