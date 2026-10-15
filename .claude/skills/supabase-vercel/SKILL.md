---
name: supabase-vercel
description: Integración React+Vite+TypeScript con Supabase (Auth, RLS, ABM persistente) y despliegue en Vercel. Usar al conectar apps frontend con Supabase, migrar login hardcodeado, hacer CRUD atómico o publicar en Vercel.
---

# Supabase + Vercel — Skill reutilizable

Patrón verificado en Dashbord-Equipos (React 18 + TS + Vite + Tailwind → Supabase + Vercel).

## Reglas de oro
1. **ABM solo en Supabase**: el estado de React es copia de la base. Orden: primero Supabase, después setState (solo si success).
2. **Nunca generar ids locales** (`uuidv4()`) antes de insertar: `sync*ToSupabase` hace update si el id tiene 36 chars → update sobre id inexistente no da error pero tampoco inserta. Crear sin id y tomar el id devuelto.
3. **Resultados normalizados** `{ success: boolean; error?: string }` en todas las funciones de sync.
4. **Sin service role key en el frontend**. Solo `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
5. Validar envs al arrancar con **throw explícito** (no fallback placeholder como `https://tu-proyecto.supabase.co` → errores de red confusos).

## Cliente
```ts
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
export const supabase = createClient(url, key);
```

## Auth (migración desde login hardcodeado)
- `signInWithPassword` / `signOut` / `getSessionProfile` / `onAuthStateChange` en un `authService.ts`.
- **Bug clásico**: `INITIAL_SESSION` llega con sesión nula antes de terminar de cargar el storage → el listener debe reaccionar solo a eventos explícitos (`SIGNED_IN/OUT`, `USER_UPDATED`), no a cualquier `session===null` (deslogueo fantasma al recargar).
- Al iniciar sesión guardar el `user.id` en `localStorage['current_user_id']`; todos los queries filtrarán por él. Limpiarlo al logout.
- Restaurar sesión con spinner en App antes de decidir Login vs layout.
- Rol admin desde tabla `profiles` (con trigger `handle_new_user`) o fallback `app_metadata.role`.

## Patrón de carga inicial (AppContext)
```ts
useEffect(() => {
  if (!user) { limpiarTodo(); return; }
  const seq = ++loadSeq.current;               // anti-race al cambiar usuario
  setDataLoading(prev=>({...prev,global:true}));
  Promise.allSettled(modulos.map(m => loadModule(m)))  // paralelo, tolerante a fallos
    .then(...);                                // error por módulo, no rompe el resto
}, [user?.id]);
```
- Estados arrancan **vacíos** (no usar datos de ejemplo como seed).
- Distinguir "tabla vacía" de "consulta falló": las funciones sync deben **lanzar/propagar** el error, no tragarlo devolviendo [].
- Mensajes específicos: code `42P01`/`PGRST205` → "La tabla X todavía no existe"; `42501` → "No tenés permisos (RLS)".
- Exponer `loading`, `moduleErrors` y `reload(modulo?)`; botón discreto "Actualizar" por pantalla.

## Patrón de ABM (todas las entidades)
```ts
const addX = async (item: Omit<X,'id'>): Promise<AbmResult> => {
  const nuevo = { ...item, id: '' };                    // SIN uuid local
  const r = await syncXToSupabase(nuevo);               // create + asigna nuevo.id
  if (r.success) setXs(prev => [...prev, nuevo]);       // recién ahora el estado
  return r;
};
const updateX = async (id, data: Partial<X>) => {
  const actual = xs.find(x=>x.id===id); if(!actual) return {success:false,error:'No existe'};
  const completo = { ...actual, ...data, id };          // objeto COMPLETO a la base
  const r = await syncXToSupabase(completo);
  if (r.success) setXs(prev=>prev.map(x=>x.id===id?completo:x));
  return r;
};
const deleteX = async (id) => {
  const r = await deleteXFromSupabase(id);
  if (r.success) setXs(prev=>prev.filter(x=>x.id!==id));
  return r;
};
```
Componentes: `await` en handleSubmit → cerrar modal/reset form **solo si success**; si falla mostrar `errorMsg` sin cerrar; botón `disabled={saving}` ("Guardando...").

## Sync layer (supabaseSync.ts)
- `getCurrentUserId()` lee `localStorage['current_user_id']` — SIEMPRE escrito por AuthContext al loguear (bug clásico: queda el UUID default `00000000-...` y los datos no coinciden).
- Cada entidad: `sync*FromSupabase` (mapea snake_case→camelCase), `sync*ToSupabase` (update si id.length===36 else create), `delete*FromSupabase`.
- Update-then-create fallback en printers puede duplicar ante id huérfano — conocido, mantener consciente.

## RLS mínimo recomendado (por tabla propia)
```sql
alter table app_x enable row level security;
create policy own on app_x for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
Si una tabla del código coincide con otra de otro sistema, renombrar (p.ej. `printers` → `app_printers`) en TODAS las consultas incluyendo testConnection.

## Indicadores/tarjetas (lecciones de bugs reales)
- Nunca tendencia fija ('+12%'): calcular o quitar el badge.
- Arrays en Set comparan por referencia → `new Set(rows.flatMap(r=>r.category).map(normalizar)).size` (trim+lowercase+quitar tildes).
- No sumar monedas distintas (ARS+USD) en un total: separar por currency.
- Verificar que cada tarjeta use la entidad correcta (bug: "Comprobantes" mostraba `movements.length` en vez de `vouchers.length`).

## Vercel
- Build: `npm run build` (tsc+vite). Framework preset Vite; output `dist`.
- Env vars `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` en Project Settings (Production + Preview si corresponde).
- En Supabase: Authentication → URL Configuration: Site URL y Redirect URLs con el dominio de Vercel (`https://app.vercel.app`).
- `.env` en `.gitignore`; subir solo `.env.example`.
- SPA routing: `vercel.json` con rewrite `/*` → `/index.html` si se agregan rutas directas.

## Troubleshooting real encontrado
| Problema | Causa | Fix |
|---|---|---|
| Alta no persiste | uuid local → update sobre id inexistente | crear sin id, usar el devuelto |
| Datos muestran 0 habiendo registros | `current_user_id` default ≠ user logueado | AuthContext escribe localStorage al loguear |
| Deslogueo al recargar | escuchar INITIAL_SESSION null | filtrar por nombre de evento |
| "Email not confirmed" en login | usuario creado por SQL directo | crear desde Dashboard > Add user o confirmar email |
| Tabla inexistente rompe toda la app | sin Promise.allSettled | aislar error por módulo con aviso en español |
| tsc falla tras quitar código | imports sin uso con noUnusedLocals | limpiar imports en el mismo commit |