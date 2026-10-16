# Dispositivos y monitoreo remoto

> Documento consolidado. Reemplaza a: `BUSQUEDA_DISPOSITIVOS.md` y `BUSQUEDA_DETALLES_DISPOSITIVOS.md`.
> El detalle del módulo de servidores externos está en `docs/SINCRONIZACION_SERVIDORES.md`.

## Fuente de datos

Los dispositivos provienen de instancias **Mesh Central** registradas en el módulo "Servidores Externos"
(tablas `external_servers` y `synced_devices`, aisladas por RLS por usuario). La sincronización guarda:
`name`, `hostname`, `ip`, `os`, `status` (connected/disconnected), `last_seen`, grupo, CPU y RAM, y puede
vincularse a un equipo propio vía `local_equipment_id`.

## Búsqueda

- Búsqueda incremental sobre nombre, hostname, IP y SO, sin tildes y case-insensitive.
- Filtros combinables: estado (conectado/desconectado), servidor de origen y grupo.
- Debounce ~300 ms; el listado se resuelve en memoria sobre la última sincronización (no se re-consulta
  Mesh Central en cada tecla).

## Detalle de dispositivo

Panel con ficha completa: identificación (nombre/hostname/IP/MAC si disponible), hardware (CPU/RAM),
estado y último avistamiento, servidor Mesh de origen, y vinculación al equipamiento registrado (marca,
modelo, serial, asset tag) cuando existe `local_equipment_id`.

## Buenas prácticas

- Credenciales de Mesh Central: solo lectura desde la app; nunca exponerlas en vistas ni exportarlas en
  reportes.
- Un dispositivo desconectado hace mucho tiempo debe tratarse como dato pos-sincronización (mostrar
  antigüedad del `last_seen`, no hacerlo parecer online).
