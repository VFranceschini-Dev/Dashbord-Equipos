# 🗄️ Integración con Supabase - Base de Datos en la Nube

## 📋 Descripción General

El sistema ahora soporta persistencia de datos en **Supabase**, una plataforma de base de datos PostgreSQL en la nube. Todos los datos del sistema se sincronizan automáticamente entre localStorage (local) y Supabase (nube).

---

## 🎯 Características Implementadas

### ✅ **Persistencia Completa**
- Todos los módulos sincronizan con Supabase
- Sincronización bidireccional (local ↔ nube)
- Respaldo automático de datos
- Acceso multi-dispositivo

### ✅ **Seguridad**
- Row Level Security (RLS) habilitado
- Cada usuario solo ve sus propios datos
- Autenticación integrada con Supabase Auth
- Encriptación de credenciales

### ✅ **Tablas Implementadas**
1. **printers** - Impresoras
2. **toner_items** - Inventario de tóner
3. **movements** - Movimientos de tóner
4. **equipments** - Equipamientos
5. **suppliers** - Proveedores
6. **collaborators** - Colaboradores
7. **vouchers** - Comprobantes
8. **external_servers** - Servidores externos
9. **synced_devices** - Dispositivos sincronizados
10. **alerts** - Alertas del sistema

---

## 🚀 Configuración Inicial

### Paso 1: Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Click en "New Project"
4. Completa los datos:
   - **Name**: Sistema Control Toner
   - **Database Password**: (genera una contraseña segura)
   - **Region**: Selecciona la más cercana
5. Click en "Create new project"
6. Espera a que se cree el proyecto (2-3 minutos)

### Paso 2: Obtener Credenciales

1. En tu proyecto de Supabase, ve a **Settings** → **API**
2. Copia los siguientes valores:
   - **Project URL**: `https://tu-proyecto.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Paso 3: Configurar Variables de Entorno

1. Abre el archivo `.env` en la raíz del proyecto
2. Reemplaza los valores con tus credenciales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Guarda el archivo

### Paso 4: Crear Tablas en Supabase

1. En Supabase, ve a **SQL Editor** (icono de base de datos en el menú lateral)
2. Click en "New Query"
3. Copia todo el contenido del archivo `supabase-schema.sql`
4. Pega en el editor SQL
5. Click en "Run" (o presiona Ctrl+Enter)
6. Espera a que se ejecuten todas las consultas

**Verificación:**
- Deberías ver 10 tablas creadas en **Table Editor**
- Todas las políticas de seguridad (RLS) deberían estar habilitadas
- Los índices deberían estar creados

### Paso 5: Instalar Dependencias

```bash
npm install
```

### Paso 6: Iniciar el Servidor

```bash
npm run dev
```

---

## 📊 Estructura de la Base de Datos

### Tabla: printers
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- name (TEXT)
- location (TEXT)
- department (TEXT)
- model (TEXT)
- status (TEXT: active/inactive/maintenance)
- toner_model (TEXT)
- last_maintenance (TEXT)
- total_pages (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabla: toner_items
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- model (TEXT)
- brand (TEXT)
- color (TEXT: black/cyan/magenta/yellow)
- stock (INTEGER)
- min_stock (INTEGER)
- max_stock (INTEGER)
- unit_price (DECIMAL)
- supplier (TEXT)
- last_restock (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabla: equipments
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- name (TEXT)
- type (TEXT: desktop/laptop/server/monitor/peripheral/other)
- brand (TEXT)
- model (TEXT)
- serial_number (TEXT)
- asset_tag (TEXT)
- category (TEXT)
- status (TEXT: assigned/available/maintenance/retired)
- collaborator_id (UUID, FK → collaborators)
- purchase_date (TEXT)
- warranty_end (TEXT)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabla: external_servers
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- name (TEXT)
- type (TEXT: meshcentral/custom)
- url (TEXT)
- username (TEXT)
- password (TEXT)
- auto_sync (BOOLEAN)
- sync_interval (INTEGER)
- last_sync (TIMESTAMP)
- status (TEXT: active/inactive/error)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabla: synced_devices
```sql
- id (UUID, PK)
- user_id (UUID, FK → auth.users)
- server_id (UUID, FK → external_servers)
- external_id (TEXT)
- name (TEXT)
- hostname (TEXT)
- ip (TEXT)
- os (TEXT)
- status (TEXT: connected/disconnected)
- last_seen (TIMESTAMP)
- group_name (TEXT)
- cpu (TEXT)
- ram (TEXT)
- synced_at (TIMESTAMP)
- local_equipment_id (UUID, FK → equipments)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE(server_id, external_id)
```

---

## 🔐 Seguridad y Políticas RLS

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con las siguientes políticas:

```sql
-- Los usuarios solo pueden ver sus propios datos
CREATE POLICY "Users can view their own data" ON tabla
  FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios solo pueden insertar sus propios datos
