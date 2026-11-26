import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ACCIONES, ETIQUETA_ACCION, ETIQUETA_MODULO, MODULOS, ROLES, compactarPermisos, permisoBase, puede,
  type Accion, type Modulo, type Permisos, type Rol,
} from '../config/permisos';
import {
  actualizarUsuarioSistema, crearUsuarioSistema, listarUsuariosSistema, type UsuarioSistema,
} from '../services/usuariosSistema';
import {
  AlertTriangle, CheckCircle, Copy, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserCheck, UserX, Users, X,
} from 'lucide-react';

const claseCampo = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 outline-none text-sm focus:border-blue-400';
const claseEtiqueta = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';
const claseSecundario = 'px-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-slate-200';
const clasePrimario = 'flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60';

const COLOR_ROL: Record<Rol, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  operador: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  lectura: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
};
const etiquetaRol = (rol: Rol) => ROLES.find(r => r.id === rol)?.label ?? rol;

/** Contraseña temporal legible (sin caracteres que se confunden: 0/O, 1/l/I). */
function generarContrasena(largo = 12): string {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alfabeto[b % alfabeto.length]).join('');
}

/** Cuadrícula módulo × acción: muestra lo que el usuario puede hacer y permite ajustarlo. */
function MatrizPermisos({ rol, permisos, onChange }: { rol: Rol; permisos: Permisos; onChange: (p: Permisos) => void }) {
  const esAdmin = rol === 'admin';

  const alternar = (modulo: Modulo, accion: Accion, valor: boolean) => {
    const ajustes = { ...(permisos[modulo] ?? {}), [accion]: valor };
    // Para crear/editar/eliminar hay que poder ver el módulo
    if (valor && accion !== 'ver' && !puede(rol, permisos, modulo, 'ver')) ajustes.ver = true;
    onChange({ ...permisos, [modulo]: ajustes });
  };

  const hayAjustes = Object.keys(compactarPermisos(rol, permisos)).length > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Permisos por módulo</span>
        {!esAdmin && hayAjustes && (
          <button type="button" onClick={() => onChange({})} className="text-xs text-blue-600 dark:text-sky-300 hover:underline">
            Volver a los del rol
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50 text-xs text-gray-500 dark:text-slate-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Módulo</th>
              {ACCIONES.map(a => <th key={a} className="font-medium px-2 py-2 text-center">{ETIQUETA_ACCION[a]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {MODULOS.map(m => (
              <tr key={m}>
                <td className="px-3 py-2 text-gray-800 dark:text-slate-200">{ETIQUETA_MODULO[m]}</td>
                {ACCIONES.map(a => {
                  const efectivo = puede(rol, permisos, m, a);
                  const ajustado = !esAdmin && efectivo !== permisoBase(rol, m, a);
                  return (
                    <td key={a} className="px-2 py-2 text-center">
                      <label className="inline-flex items-center justify-center relative cursor-pointer">
                        <input
                          type="checkbox"
                          checked={efectivo}
                          disabled={esAdmin}
                          onChange={e => alternar(m, a, e.target.checked)}
                          aria-label={`${ETIQUETA_ACCION[a]} en ${ETIQUETA_MODULO[m]}`}
                          className="rounded"
                        />
                        {ajustado && <span title="Distinto al rol" className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
        {esAdmin ? 'El administrador tiene acceso a todo.' : 'Un punto naranja marca lo que se ajustó respecto del rol. Para crear, editar o eliminar hay que poder ver el módulo.'}
      </p>
    </div>
  );
}

function CampoContrasena({ valor, onChange, etiqueta }: { valor: string; onChange: (v: string) => void; etiqueta: string }) {
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };
  return (
    <div>
      <label className={claseEtiqueta}>{etiqueta}</label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={valor} onChange={e => onChange(e.target.value)} className={`${claseCampo} pr-9`} />
          <button type="button" onClick={() => setVer(v => !v)} title={ver ? 'Ocultar' : 'Mostrar'}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button type="button" onClick={() => { onChange(generarContrasena()); setVer(true); }} className={`${claseSecundario} shrink-0`}>Generar</button>
        <button type="button" onClick={copiar} disabled={!valor} title="Copiar" className={`${claseSecundario} shrink-0 disabled:opacity-50`}>
          {copiado ? <CheckCircle size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Mínimo 8 caracteres. Pasásela al usuario por un medio seguro; después puede cambiarla desde el menú.</p>
    </div>
  );
}

interface FormUsuario {
  nombre: string;
  email: string;
  area: string;
  rol: Rol;
  permisos: Permisos;
  password: string;
}
const formVacio: FormUsuario = { nombre: '', email: '', area: '', rol: 'operador', permisos: {}, password: '' };

function ModalUsuario({ usuario, esUnoMismo, onClose, onGuardado }: {
  usuario: UsuarioSistema | null;       // null = alta
  esUnoMismo: boolean;
  onClose: () => void;
  onGuardado: (u: UsuarioSistema, mensaje: string, aviso?: string) => void;
}) {
  const [form, setForm] = useState<FormUsuario>(usuario
    ? { nombre: usuario.nombre, email: usuario.email, area: usuario.area, rol: usuario.rol, permisos: usuario.permisos, password: '' }
    : formVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cambiarClave, setCambiarClave] = useState(false);
  const set = <K extends keyof FormUsuario>(k: K, v: FormUsuario[K]) => { setForm(f => ({ ...f, [k]: v })); setError(null); };

  const guardar = async () => {
    setError(null);
    if (!form.nombre.trim()) { setError('Ingresá el nombre.'); return; }
    if (!usuario && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) { setError('Ingresá un correo válido.'); return; }
    const pide = !usuario || cambiarClave;
    if (pide && (form.password.length < 8 || form.password.length > 72)) { setError('La contraseña temporal debe tener entre 8 y 72 caracteres.'); return; }
    setGuardando(true);
    try {
      const permisos = compactarPermisos(form.rol, form.permisos);
      if (!usuario) {
        const creado = await crearUsuarioSistema({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password, rol: form.rol, area: form.area.trim(), permisos });
        onGuardado(creado, `Usuario creado: ${creado.email}. Pasale la contraseña temporal.`);
      } else {
        const { usuario: actualizado, aviso } = await actualizarUsuarioSistema(usuario.id, {
          nombre: form.nombre.trim(), area: form.area.trim(), rol: form.rol, permisos, ...(cambiarClave ? { password: form.password } : {}),
        });
        onGuardado(actualizado, 'Cambios guardados.', aviso);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{usuario ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={claseEtiqueta}>Nombre y apellido *</label>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} className={claseCampo} />
            </div>
            <div>
              <label className={claseEtiqueta}>Correo (para iniciar sesión) *</label>
              <input type="email" value={form.email} disabled={Boolean(usuario)} onChange={e => set('email', e.target.value)}
                className={`${claseCampo} disabled:opacity-60`} />
              {usuario && <p className="text-xs text-gray-400 mt-1">El correo no se puede cambiar.</p>}
            </div>
            <div>
              <label className={claseEtiqueta}>Área</label>
              <input type="text" value={form.area} onChange={e => set('area', e.target.value)} className={claseCampo} />
            </div>
            <div>
              <label className={claseEtiqueta}>Rol *</label>
              <select value={form.rol} disabled={esUnoMismo} onChange={e => set('rol', e.target.value as Rol)} className={`${claseCampo} disabled:opacity-60`}>
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {esUnoMismo ? 'No podés cambiar tu propio rol.' : ROLES.find(r => r.id === form.rol)?.descripcion}
              </p>
            </div>
          </div>

          <MatrizPermisos rol={form.rol} permisos={form.permisos} onChange={p => set('permisos', p)} />

          {!usuario ? (
            <CampoContrasena etiqueta="Contraseña temporal *" valor={form.password} onChange={v => set('password', v)} />
          ) : cambiarClave ? (
            <div className="space-y-2">
              <CampoContrasena etiqueta="Nueva contraseña temporal" valor={form.password} onChange={v => set('password', v)} />
              <button type="button" onClick={() => { setCambiarClave(false); set('password', ''); }} className="text-xs text-gray-500 hover:underline">No cambiar la contraseña</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCambiarClave(true)} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-sky-300 hover:underline">
              <KeyRound size={14} /> Restablecer contraseña
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className={claseSecundario}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className={clasePrimario}>
            {guardando && <Loader2 size={15} className="animate-spin" />} {usuario ? 'Guardar' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Administración de usuarios del sistema: alta, rol, permisos por módulo, activar/desactivar y contraseña (solo administradores). */
export default function AdministracionUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [editando, setEditando] = useState<UsuarioSistema | null | undefined>(undefined);   // undefined = cerrado, null = alta
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setErrorCarga(null);
    try { setUsuarios(await listarUsuariosSistema()); } catch (err) { setErrorCarga((err as Error).message); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter(u =>
      (filtro === 'todos' || (filtro === 'activos' ? u.activo : !u.activo)) &&
      (!q || [u.nombre, u.email, u.area].some(t => t.toLowerCase().includes(q))));
  }, [usuarios, busqueda, filtro]);

  const guardado = (u: UsuarioSistema, mensaje: string, advertencia?: string) => {
    setUsuarios(prev => (prev.some(x => x.id === u.id) ? prev.map(x => (x.id === u.id ? u : x)) : [...prev, u]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    setAviso({ ok: !advertencia, texto: advertencia ? `${mensaje} ${advertencia}` : mensaje });
    setEditando(undefined);
  };

  const alternarActivo = async (u: UsuarioSistema) => {
    const desactivar = u.activo;
    if (desactivar && !window.confirm(`¿Desactivar a ${u.nombre}? No va a poder iniciar sesión hasta que lo reactives.`)) return;
    setProcesando(u.id);
    try {
      const { usuario, aviso: adv } = await actualizarUsuarioSistema(u.id, { activo: !u.activo });
      guardado(usuario, desactivar ? `${u.nombre} quedó desactivado.` : `${u.nombre} quedó activo.`, adv);
    } catch (err) {
      setAviso({ ok: false, texto: (err as Error).message });
    } finally {
      setProcesando(null);
    }
  };

  const totales = { total: usuarios.length, activos: usuarios.filter(u => u.activo).length, admins: usuarios.filter(u => u.rol === 'admin' && u.activo).length };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gray-600 dark:text-slate-300 text-sm">
          <ShieldCheck size={18} /> Quién puede entrar al sistema y qué puede hacer en cada módulo.
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} disabled={cargando} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 hover:text-blue-600 disabled:opacity-50">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
          <button onClick={() => setEditando(null)} className={clasePrimario}><Plus size={16} /> Nuevo usuario</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Usuarios', totales.total], ['Activos', totales.activos], ['Administradores', totales.admins]].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-slate-400">{etiqueta}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{valor}</p>
          </div>
        ))}
      </div>

      {aviso && (
        <div className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${aviso.ok
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <span className="flex items-start gap-2">{aviso.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />} {aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso"><X size={14} /></button>
        </div>
      )}
      {errorCarga && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} /> {errorCarga}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo o área..."
            className="pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 outline-none text-sm w-72 focus:border-blue-400" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm">
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50 text-xs text-gray-500 dark:text-slate-400">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Usuario</th>
              <th className="text-left font-medium px-4 py-2.5">Rol</th>
              <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Área</th>
              <th className="text-left font-medium px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {visibles.map(u => {
              const ajustes = Object.keys(compactarPermisos(u.rol, u.permisos)).length > 0;
              const esUnoMismo = u.id === user?.id;
              return (
                <tr key={u.id} className={u.activo ? '' : 'opacity-60'}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{u.nombre}{esUnoMismo && <span className="ml-2 text-xs font-normal text-gray-400">(vos)</span>}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_ROL[u.rol]}`}>{etiquetaRol(u.rol)}</span>
                    {ajustes && <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400" title="Tiene permisos ajustados">+ ajustes</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300 hidden md:table-cell">{u.area || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={u.activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditando(u)} title="Editar" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"><Pencil size={16} /></button>
                      {!esUnoMismo && (
                        <button onClick={() => alternarActivo(u)} disabled={procesando === u.id} title={u.activo ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 disabled:opacity-50">
                          {procesando === u.id ? <Loader2 size={16} className="animate-spin" /> : u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && (
          <div className="text-center py-10">
            <Users size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">No hay usuarios para mostrar.</p>
          </div>
        )}
        {cargando && usuarios.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando...</div>
        )}
      </div>

      {editando !== undefined && (
        <ModalUsuario usuario={editando} esUnoMismo={editando?.id === user?.id} onClose={() => setEditando(undefined)} onGuardado={guardado} />
      )}
    </div>
  );
}
