/**
 * facturas.ts — Archivos adjuntos de las facturas de proveedores.
 * Se guardan en Supabase Storage, espacio privado "facturas" (solo usuarios
 * con sesión); para verlos se genera un enlace temporal.
 */
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

const BUCKET = 'facturas';
export const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_ARCHIVO_MB = 10;

/** Valida el archivo; devuelve el motivo si no se puede subir. */
export function problemaArchivo(file: File): string | null {
  if (!TIPOS_ARCHIVO.includes(file.type)) return 'El archivo tiene que ser PDF o imagen (JPG, PNG, WEBP).';
  if (file.size > MAX_ARCHIVO_MB * 1024 * 1024) return `El archivo supera los ${MAX_ARCHIVO_MB} MB.`;
  return null;
}

/** Sube el archivo y devuelve su ruta en Storage y el nombre original. */
export async function subirArchivoFactura(file: File): Promise<{ path: string; nombre: string }> {
  const problema = problemaArchivo(file);
  if (problema) throw new Error(problema);
  const limpio = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${new Date().getFullYear()}/${uuidv4()}-${limpio}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error('No se pudo subir el archivo. Intentá de nuevo más tarde.');
  return { path, nombre: file.name };
}

/** Enlace temporal (10 minutos) para ver o descargar el archivo. */
export async function enlaceArchivoFactura(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error('No se pudo abrir el archivo.');
  return data.signedUrl;
}

export async function borrarArchivoFactura(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