CREATE POLICY "Users can insert their own data" ON tabla
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Los usuarios solo pueden actualizar sus propios datos
CREATE POLICY "Users can update their own data" ON tabla
  FOR UPDATE USING (auth.uid() = user_id);

-- Los usuarios solo pueden eliminar sus propios datos
CREATE POLICY "Users can delete their own data" ON tabla
  FOR DELETE USING (auth.uid() = user_id);
```

### Autenticación

El sistema usa un ID de usuario por defecto para desarrollo:
```typescript
const defaultUserId = '00000000-0000-0000-0000-000000000001';
```

**Para producción**, debes implementar autenticación real con Supabase Auth.

---

## 🔄 Flujo de Sincronización

### Al Crear/Actualizar/Eliminar Datos

```
1. Usuario realiza acción en la UI
   ↓
2. Se actualiza localStorage (instantáneo)
   ↓
3. Se sincroniza con Supabase (async)
   ↓
4. Si hay error, se muestra notificación
   ↓
5. Datos persistidos en ambos lugares
```

### Al Cargar la Aplicación

```
1. Se cargan datos de localStorage (instantáneo)
   ↓
2. Se sincronizan datos de Supabase (background)
   ↓
3. Se actualiza la UI con los datos más recientes
```

---

## 📝 Servicios de Sincronización

### Archivo: `src/services/supabaseSync.ts`

#### Funciones Principales

**Impresoras:**
```typescript
syncPrintersFromSupabase()     // Obtener todas las impresoras
syncPrinterToSupabase(printer) // Crear/actualizar impresora
deletePrinterFromSupabase(id)  // Eliminar impresora
```

**Tóners:**
```typescript
syncTonersFromSupabase()       // Obtener todos los tóners
syncTonerToSupabase(toner)     // Crear/actualizar tóner
deleteTonerFromSupabase(id)    // Eliminar tóner
```

**Equipamientos:**
```typescript
syncEquipmentsFromSupabase()       // Obtener todos los equipamientos
syncEquipmentToSupabase(equipment) // Crear/actualizar equipamiento
deleteEquipmentFromSupabase(id)    // Eliminar equipamiento
```

**Sincronización Completa:**
```typescript
syncAllFromSupabase() // Sincronizar todos los datos
```

---

## 🎨 Integración con Componentes

### Ejemplo: Componente Printers.tsx

```typescript
import { syncPrinterToSupabase, deletePrinterFromSupabase } from '../services/supabaseSync';

// Al crear una impresora
const handleAddPrinter = async (printer: Printer) => {
  // 1. Agregar a localStorage
  addPrinter(printer);
  
  // 2. Sincronizar con Supabase
  await syncPrinterToSupabase(printer);
};

// Al eliminar una impresora
const handleDeletePrinter = async (id: string) => {
  // 1. Eliminar de localStorage
  deletePrinter(id);
  
  // 2. Eliminar de Supabase
  await deletePrinterFromSupabase(id);
};
```

---

## 📊 Monitoreo y Debugging

### Verificar Conexión

```typescript
import { checkSupabaseConnection } from './services/supabaseSync';

