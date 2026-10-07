# 🚀 Guía Rápida de Configuración - Supabase

## ⚡ Configuración en 5 Minutos

### 1️⃣ Crear Proyecto en Supabase (2 minutos)

1. Ve a [https://supabase.com](https://supabase.com)
2. Click en **"Start your project"**
3. Inicia sesión con GitHub o crea una cuenta
4. Click en **"New Project"**
5. Completa:
   - **Name**: `sistema-control-toner`
   - **Database Password**: (genera una contraseña segura y guárdala)
   - **Region**: Selecciona la más cercana (ej: South America)
   - **Pricing Plan**: Free (suficiente para desarrollo)
6. Click en **"Create new project"**
7. Espera 2-3 minutos a que se cree

---

### 2️⃣ Obtener Credenciales (30 segundos)

1. En tu proyecto, ve a **Settings** (engranaje ⚙️ en el menú lateral)
2. Click en **"API"**
3. Copia estos dos valores:

```
Project URL: https://abcdefghijk.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 3️⃣ Configurar Variables de Entorno (30 segundos)

1. Abre el archivo `.env` en la raíz del proyecto
2. Reemplaza con tus credenciales:

```env
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Guarda el archivo

---

### 4️⃣ Crear Tablas en Supabase (1 minuto)

1. En Supabase, ve a **SQL Editor** (icono de base de datos 🗄️)
2. Click en **"New query"**
3. Abre el archivo `supabase-schema.sql` en tu proyecto
4. **Copia TODO el contenido** del archivo
5. **Pega** en el editor SQL de Supabase
6. Click en **"Run"** (botón verde abajo a la derecha) o presiona `Ctrl+Enter`
7. Espera a que se ejecute (debería decir "Success. No rows returned")

**Verificación:**
- Ve a **Table Editor** (menú lateral)
- Deberías ver 10 tablas:
  - ✅ printers
  - ✅ toner_items
  - ✅ movements
  - ✅ equipments
  - ✅ suppliers
  - ✅ collaborators
  - ✅ vouchers
  - ✅ external_servers
  - ✅ synced_devices
  - ✅ alerts

---

### 5️⃣ Instalar y Ejecutar (30 segundos)

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm run dev
```

Abre tu navegador en `http://localhost:5173`

---

## ✅ Verificación Final

### Prueba 1: Crear Datos
1. En la aplicación, ve a **"Impresoras"**
2. Click en **"Nueva Impresora"**
3. Completa los datos y guarda
4. Ve a Supabase → **Table Editor** → **printers**
5. Deberías ver el registro creado ✅

### Prueba 2: Sincronización
1. Cierra la aplicación
2. Vuelve a abrirla
3. Los datos deberían estar ahí ✅

### Prueba 3: Multi-dispositivo
1. Abre la aplicación en otro navegador o dispositivo
2. Inicia sesión con el mismo usuario
3. Los datos deberían sincronizarse ✅

---

## 🐛 Solución de Problemas Comunes

### Error: "Failed to fetch"

**Solución:**
```bash
# Verifica que el archivo .env existe y tiene las credenciales correctas
cat .env

# Reinicia el servidor
npm run dev
```

### Error: "new row violates row-level security policy"

**Solución:**
1. Ve a Supabase → **Authentication** → **Policies**
2. Verifica que las políticas RLS están habilitadas
3. Ejecuta este SQL:

```sql
-- Deshabilitar RLS temporalmente para desarrollo
ALTER TABLE printers DISABLE ROW LEVEL SECURITY;
ALTER TABLE toner_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipments DISABLE ROW LEVEL SECURITY;
-- ... repite para todas las tablas
```

⚠️ **Solo para desarrollo**. En producción, mantén RLS habilitado.

### Las tablas no se crean

**Solución:**
1. Verifica que copiaste TODO el contenido de `supabase-schema.sql`
2. Revisa los errores en la consola de SQL
3. Intenta crear las tablas una por una

### Error: "column does not exist"

**Solución:**
1. Verifica que el esquema se ejecutó correctamente
2. Revisa la estructura de la tabla en Supabase
3. Compara con el archivo `supabase-schema.sql`

---

## 📊 Monitoreo

### Ver Datos en Supabase

1. Ve a **Table Editor** (menú lateral)
2. Selecciona la tabla que quieres ver
3. Verás todos los registros

### Ver Logs de API

1. Ve a **Logs** (menú lateral)
2. Click en **"API Logs"**
3. Verás todas las consultas realizadas

### Ver Uso de Recursos

1. Ve a **Settings** → **Billing**
2. Verás el uso de:
   - Almacenamiento
   - Ancho de banda
   - Consultas

---

## 🎯 Próximos Pasos

### Para Desarrollo

1. ✅ Configurar Supabase (hecho)
2. ✅ Crear tablas (hecho)
3. ✅ Probar sincronización (hecho)
4. 🔄 Implementar autenticación real
5. 🔄 Agregar más funcionalidades

### Para Producción

1. 🔒 Configurar autenticación con Supabase Auth
2. 🔒 Habilitar RLS en todas las tablas
3. 🔒 Configurar backups automáticos
4. 🔒 Implementar encriptación de datos sensibles
5. 🔒 Configurar dominio personalizado
6. 🔒 Habilitar 2FA

---

## 📞 Soporte

Si tienes problemas:

1. Revisa la documentación completa: `INTEGRACION_SUPABASE.md`
2. Consulta los logs en Supabase
3. Revisa la consola del navegador (F12)
4. Contacta al equipo de desarrollo

---

## 🎉 ¡Listo!

Tu sistema ahora está conectado a Supabase y todos los datos se sincronizan automáticamente con la base de datos en la nube.

**Desarrollado por:** VLF dev para Sistemas PEDSA  
**Versión:** 2.5.0
