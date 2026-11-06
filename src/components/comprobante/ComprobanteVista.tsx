import type { DatosComprobante } from '../../services/comprobantes';
import { cssDeFuente, formatearDni } from '../../constants/firmas';

const TIPO_LABEL: Record<string, string> = {
  desktop: 'PC Escritorio', laptop: 'Notebook', server: 'Servidor',
  monitor: 'Monitor', peripheral: 'Periférico', other: 'Otro',
};

/** Firma tipográfica: el nombre en la letra elegida, con aclaración y DNI. */
export function FirmaTipografica({ nombre, dni, fuente, rol, detalle }: {
  nombre: string;
  dni: string;
  fuente: string;
  rol: string;
  detalle?: string;
}) {
  return (
    <div className="text-center">
      <div className="h-16 flex items-end justify-center">
        <span style={{ fontFamily: cssDeFuente(fuente), fontSize: '2rem', lineHeight: 1 }} className="text-gray-900">{nombre}</span>
      </div>
      <div className="border-t border-gray-400 mt-1 pt-1 text-xs text-gray-700">
        <p className="font-medium">{nombre}</p>
        <p>DNI {formatearDni(dni)}</p>
        <p className="text-gray-500">{rol}</p>
        {detalle && <p className="text-[10px] text-gray-400 mt-0.5">{detalle}</p>}
      </div>
    </div>
  );
}

/** Espacio de firma todavía vacío. */
function FirmaPendiente({ rol }: { rol: string }) {
  return (
    <div className="text-center">
      <div className="h-16 flex items-end justify-center text-sm text-amber-600 italic">Pendiente de firma</div>
      <div className="border-t border-gray-400 mt-1 pt-1 text-xs text-gray-500">{rol}</div>
    </div>
  );
}

/** Logo de la empresa (public/logo-donnet.png). */
function Logo() {
  return <img src="/logo-donnet.png" alt="Donnet" className="h-8 sm:h-9 w-auto" />;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-900 min-w-0 break-words [overflow-wrap:anywhere]">{value || '—'}</span>
    </div>
  );
}

/**
 * Documento del comprobante de entrega. Se usa en la página de firma y para
 * imprimir/guardar como PDF (el contenedor tiene la clase "comprobante-imprimible").
 */
export default function ComprobanteVista({ numero, datos, hashDocumento, firmaUsuario }: {
  numero: string;
  datos: DatosComprobante;
  hashDocumento: string;
  firmaUsuario?: { nombre: string; dni: string; fuente: string; fecha: string; ip: string; hash: string } | null;
}) {
  const fecha = new Date(datos.fecha).toLocaleString('es-AR');
  return (
    <article className="comprobante-imprimible bg-white text-gray-900 rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <Logo />
        <div className="text-right text-sm">
          <p className="font-semibold">Comprobante de entrega de equipamiento</p>
          <p className="text-gray-500">N.º {numero}</p>
          <p className="text-gray-500">{fecha}</p>
        </div>
      </header>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-1">Equipo entregado</h3>
        <Dato label="Equipo" value={datos.equipo.nombre} />
        <Dato label="Tipo" value={TIPO_LABEL[datos.equipo.tipo] ?? datos.equipo.tipo} />
        <Dato label="Marca" value={datos.equipo.marca} />
        <Dato label="Modelo" value={datos.equipo.modelo} />
        <Dato label="Serial" value={datos.equipo.serial} />
        {datos.equipo.etiqueta && <Dato label="Etiqueta" value={datos.equipo.etiqueta} />}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-1">Recibe</h3>
        <Dato label="Nombre" value={datos.usuario.nombre} />
        {datos.usuario.area && <Dato label="Área" value={datos.usuario.area} />}
        <Dato label="Correo" value={datos.usuario.correo} />
        {datos.observaciones && <Dato label="Observaciones" value={datos.observaciones} />}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase text-gray-500 mb-1">Conformidad</h3>
        <p className="text-sm leading-relaxed text-gray-800">{datos.conformidad}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
        <FirmaTipografica nombre={datos.responsable.nombre} dni={datos.responsable.dni} fuente={datos.responsable.fuente}
          rol={`Entrega — Sistemas ${datos.empresa}`} />
        {firmaUsuario ? (
          <FirmaTipografica nombre={firmaUsuario.nombre} dni={firmaUsuario.dni} fuente={firmaUsuario.fuente} rol="Recibe"
            detalle={`Firmado electrónicamente el ${new Date(firmaUsuario.fecha).toLocaleString('es-AR')}${firmaUsuario.ip ? ` · IP ${firmaUsuario.ip}` : ''}`} />
        ) : (
          <FirmaPendiente rol="Recibe" />
        )}
      </section>

      <footer className="border-t border-gray-200 pt-3 text-[10px] text-gray-400 break-all space-y-0.5">
        <p>Huella del documento (SHA-256): {hashDocumento}</p>
        {firmaUsuario && <p>Huella de la firma (SHA-256): {firmaUsuario.hash}</p>}
        <p>Firma electrónica: nombre, DNI y aceptación registrados con fecha, hora e IP. Cualquier cambio en el contenido altera la huella.</p>
      </footer>
    </article>
  );
}