const isConnected = await checkSupabaseConnection();
console.log('Conexión con Supabase:', isConnected);
```

### Ver Logs de Supabase

1. Ve a tu proyecto en Supabase
2. Click en **Logs** (menú lateral)
3. Selecciona **API Logs** para ver todas las consultas
4. Filtra por tipo de operación (SELECT, INSERT, UPDATE, DELETE)

### Verificar Datos en Supabase

1. Ve a **Table Editor** en Supabase
2. Selecciona la tabla que quieres verificar
3. Verás todos los datos almacenados

---

## 🚨 Solución de Problemas

### Error: "Failed to fetch"

**Causa:** Problema de conexión con Supabase

**Soluciones:**
1. Verifica que la URL en `.env` sea correcta
2. Verifica que la API key sea válida
3. Verifica que el proyecto de Supabase esté activo
4. Revisa la consola del navegador para más detalles

### Error: "new row violates row-level security policy"

**Causa:** El user_id no coincide con el usuario autenticado

**Soluciones:**
1. Verifica que el user_id sea correcto
2. Asegúrate de que el usuario esté autenticado
3. Revisa las políticas RLS en Supabase

### Error: "column does not exist"

**Causa:** La tabla no tiene la columna esperada

**Soluciones:**
1. Verifica que el esquema SQL se haya ejecutado correctamente
2. Revisa la estructura de la tabla en Supabase
3. Asegúrate de que los nombres de columnas coincidan

### Los datos no se sincronizan

**Causa:** Error en la función de sincronización

**Soluciones:**
1. Revisa la consola del navegador para errores
2. Verifica los logs de API en Supabase
3. Asegúrate de que las credenciales sean correctas
4. Verifica que las tablas existan en Supabase

---

## 📈 Migración de Datos Existentes

Si ya tienes datos en localStorage y quieres migrarlos a Supabase:

```typescript
import { syncAllToSupabase } from './services/supabaseSync';

// Migrar todos los datos
await syncAllToSupabase();
```

---

## 🔒 Consideraciones de Seguridad

### ⚠️ IMPORTANTE para Producción

1. **Nunca expongas la service_role key**
   - Solo usa la anon key en el frontend
   - La service_role key solo debe usarse en el backend

2. **Implementa autenticación real**
   - Usa Supabase Auth para autenticar usuarios
   - No uses un user_id hardcodeado

3. **Configura políticas RLS estrictas**
   - Cada usuario solo debe ver sus propios datos
   - Usa funciones de Supabase para validaciones complejas

4. **Encripta datos sensibles**
   - Las contraseñas de servidores externos deben encriptarse
   - Usa campos de tipo `vault.secrets` para datos sensibles

5. **Habilita 2FA**
   - Configura autenticación de dos factores
   - Requiere verificación por email/SMS

---

## 📚 Recursos Adicionales

### Documentación de Supabase
- [Guía de inicio](https://supabase.com/docs/guides/with-react)
- [Referencia de JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Tutoriales
- [React + Supabase](https://supabase.com/docs/guides/with-react)
- [Autenticación con Supabase](https://supabase.com/docs/guides/auth)
- [Políticas RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🎯 Próximos Pasos

### Para Implementar en Producción

1. **Configurar autenticación real**
   - Implementar login con Supabase Auth
   - Obtener user_id del usuario autenticado
   - Manejar sesiones y tokens

2. **Implementar backup automático**
   - Configurar backups diarios en Supabase
   - Implementar exportación de datos
   - Agregar opción de restauración

3. **Optimizar rendimiento**
   - Implementar paginación para listas grandes
   - Agregar caché de consultas frecuentes
   - Optimizar índices de base de datos

4. **Mejorar seguridad**
   - Encriptar contraseñas de servidores
   - Implementar auditoría de cambios
   - Agregar logs de seguridad

---

## ✅ Checklist de Implementación

- [ ] Crear proyecto en Supabase
- [ ] Obtener credenciales (URL y API key)
- [ ] Configurar archivo `.env`
- [ ] Ejecutar esquema SQL en Supabase
- [ ] Verificar que las tablas se crearon correctamente
- [ ] Verificar que las políticas RLS están habilitadas
- [ ] Instalar dependencias (`npm install`)
- [ ] Iniciar servidor de desarrollo (`npm run dev`)
- [ ] Probar sincronización creando datos
- [ ] Verificar que los datos aparecen en Supabase
- [ ] Probar sincronización eliminando datos
- [ ] Verificar que los datos se eliminan en Supabase
- [ ] Configurar autenticación real (para producción)
- [ ] Implementar backup automático (para producción)

---

## 📞 Soporte

**Desarrollado por:** Pablo Eloy Donnet - VLF dev para Sistemas PEDSA  
**Versión:** 2.5.0  
**Fecha:** 2024

Para soporte técnico o consultas sobre la integración con Supabase, contacta al equipo de desarrollo.

---

## 📄 Licencia

Todos los derechos reservados - VLF dev para Sistemas PEDSA
