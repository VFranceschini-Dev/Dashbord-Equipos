# Módulos del sistema

> Documento consolidado. Fuentes de detalle conservadas en `docs/`:
> alertas de tóner (`ALERTAS_COMPATIBILIDAD_TONER.md`), categorías de proveedores
> (`MULTIPLES_CATEGORIAS_PROVEEDORES.md`) y dispositivos (`docs/dispositivos.md`).

| Módulo | Descripción | Tablas Supabase |
|---|---|---|
| **Dashboard** | Panel con estadísticas en tiempo real, alertas de stock bajo y toggle de tema (el toggle vive solo en `Layout.tsx`). | todas (agregaciones) |
| **Equipamientos** | ABM completo de hardware: type (`desktop`, `laptop`, `server`, `monitor`, `peripheral`, `other`), brand, model, serial_number, asset_tag, status (`assigned`, `available`, `maintenance`, `retired`). Importación CSV/Excel. Historial de movimientos vía `/api/usuarios` + `equipment_movements`. | `equipments`, `equipment_movements` |
| **Colaboradores** | Gestión de personal; `equipments.collaborator_id` referencia esta tabla. | `collaborators` |
| **Proveedores** | CUIT, contacto y **múltiples categorías** por proveedor (`category TEXT[]`). | `suppliers` |
| **Comprobantes** | Facturas, recibos, órdenes de compra, remitos y notas de crédito; moneda ARS/USD; vínculo a equipos importados. | `vouchers` |
| **Impresoras** | Modelo, ubicación, departamento, modelo de tóner compatible, mantenimiento y páginas totales. | `printers` |
| **Inventario (Tóner)** | Stock con mínimos/máximos y **alertas de compatibilidad** por impresora. | `toner_items` |
| **Movimientos (Tóner)** | Entregas, devoluciones, reposiciones y desechos. Inmutables: no hay política UPDATE. | `toner_movements` |
| **Servidores Externos / Dispositivos** | Conexión a Mesh Central, sincronización y monitoreo remoto. Ver `docs/dispositivos.md`. | `external_servers`, `synced_devices` |
| **Reportes** | Análisis y exportación JSON. | lecturas |
| **Importar Datos** | Importación masiva multi-formato desde un modal reutilizable. Ver `docs/importacion.md`. | según módulo destino |
| **Alertas** | Bajo stock, mantenimiento, información y fuera de horario. | `alerts` |

## Reglas transversales

- Todo ABM persiste primero en Supabase (RLS por `user_id`) y recién después actualiza el estado.
- Búsquedas sin tildes e insensibles a mayúsculas en todos los listados.
- Los usuarios de SAI_TEST (origen: proxy Metabase `ipa.donnet.com.ar/api` vía función serverless) se
  referencian con `usuario_ref` + copia de nombre/login para que el historial sobreviva si la fuente
  externa no responde.
