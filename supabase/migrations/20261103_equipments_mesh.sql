-- Migración: columnas del servidor de monitoreo remoto en equipments
-- (ejecutada en producción el 2026-11-03).
-- Las completa el botón "Sincronizar con Mesh" de Equipamientos.

begin;

alter table public.equipments
  add column if not exists mesh_node_id         text,         -- id del equipo en MeshCentral
  add column if not exists mesh_so              text,         -- sistema operativo
  add column if not exists mesh_ip              text,         -- última IP conocida
  add column if not exists mesh_grupo           text,         -- sector / grupo de dispositivos
  add column if not exists mesh_en_linea        boolean,      -- conectado al momento de sincronizar
  add column if not exists mesh_ultima_conexion timestamptz,  -- última vez que se conectó
  add column if not exists mesh_sincronizado    timestamptz;  -- última sincronización desde la app

-- Un mismo equipo de MeshCentral no puede quedar duplicado para el mismo usuario
create unique index if not exists equipments_mesh_node_key
  on public.equipments (user_id, mesh_node_id)
  where mesh_node_id is not null;

commit;
