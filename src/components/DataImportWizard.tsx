import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud, FileSpreadsheet, DatabaseBackup, X, PlusCircle, CheckCircle2, RefreshCw,
  MinusCircle, AlertCircle, Download, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { TableImportConfig, ImportRowResult, RowStatus } from '../config/importConfig';
import { validateCuit, validateEmail, parseBoolean, parseArray, fieldChanged } from '../config/importConfig';
import {
  readWorkbook, sheetNames, sheetToData, toCsv, downloadTextFile, toSqlDateTime,
  parseCsv,
} from '../utils/excelToCsv';

type Step = 1 | 2; // Paso 1: subir archivo · Paso 2: revisar (la confirmación es un modal encima)

interface PreviewData {
  fileName: string;
  csv: string;
  results: ImportRowResult[];
  unknownHeaders: string[];
  totals: Record<RowStatus, number>;
}

interface SaveFailure { label: string; error: string }

interface SaveOutcome {
  allFailed: boolean; // falló todo (y no se guardó ni un registro)
  inserted: number;
  updated: number;
  failures: SaveFailure[];
}

const DEFAULT_BATCH_SIZE = 500;

export default function DataImportWizard({
  config,
  onClose,
  onSaved,
}: {
  config: TableImportConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [dragOver, setDragOver] = useState(false);
  const [converting, setConverting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingCount = preview ? preview.totals.new + preview.totals.update : 0;

  // Aviso si el usuario intenta cerrar con datos sin confirmar.
  const hasPendingWork = !!preview && step >= 2 && !saving;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingWork) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasPendingWork]);

  const attemptClose = () => {
    if (hasPendingWork) {
      const ok = window.confirm('Tenés una importación sin confirmar. ¿Querés descartarla y perder los datos cargados?');
      if (!ok) return;
    }
    onClose();
  };

  // ---------------- Paso 1: archivo ----------------
  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFileError(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setFileError('El archivo debe ser un Excel (.xlsx). Revisá que tenga esa extensión.');
      return;
    }
    // Avance automático: apenas se elige/suelta el archivo se procesa y pasa al Paso 2.
    // Si el archivo es inválido o no tiene registros, buildPreview devuelve ok:false
    // y nos quedamos en el Paso 1 mostrando el motivo (nunca se abre una vista previa vacía).
    setConverting(true);
    try {
      const wb = await readWorkbook(file);
      const names = sheetNames(wb);
      let chosen = names[0];
      if (names.length > 1) {
        const answer = window.prompt(
          `El archivo tiene varias hojas: ${names.join(', ')}. Escribí el nombre de la hoja que querés importar:`,
          names[0],
        );
        if (!answer) throw new Error('Selección de hoja cancelada.');
        chosen = names.includes(answer.trim()) ? answer.trim() : names[0];
      }
      const { headers, rows } = sheetToData(wb, chosen);
      const csv = toCsv(headers, rows);
      const result = await buildPreview(file.name, csv);
      if (!result.ok) setFileError(result.message ?? 'No se pudo leer el archivo.');
    } catch (err) {
      setStep(1);
      setFileError(err instanceof Error ? err.message : 'No se pudo convertir el archivo. Verificá que sea un Excel válido.');
    } finally {
      setConverting(false);
    }
  };

  // ---------------- Validación + clasificación ----------------
  // Devuelve ok:true si se construyó la vista previa (y avanzamos al Paso 2 automáticamente),
  // u ok:false con el motivo (el usuario permanece en el Paso 1 con el error visible).
  const buildPreview = useCallback(async (fileName: string, csv: string): Promise<{ ok: boolean; message?: string }> => {
    // Parseo RFC4180 del CSV intermedio (maneja comas y saltos de línea dentro de campos).
    let parsed;
    try {
      parsed = parseCsv(csv);
    } catch {
      return { ok: false, message: 'No se pudo leer el archivo. Verificá que sea un Excel (.xlsx) válido.' };
    }
    if (parsed.headers.length === 0) {
      return { ok: false, message: 'El archivo está vacío o no tiene encabezados. Completalo con datos e intentá de nuevo.' };
    }

    const headerMap = new Map<string, number>(); // columna destino -> índice en el CSV
    const unknownHeaders: string[] = [];

    parsed.headers.forEach((key, idx) => {
      if (key === '') return;
      const col = config.columns.find(
        (c) => c.column === key || (c.aliases ?? []).includes(key),
      );
      if (col) {
        if (!headerMap.has(col.column)) headerMap.set(col.column, idx);
      } else {
        unknownHeaders.push(key);
      }
    });

    const missingRequired = config.columns.filter((c) => c.required && !headerMap.has(c.column));
    if (missingRequired.length > 0) {
      return {
        ok: false,
        message: `Faltan columnas obligatorias en el archivo: ${missingRequired.map((c) => c.label).join(', ')}. Descargá la plantilla para ver los encabezados correctos.`,
      };
    }

    const existing = await config.fetchExisting();
    const existingByKey = new Map<string, Record<string, unknown>>();
    for (const row of existing) {
      const values = config.existingToValues(row);
      existingByKey.set(config.matchKeyOf(values), row);
    }

    const seenKeys = new Set<string>();
    const results: ImportRowResult[] = [];
    let newCount = 0, updateCount = 0, unchangedCount = 0, errorCount = 0;

    for (const record of parsed.rows) {
      const cells = parsed.headers.map((h) => record[h] ?? '');
      if (cells.every((c) => c.trim() === '')) continue; // filas vacías

      const errors: { column?: string; message: string }[] = [];
      const values: Record<string, unknown> = {};

      for (const col of config.columns) {
        const idx = headerMap.get(col.column);
        const rawCell = idx !== undefined ? (cells[idx] ?? '').trim() : '';

        if (col.required && rawCell === '') {
          errors.push({ column: col.column, message: `Falta el ${col.label.toLowerCase()}` });
          continue;
        }
        switch (col.kind) {
          case 'cuit': {
            values[col.column] = rawCell.replace(/[.\-\s]/g, '');
            if (rawCell && !validateCuit(rawCell)) {
              errors.push({ column: col.column, message: `El CUIT "${rawCell}" no es válido` });
            }
            break;
          }
          case 'email': {
            values[col.column] = rawCell;
            if (rawCell && !validateEmail(rawCell)) {
              errors.push({ column: col.column, message: `El email "${rawCell}" no parece válido` });
            }
            break;
          }
          case 'boolean': {
            const parsed = parseBoolean(rawCell);
            if (parsed === null) {
              errors.push({ column: col.column, message: `"${rawCell}" no se entiende. Usá Activo o Inactivo.` });
            } else {
              values[col.column] = parsed;
            }
            break;
          }
          case 'array': {
            values[col.column] = parseArray(rawCell, col.arraySeparator ?? ',');
            break;
          }
          case 'date': {
            const dt = toSqlDateTime(rawCell);
            if (rawCell && dt === null) {
              errors.push({ column: col.column, message: `La fecha "${rawCell}" no es válida` });
            } else {
              values[col.column] = dt ?? '';
            }
            break;
          }
          default:
            values[col.column] = rawCell;
        }
      }

      let status: RowStatus = 'error';
      let changes: ImportRowResult['changes'];

      if (errors.length === 0) {
        const key = config.matchKeyOf(values);
        if (seenKeys.has(key)) {
          errors.push({ message: 'Este registro está repetido dentro del archivo' });
        } else {
          seenKeys.add(key);
          const dbRow = existingByKey.get(key);
          if (!dbRow) {
            status = 'new';
            newCount++;
          } else {
            const dbValues = config.existingToValues(dbRow);
            if (config.rowsDiffer(values, dbValues)) {
              status = 'update';
              updateCount++;
              changes = config.columns
                .filter((c) => fieldChanged(values[c.column], dbValues[c.column]))
                .map((c) => ({
                  column: c.column,
                  label: c.label,
                  previous: formatCell(dbValues[c.column]),
                  next: formatCell(values[c.column]),
                }));
            } else {
              status = 'unchanged';
              unchangedCount++;
            }
          }
        }
      }
      if (status === 'error') errorCount++;
      results.push({ status, values, errors, changes });
    }

    if (results.length === 0) {
      return { ok: false, message: 'El archivo no contiene registros para importar. Revisá que tenga filas de datos debajo del encabezado.' };
    }

    setPreview({
      fileName,
      csv,
      results,
      unknownHeaders,
      totals: { new: newCount, update: updateCount, unchanged: unchangedCount, error: errorCount },
    });
    setPage(0);
    setStatusFilter('all');
    // Avance automático al Paso 2 sin clic adicional del usuario.
    setStep(2);
    return { ok: true };
  }, [config]);

  // ---------------- Plantilla ----------------
  const downloadTemplate = () => {
    const headers = config.columns.map((c) => c.column);
    const example = config.columns.map((c) =>
      c.kind === 'boolean' ? 'Activo' : c.kind === 'array' ? 'Hardware, Servicios' : c.kind === 'cuit' ? '30123456789' : '',
    );
    downloadTextFile(`plantilla_${config.table}.csv`, toCsv(headers, [example]));
  };

  // ---------------- Paso 3: grabar ----------------
  const runSave = async () => {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    setOutcome(null);
    const toWrite = preview.results.filter((r) => r.status === 'new' || r.status === 'update');
    setProgress({ done: 0, total: toWrite.length });
    let inserted = 0;
    let updated = 0;
    const failures: SaveFailure[] = [];

    try {
      const existing = await config.fetchExisting();
      const existingByKey = new Map<string, { id: string }>();
      for (const row of existing) {
        const values = config.existingToValues(row);
        existingByKey.set(config.matchKeyOf(values), row as unknown as { id: string });
      }

      const news = toWrite.filter((r) => r.status === 'new');
      const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
      for (let i = 0; i < news.length; i += batchSize) {
        const batch = news.slice(i, i + batchSize).map((r) => r.values);
        const { inserted: ok, failed } = await config.insertRows(batch);
        inserted += ok;
        failures.push(...failed);
        setProgress({ done: Math.min(i + batchSize, toWrite.length), total: toWrite.length });
      }

      for (const row of toWrite.filter((r) => r.status === 'update')) {
        const key = config.matchKeyOf(row.values);
        const dbRow = existingByKey.get(key);
        if (!dbRow) {
          failures.push({ label: key, error: 'No se encontró el registro en la base de datos para actualizar.' });
          continue;
        }
        const { error } = await config.updateRow(dbRow.id, row.values);
        if (error) failures.push({ label: key, error });
        else updated += 1;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    } catch (err) {
      // Error inesperado (red, crash): lo registramos completo y lo mostramos en simple.
      console.error('Error inesperado al guardar la importación:', err);
      failures.push({ label: '(general)', error: 'Ocurrió un problema inesperado al guardar. Revisá tu conexión e intentá de nuevo.' });
    }

    setSaving(false);
    setConfirmOpen(false);

    // Si NO se guardó ni un registro, marcamos "allFailed" => título rojo "No se pudo guardar".
    const allFailed = failures.length > 0 && inserted + updated === 0;
    setOutcome({ allFailed, inserted, updated, failures });

    if (failures.length > 0) {
      setSaveError(failures.map((f) => `«${f.label}»: ${f.error}`).join('\n'));
      downloadTextFile(
        `errores_importacion_${config.table}.txt`,
        failures.map((f) => `${f.label}: ${f.error}`).join('\n'),
        'text/plain;charset=utf-8',
      );
    }
    if (failures.length === 0) {
      // Todo guardado: limpiar vista previa, ocultar el botón y refrescar el módulo.
      setPreview(null);
      setStep(1);
      onSaved();
    } else {
      // Refrescamos igualmente: el listado debe reflejar solo lo que existe realmente en la BD.
      onSaved();
    }
  };

  // ---------------- Vista ----------------
  const filteredResults = useMemo(() => {
    if (!preview) return [];
    const order: RowStatus[] = ['error', 'new', 'update', 'unchanged'];
    const list = [...preview.results].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    return statusFilter === 'all' ? list : list.filter((r) => r.status === statusFilter);
  }, [preview, statusFilter]);

  const PAGE_ROWS = 50;
  const pageCount = Math.max(1, Math.ceil(filteredResults.length / PAGE_ROWS));
  const pageRows = filteredResults.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS);

  const cards: { status: RowStatus; label: string; icon: typeof CheckCircle2; classes: string }[] = [
    { status: 'error', label: 'Con error', icon: AlertCircle, classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300' },
    { status: 'new', label: 'Nuevos', icon: PlusCircle, classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
    { status: 'update', label: 'A actualizar', icon: RefreshCw, classes: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300' },
    { status: 'unchanged', label: 'Sin cambios', icon: MinusCircle, classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300 border-gray-300' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Importar ${config.moduleLabel}`}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importar {config.moduleLabel}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {([1, 2] as Step[]).map((s, idx) => (
                <span key={s} className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'} ${(confirmOpen || saving) && s === 2 ? 'ring-2 ring-amber-400' : ''}`}>
                    {idx === 0 ? '1. Subir archivo' : '2. Revisa los datos antes de guardar'}
                  </span>
                  {idx === 0 && <span aria-hidden>→</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={attemptClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {config.dependsOn && config.dependsOn.length > 0 && step <= 2 && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Para completar los datos, primero hay que importar: {config.dependsOn.map((d) => d.moduleLabel).join(', ')}.
            </p>
          )}

          {/* PASO 1 */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
                className={`flex w-full max-w-xl cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/30'
                }`}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                role="button"
                tabIndex={0}
                aria-label="Zona para subir el archivo Excel"
              >
                {converting ? (
                  <>
                    <Loader2 size={36} className="animate-spin text-indigo-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">Leyendo archivo…</p>
                  </>
                ) : (
                  <>
                    <UploadCloud size={36} className="text-indigo-600" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Arrastrá aquí el archivo o hacé clic para seleccionarlo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Formato aceptado: Excel (.xlsx)</p>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
              </div>
              <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                <Download size={16} /> Descargar plantilla
              </button>
              {fileError && (
                <p className="max-w-xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300" role="alert">
                  {fileError} Podés volver a intentar con otro archivo.
                </p>
              )}
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <FileSpreadsheet size={16} /> {preview.fileName} ·{' '}
                  {preview.totals.new} nuevos · {preview.totals.update} a actualizar · {preview.totals.unchanged} sin cambios · {preview.totals.error} con error
                </p>
                <button onClick={() => downloadTextFile(`importacion_${config.table}.csv`, preview.csv)} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                  <Download size={14} /> Descargar CSV
                </button>
              </div>

              {preview.unknownHeaders.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Columnas que no se reconocieron y se ignoraron: {preview.unknownHeaders.join(', ')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cards.map((card) => {
                  const Icon = card.icon;
                  const active = statusFilter === card.status;
                  return (
                    <button
                      key={card.status}
                      onClick={() => { setStatusFilter(active ? 'all' : card.status); setPage(0); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${card.classes} ${active ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                      <Icon size={16} /> {card.label}: {preview.totals[card.status]}
                    </button>
                  );
                })}
              </div>

              <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700" style={{ maxHeight: '320px' }}>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      {config.columns.map((c) => (
                        <th key={c.column} className="px-3 py-2 font-medium">{c.label}</th>
                      ))}
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, idx) => {
                      const errorCols = new Set(row.errors.map((e) => e.column));
                      return (
                        <tr key={idx} className={row.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : idx % 2 ? 'bg-gray-50 dark:bg-gray-900/20' : ''}>
                          <td className="px-3 py-2 text-gray-400">{page * PAGE_ROWS + idx + 1}</td>
                          {config.columns.map((c) => (
                            <td key={c.column} className={`px-3 py-2 ${errorCols.has(c.column) ? 'font-semibold text-red-600 underline decoration-red-400' : ''}`}>
                              {formatCell(row.values[c.column])}
                              {row.status === 'update' && row.changes?.find((ch) => ch.column === c.column) && (
                                <span className="block text-xs text-gray-400">antes: {String(row.changes.find((ch) => ch.column === c.column)?.previous)}</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                          {row.status === 'error' && (
                            <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{row.errors.map((e) => e.message).join(' · ')}</td>
                          )}
                        </tr>
                      );
                    })}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={config.columns.length + 2} className="px-3 py-6 text-center text-gray-500">No hay filas para mostrar con este filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded border px-2 py-1 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={14} /></button>
                  <span>Página {page + 1} de {pageCount}</span>
                  <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="rounded border px-2 py-1 disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          )}

          {/* Resultado de la grabación: banner con título según el caso y acciones */}
          {outcome && outcome.failures.length > 0 && step === 2 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-800 dark:bg-red-900/30" role="alert">
              <h4 className={`flex items-center gap-2 text-sm font-bold ${outcome.allFailed ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {outcome.allFailed ? (
                  <>No se pudo guardar</>
                ) : (
                  <>Guardado parcial: {outcome.inserted + outcome.updated} registro(s) guardados, {outcome.failures.length} con problemas</>
                )}
              </h4>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-red-700 dark:text-red-300">
                {outcome.failures.map((f, i) => (
                  <li key={i}>• «{f.label}»: {f.error}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                Se descargó un archivo con el detalle de los errores. El listado muestra solo lo que realmente está guardado en la base de datos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void runSave()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <RefreshCw size={13} /> Volver a intentar
                </button>
                <button
                  onClick={() => { setOutcome(null); setSaveError(null); }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Volver a la vista previa
                </button>
                <button
                  onClick={attemptClose}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {saving && progress.total > 0 ? `Guardando ${Math.min(progress.done, progress.total)} de ${progress.total}…` : ''}
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && preview && (
              <>
                <button onClick={attemptClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50">Descartar</button>
                {/* Acción principal: abre el modal de confirmación antes de escribir */}
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving || pendingCount === 0}
                  title={pendingCount === 0 ? 'No hay filas nuevas ni con cambios para escribir' : ''}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}
                  Guardar ({pendingCount})
                </button>
              </>
            )}
            {step === 1 && (
              <button onClick={attemptClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Cancelar</button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {confirmOpen && preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¿Actualizar {config.moduleLabel}?</h3>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>• Se crearán {preview.totals.new} registros nuevos.</li>
              <li>• Se actualizarán {preview.totals.update} existentes.</li>
              <li>• {preview.totals.unchanged} quedan sin cambios y {preview.totals.error} tienen errores que se saltarán.</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Volver</button>
              <button onClick={() => void runSave()} disabled={saving} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} Sí, actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- helpers locales ----------

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, [string, string]> = {
    new: ['bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', 'Nuevo'],
    update: ['bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300', 'A actualizar'],
    unchanged: ['bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', 'Sin cambios'],
    error: ['bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', 'Error'],
  };
  const [classes, label] = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{label}</span>;
}

function formatCell(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Activo' : 'Inactivo';
  if (value === null || value === undefined) return '';
  return String(value);
}
