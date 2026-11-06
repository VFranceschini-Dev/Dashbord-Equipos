-- Migración: eliminar tablas de la integración anterior con MeshCentral
-- (ejecutada en producción el 2026-11-03).
-- Ninguna pantalla las usaba y estaban vacías. external_servers tenía una
-- columna password sin cifrar. La sincronización actual usa api/mesh.ts con
-- credenciales en variables de entorno.
--
-- Verificación previa (debía dar 0 | 0):
--   select (select count(*) from public.synced_devices)   as dispositivos,
--          (select count(*) from public.external_servers) as servidores;

begin;
drop table if exists public.synced_devices;    -- primero: depende de external_servers
drop table if exists public.external_servers;
commit;
