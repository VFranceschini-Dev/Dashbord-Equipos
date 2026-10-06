# 🔒 Migración a Autenticación con Backend

## ⚠️ Estado Actual

El sistema actualmente utiliza autenticación hardcodeada en el frontend:

```typescript
// src/context/AuthContext.tsx
const DEFAULT_USERS = [
  { email: 'soporte@donnet.com.ar', password: 'Admin2024!Seguro', name: 'Administrador', role: 'admin' },
  { email: 'usuario@donnet.com.ar', password: 'User2024!Test', name: 'Ana García', role: 'user' },
];
```

### Problemas de Seguridad

1. ❌ **Credenciales visibles en el código fuente**
2. ❌ **No hay encriptación de contraseñas**
3. ❌ **No hay validación contra base de datos**
4. ❌ **No hay tokens de sesión**
5. ❌ **No hay protección contra ataques de fuerza bruta**
6. ❌ **No hay logs de auditoría de acceso**

---

## 🎯 Solución Propuesta: Backend de Autenticación

### Arquitectura Recomendada

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Backend API   │
│   (Node.js/     │
│    Express)     │
└────────┬────────┘
         │
         │
┌────────▼────────┐
│   Database      │
│   (PostgreSQL/  │
│    MongoDB)     │
└─────────────────┘
```

### Opciones de Implementación

#### Opción 1: Backend Propio (Node.js + Express)

**Ventajas:**
- ✅ Control total sobre la lógica de autenticación
- ✅ Integración directa con la base de datos existente
- ✅ Personalización completa

**Tecnologías:**
- Node.js + Express
- JWT (JSON Web Tokens)
- bcrypt (hash de contraseñas)
- PostgreSQL o MongoDB

**Estructura:**
```
backend/
├── src/
│   ├── controllers/
│   │   └── authController.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── auth.js
│   ├── middleware/
│   │   └── auth.js
│   └── utils/
│       └── jwt.js
├── .env
└── package.json
```

#### Opción 2: Backend como Servicio (BaaS)

**Opciones:**
- **Supabase** - Open source, PostgreSQL, auth incluido
- **Firebase** - Google, fácil integración
- **Auth0** - Especializado en autenticación
- **Clerk** - Moderno, fácil de usar

**Ventajas:**
- ✅ Rápida implementación
- ✅ Seguridad gestionada por expertos
- ✅ Escalabilidad automática
- ✅ Menos mantenimiento

#### Opción 3: API Gateway + Microservicios

**Para sistemas más complejos:**
- API Gateway (Kong, AWS API Gateway)
- Microservicio de autenticación
- OAuth 2.0 / OpenID Connect

---

## 📋 Plan de Migración

### Fase 1: Preparación (1-2 semanas)

#### 1.1 Configurar Base de Datos

```sql
-- Ejemplo para PostgreSQL
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Índices para mejor performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### 1.2 Crear Backend API

**Endpoints necesarios:**

```
POST   /api/auth/login          - Iniciar sesión
POST   /api/auth/logout         - Cerrar sesión
POST   /api/auth/refresh        - Renovar token
GET    /api/auth/me             - Obtener usuario actual
PUT    /api/auth/password       - Cambiar contraseña
POST   /api/auth/forgot-password - Recuperar contraseña
POST   /api/auth/reset-password  - Resetear contraseña
```

#### 1.3 Implementar Seguridad

```javascript
// Ejemplo de login con bcrypt y JWT
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function login(email, password) {
  // 1. Buscar usuario
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  
  if (!user) {
    throw new Error('Credenciales inválidas');
  }
  
  // 2. Verificar contraseña
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    throw new Error('Credenciales inválidas');
  }
  
  // 3. Generar token JWT
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  // 4. Actualizar último login
  await db.query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [user.id]
  );
  
  // 5. Registrar en logs de auditoría
  await auditLog('LOGIN_SUCCESS', user.id, req.ip);
  
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
```

### Fase 2: Integración Frontend (1 semana)

#### 2.1 Crear Servicio de Autenticación

