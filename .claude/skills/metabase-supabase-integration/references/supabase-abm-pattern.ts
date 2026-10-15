/**
 * Referencia: patrón ABM "primero Supabase, después el estado" + normalización
 * de resultados { success, error? }. Extracto genérico listo para copiar en un
 * proyecto React + Supabase (adaptar tipos y nombres de servicio).
 */

// ===== 1) En services/supabaseSync.ts: TODAS las funciones devuelven AbmResult =====

export type AbmResult = { success: boolean; error?: string };

/** Alta/modificación: si el id NO tiene 36 chars (no es UUID de Supabase) hace
 *  create y asigna el id real al objeto; si lo tiene hace update. */
export async function syncEntityToSupabase(entity: MyEntity): Promise<AbmResult> {
  try {
    const userId = getCurrentUserId(); // localStorage 'current_user_id' escrito por AuthContext
    const row = { user_id: userId /* ...mapeo camelCase → snake_case... */ };

    if (entity.id && entity.id.length === 36) {
      const { error } = await entityService.update(entity.id, row);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    const { data, error } = await entityService.create(row);
    if (error) return { success: false, error: `Error al crear: ${error.message}` };
    if (data) entity.id = data.id; // mutación intencional: el caller toma el id real
    return { success: true };
  } catch (err) {
    return { success: false, error: `Error inesperado: ${err}` };
  }
}

export async function deleteEntityFromSupabase(id: string): Promise<AbmResult> {
  try {
    const { error } = await entityService.delete(id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: `Error inesperado: ${err}` };
  }
}

// ===== 2) En context/AppContext.tsx: firmas async, estado SOLO si success =====

type AppAbm = (arg: any) => Promise<AbmResult>; // todas las addX/updateX/deleteX

async function addEntity(input: Omit<MyEntity, 'id'>): Promise<AbmResult> {
  // IMPORTANTE: sin uuidv4() local. Un update sobre id inexistente no da error
  // en Supabase pero tampoco inserta: el registro quedaría solo en memoria.
  const candidate = { ...input, id: '' } as MyEntity;
  const result = await syncEntityToSupabase(candidate);
  if (!result.success) return result;          // el estado NO se toca si falló
  setEntities(prev => [...prev, candidate]);   // candidate.id ya es el UUID real
  return result;
}

async function updateEntity(id: string, patch: Partial<MyEntity>): Promise<AbmResult> {
  const actual = entities.find(e => e.id === id);
  if (!actual) return { success: false, error: 'Registro no encontrado' };
  const completo = { ...actual, ...patch, id };  // objeto COMPLETO a Supabase
  const result = await syncEntityToSupabase(completo);
  if (result.success) setEntities(prev => prev.map(e => (e.id === id ? completo : e)));
  return result;
}

async function deleteEntity(id: string): Promise<AbmResult> {
  const result = await deleteEntityFromSupabase(id);
  if (result.success) setEntities(prev => prev.filter(e => e.id !== id));
  return result;
}

// ===== 3) En los componentes: await, cerrar modal solo si success, botón bloqueado =====

const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState<string | null>(null);

async function handleSubmit() {
  setSaving(true);
  setErrorMsg(null);
  const result = editingId ? await updateEntity(editingId, form) : await addEntity(form);
  setSaving(false);
  if (result.success) resetForm();               // cierra modal / limpia formulario
  else setErrorMsg(result.error || 'No se pudo guardar'); // modal abierto, error visible
}

/* JSX del botón:
   <button onClick={handleSubmit} disabled={saving || !formValid}>
     {saving ? 'Guardando...' : 'Guardar'}
   </button>
   y debajo del formulario:
   {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>} */

// ===== 4) Coherencia de estado derivado (ej: movimientos de equipos) =====
// asignacion → status 'assigned'; devolucion → 'available'; baja → 'retired'.
// Dos escrituras correlativas: si hace falta atomicidad real, usar una RPC
// (function security definer) que inserte el movimiento y actualice el equipo.

// ===== 5) Carga inicial y user_id =====
// - Estados arrancan vacíos; syncAllFromSupabase() con Promise.allSettled por módulo.
// - logout → limpiar estados en memoria; login otro usuario → recargar.
// - Verificar que current_user_id sea el UUID del usuario logueado (AuthContext lo
//   escribe al iniciar sesión), NO el default 00000000-0000-0000-0000-000000000001.
