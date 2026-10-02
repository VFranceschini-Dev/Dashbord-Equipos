# Test de Conexión MeshCentral

## 📋 Descripción

Herramienta integrada en la aplicación web para probar la conexión con servidores MeshCentral, obtener la lista de PCs conectadas y buscar equipos específicos por nombre.

## 🚀 Cómo Usar

### 1. Acceder a la Herramienta

Desde el menú lateral de la aplicación, haz clic en **"Test MeshCentral"** (icono de servidor).

### 2. Configurar la Conexión

Completa los siguientes campos:

- **URL del Servidor**: Dirección del servidor MeshCentral (ej: `https://mesh.donnet.com.ar`)
- **Usuario**: Tu nombre de usuario de MeshCentral
- **Contraseña**: Tu contraseña de MeshCentral
- **Buscar PC por Nombre** (opcional): Nombre de la PC que quieres buscar específicamente

### 3. Probar Conexión

Haz clic en el botón **"🔌 Probar Conexión"**.

El sistema:
1. Establecerá conexión WebSocket con el servidor
2. Autenticará con las credenciales proporcionadas
3. Obtendrá la lista completa de PCs/nodos
4. Mostrará estadísticas y detalles

### 4. Ver Resultados

#### Estadísticas
Verás tres tarjetas con:
- **Total PCs**: Cantidad total de equipos registrados
- **Conectadas**: PCs actualmente en línea (verde)
- **Desconectadas**: PCs fuera de línea (rojo)

#### Búsqueda de PC Específica
Si ingresaste un nombre de PC en el campo de búsqueda:
- Si se encuentra: Se mostrará una tarjeta amarilla con todos los detalles
- Si no se encuentra: Se mostrará un mensaje indicando que no se encontró

#### Lista Completa de PCs
Debajo de las estadísticas, verás la lista completa de todas las PCs con:
- Nombre del equipo
- Hostname
- Dirección IP
- Sistema operativo
- Estado (conectada/desconectada)
- Grupo (si está asignada)
- CPU y RAM (si está disponible)

### 5. Exportar Resultados

Haz clic en **"📥 Exportar Resultados"** para descargar un archivo JSON con:
- Fecha de la prueba
- URL del servidor
- Lista completa de PCs
- PC buscada (si aplica)

### 6. Ver Log de Operaciones

En la parte inferior, verás el log en tiempo real de todas las operaciones:
- Conexiones
- Autenticaciones
- Errores
- Búsquedas
- Exportaciones

## 🎯 Funcionalidades

✅ **Conexión WebSocket** en tiempo real  
✅ **Autenticación segura** con usuario y contraseña  
✅ **Estadísticas visuales** con tarjetas de colores  
✅ **Búsqueda de PC específica** por nombre o hostname  
✅ **Lista detallada** de todas las PCs  
✅ **Indicadores de estado** (verde/rojo)  
✅ **Exportación de resultados** en formato JSON  
✅ **Log en tiempo real** de todas las operaciones  
✅ **Soporte para modo oscuro**  
✅ **Manejo de errores** con mensajes claros  
✅ **Timeout automático** después de 10 segundos  

## 🔍 Ejemplos de Uso

### Ejemplo 1: Verificar Conexión Básica

```
1. URL: https://mesh.donnet.com.ar
2. Usuario: admin
3. Contraseña: tu_password
4. Click en "Probar Conexión"
5. Verás las estadísticas y lista de PCs
```

### Ejemplo 2: Buscar una PC Específica

```
1. URL: https://mesh.donnet.com.ar
2. Usuario: admin
3. Contraseña: tu_password
4. Buscar PC: "PC-CONTABILIDAD-01"
5. Click en "Probar Conexión"
6. Si existe, verás todos sus detalles en la tarjeta amarilla
```

### Ejemplo 3: Exportar Inventario

```
1. Conéctate al servidor
2. Espera a que cargue la lista de PCs
3. Click en "📥 Exportar Resultados"
4. Se descargará un archivo JSON con toda la información
```

## 📊 Información Mostrada por PC

Cada PC muestra:
- **Nombre**: Identificador del equipo
- **Hostname**: Nombre de host del sistema
- **IP**: Dirección IP del equipo
- **SO**: Sistema operativo instalado
- **Estado**: Conectada (🟢) o Desconectada (🔴)
- **Grupo**: Grupo al que pertenece (si está asignada)
- **CPU**: Procesador (si está disponible)
- **RAM**: Memoria RAM (si está disponible)
- **Versión del Agente**: Versión del agente MeshCentral

## 🔧 Solución de Problemas

### Error: "No se pudo conectar"

**Posibles causas:**
1. URL del servidor incorrecta
2. Servidor MeshCentral no está accesible
3. Firewall bloqueando la conexión WebSocket
4. El servidor no tiene `allowFraming: true` configurado

**Solución:**
- Verifica la URL del servidor
- Asegúrate de que el servidor esté en línea
- Revisa la configuración del servidor MeshCentral

### Error: "Error de autenticación"

**Posibles causas:**
1. Usuario incorrecto
2. Contraseña incorrecta
3. Usuario no tiene permisos

**Solución:**
- Verifica las credenciales
- Asegúrate de que el usuario tenga permisos en MeshCentral

### Las PCs no se muestran

**Posibles causas:**
1. No hay PCs registradas en MeshCentral
2. El agente no está instalado en las PCs
3. Problema de permisos

**Solución:**
- Verifica que haya PCs registradas en MeshCentral
- Asegúrate de que el agente esté instalado y funcionando

### Timeout de conexión

**Causa:**
- La conexión tardó más de 10 segundos

**Solución:**
- Verifica tu conexión a Internet
- Verifica que el servidor MeshCentral esté respondiendo
- Intenta nuevamente

## 📝 Notas Técnicas

### Conexión WebSocket

El sistema usa WebSocket para comunicarse con MeshCentral:
- Protocolo: `wss://` (WebSocket Secure)
- Endpoint: `/meshrelay.ashx`
- Autenticación: Via mensaje JSON con usuario y contraseña

### Estructura de Datos

Cada nodo/PC tiene la siguiente estructura:
```typescript
interface MeshNode {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'connected' | 'disconnected';
  lastSeen: string;
  group?: string;
  agentVersion?: string;
  cpu?: string;
  ram?: string;
}
```

### Búsqueda

La búsqueda es:
- **Case-insensitive**: No distingue mayúsculas/minúsculas
- **Partial match**: Busca coincidencias parciales
- **Busca en**: Nombre y Hostname

## 🔐 Seguridad

- Las credenciales se usan solo para la conexión WebSocket
- No se almacenan permanentemente (excepto si las guardas en Administración)
- La conexión usa WebSocket seguro (WSS)
- Se recomienda usar un usuario con permisos limitados

## 📞 Soporte

Si necesitas ayuda:
1. Revisa el log de operaciones para ver errores específicos
2. Verifica la configuración del servidor MeshCentral
3. Asegúrate de que las credenciales sean correctas
4. Contacta al administrador del servidor MeshCentral

---

**Desarrollado por:** Area Sistemas PEDSA  
**Versión:** 2.0.0  
**Integrado en:** Sistema de Control de Tóner