```typescript
// src/services/authService.ts
class AuthService {
  private baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error('Credenciales inválidas');
    }
    
    const data = await response.json();
    
    // Guardar token
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(data.user));
    
    return data;
  }
  
  async logout() {
    const token = localStorage.getItem('auth_token');
    
    await fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }
  
  async getCurrentUser() {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      return null;
    }
    
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      localStorage.removeItem('auth_token');
      return null;
    }
    
    return response.json();
  }
  
  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }
}

export const authService = new AuthService();
```

#### 2.2 Actualizar AuthContext

```typescript
// src/context/AuthContext.tsx
import { authService } from '../services/authService';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user_data');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await authService.login(email, password);
      setUser(data.user);
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Fase 3: Seguridad Adicional (1 semana)

#### 3.1 Implementar Rate Limiting

```javascript
// backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana
  message: 'Demasiados intentos de login. Por favor, intente nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = loginLimiter;
```

#### 3.2 Implementar 2FA (Autenticación de Dos Factores)

```javascript
// Opciones:
// - TOTP (Google Authenticator, Authy)
// - SMS (Twilio)
// - Email (sendgrid, AWS SES)
```

#### 3.3 Logs de Auditoría

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);
```

---

## 🔐 Mejores Prácticas de Seguridad

### 1. Hash de Contraseñas

```javascript
// NUNCA guardar contraseñas en texto plano
const bcrypt = require('bcrypt');
const saltRounds = 12;

// Al registrar usuario
const passwordHash = await bcrypt.hash(password, saltRounds);

// Al verificar login
const isValid = await bcrypt.compare(password, passwordHash);
```

### 2. JWT Seguro

```javascript
// Configuración de JWT
const jwtConfig = {
  secret: process.env.JWT_SECRET, // Usar variable de entorno
  expiresIn: '24h', // Token expira en 24 horas
  algorithm: 'HS256', // Algoritmo seguro
};

// Claims mínimos en el token
const payload = {
  userId: user.id,
  email: user.email,
  role: user.role,
  iat: Math.floor(Date.now() / 1000),
};
```

### 3. Variables de Entorno

```bash
# .env (NUNCA commitear este archivo)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-super-secret-key-here
BCRYPT_ROUNDS=12
NODE_ENV=production
```

### 4. HTTPS Obligatorio

```javascript
// Redirigir HTTP a HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

### 5. Headers de Seguridad

```javascript
const helmet = require('helmet');
app.use(helmet());

// Configurar CORS
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

---

## 📊 Comparación de Opciones

| Característica | Backend Propio | Supabase | Firebase | Auth0 |
|----------------|----------------|----------|----------|-------|
| **Costo** | Bajo (hosting) | Gratis/Hasta $25/mes | Gratis/Pago por uso | Desde $23/mes |
| **Control** | Total | Medio | Bajo | Bajo |
| **Escalabilidad** | Manual | Automática | Automática | Automática |
| **Mantenimiento** | Alto | Bajo | Bajo | Bajo |
| **Seguridad** | Tu responsabilidad | Gestionada | Gestionada | Gestionada |
| **Personalización** | Total | Media | Baja | Media |
| **Tiempo implementación** | 2-3 semanas | 2-3 días | 1-2 días | 1-2 días |

---

## 🚀 Recomendación

### Para Producción Inmediata

**Opción recomendada: Supabase**

**Razones:**
1. ✅ Open source y gratuito hasta cierto límite
2. ✅ PostgreSQL incluido
3. ✅ Autenticación lista para usar
4. ✅ Integración sencilla con React
5. ✅ Escalable
6. ✅ Seguridad gestionada

**Implementación rápida:**

```typescript
// Instalar Supabase
npm install @supabase/supabase-js

// Configurar cliente
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
})
```

### Para Largo Plazo

**Opción recomendada: Backend Propio**

**Razones:**
1. ✅ Control total sobre la lógica de negocio
2. ✅ Integración con sistemas existentes
3. ✅ Personalización completa
4. ✅ Sin dependencia de terceros
5. ✅ Costos predecibles

---

## 📝 Checklist de Migración

### Pre-Migración
- [ ] Definir estrategia de autenticación
- [ ] Elegir tecnología de backend
- [ ] Diseñar esquema de base de datos
- [ ] Planificar migración de usuarios existentes

### Implementación
- [ ] Configurar base de datos
- [ ] Implementar API de autenticación
- [ ] Agregar hash de contraseñas
- [ ] Implementar JWT
- [ ] Crear middleware de autenticación
- [ ] Implementar rate limiting
- [ ] Agregar logs de auditoría

### Frontend
- [ ] Crear servicio de autenticación
- [ ] Actualizar AuthContext
- [ ] Implementar refresh de tokens
- [ ] Agregar manejo de errores
- [ ] Implementar logout global

### Seguridad
- [ ] Configurar HTTPS
- [ ] Implementar CORS
- [ ] Agregar headers de seguridad
- [ ] Configurar variables de entorno
- [ ] Implementar 2FA (opcional)

### Testing
- [ ] Probar login/logout
- [ ] Probar tokens expirados
- [ ] Probar ataques de fuerza bruta
- [ ] Probar inyección SQL
- [ ] Probar XSS
- [ ] Pruebas de penetración

### Despliegue
- [ ] Configurar entorno de producción
- [ ] Migrar usuarios existentes
- [ ] Monitoreo y logs
- [ ] Documentación para usuarios

---

## 🔗 Recursos Útiles

### Documentación
- [JWT.io](https://jwt.io/) - Introducción a JWT
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Hash de contraseñas
- [Supabase Auth](https://supabase.com/docs/guides/auth) - Guía de Supabase
- [Firebase Auth](https://firebase.google.com/docs/auth) - Guía de Firebase
- [Auth0 Docs](https://auth0.com/docs) - Documentación de Auth0

### Herramientas
- [Postman](https://www.postman.com/) - Testing de APIs
- [OWASP ZAP](https://www.zaproxy.org/) - Testing de seguridad
- [JWT Debugger](https://jwt.io/#debugger-io) - Debugging de tokens

### Seguridad
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Riesgos de seguridad
- [Cheat Sheet Series](https://cheatsheetseries.owasp.org/) - Guías de seguridad
- [Security Headers](https://securityheaders.com/) - Verificar headers

---

## 📞 Soporte

Si necesitas ayuda con la migración:

1. **Documentación interna:** Revisar este documento
2. **Consultas técnicas:** Contactar al equipo de desarrollo
3. **Seguridad:** Reportar vulnerabilidades de forma privada

---

## 📅 Timeline Estimado

| Fase | Duración | Entregables |
|------|----------|-------------|
| **Fase 1: Preparación** | 1-2 semanas | DB schema, API design, backend setup |
| **Fase 2: Integración** | 1 semana | Frontend updated, auth flow working |
| **Fase 3: Seguridad** | 1 semana | Rate limiting, 2FA, audit logs |
| **Fase 4: Testing** | 3-5 días | Test cases, security audit |
| **Fase 5: Despliegue** | 2-3 días | Production deploy, monitoring |
| **Total** | **4-5 semanas** | **Sistema completo y seguro** |

---

## ⚠️ Nota Importante

**Este documento es una guía de migración.** La implementación real debe ser realizada por desarrolladores con experiencia en seguridad y autenticación.

**Prioridades:**
1. 🔴 **ALTA:** Migrar a backend de autenticación lo antes posible
2. 🔴 **ALTA:** Implementar hash de contraseñas
3. 🟡 **MEDIA:** Agregar rate limiting
4. 🟡 **MEDIA:** Implementar logs de auditoría
5. 🟢 **BAJA:** Agregar 2FA
6. 🟢 **BAJA:** Implementar recuperación de contraseña

---

**Desarrollado por:** VFL  
**Para:** Area Sistemas PEDSA  
**Versión:** 1.0.0  
**Fecha:** 2024  
**Estado:** 📋 Planificación
