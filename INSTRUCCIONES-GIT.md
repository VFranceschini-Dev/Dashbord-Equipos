# Instrucciones para crear la rama en Git

## 📋 Pasos para crear la rama y subir los cambios

### 1. Crear nueva rama

```bash
# Asegúrate de estar en la rama main
git checkout main

# Crear y cambiar a nueva rama
git checkout -b feature/meshcentral-dashboard
```

### 2. Agregar los cambios

```bash
# Agregar todos los archivos modificados
git add .

# O agregar archivos específicos
git add src/components/Dashboard.tsx
git add src/components/MeshMonitor.tsx
git add src/services/meshCentral.ts
git add src/data.ts
git add README-MESH.md
```

### 3. Hacer commit

```bash
git commit -m "feat: Integración Dashboard con MeshCentral

- Limpieza de datos mockeados del sistema
- Nuevo componente MeshMonitor para visualizar equipos remotos
- Servicio meshCentral.ts para conexión con mesh.donnet.com.ar
- Dashboard muestra computadoras monitoreadas en tiempo real
- Créditos: Desarrollado por Sistemas PEDSA
- Actualización automática cada 30 segundos
- Enlace directo a MeshCentral"
```

### 4. Subir la rama al repositorio

```bash
# Subir la rama al repositorio remoto
git push -u origin feature/meshcentral-dashboard
```

### 5. Crear Pull Request (opcional)

Si usas GitHub/GitLab:
1. Ve al repositorio en la web
2. Verás un botón para crear Pull Request
3. Completa la descripción con los cambios realizados
4. Asigna revisores si es necesario

---

## 🔄 Comandos útiles

```bash
# Ver estado de los cambios
git status

# Ver diferencias
git diff

# Ver historial de commits
git log --oneline

# Volver a la rama main
git checkout main

# Listar todas las ramas
git branch -a

# Eliminar rama local (después de merge)
git branch -d feature/meshcentral-dashboard
```

---

## 📝 Mensajes de commit sugeridos

Si necesitas hacer commits adicionales:

```bash
# Para correcciones
git commit -m "fix: Corregir conexión con MeshCentral API"

# Para nuevas funcionalidades
git commit -m "feat: Agregar autenticación con MeshCentral"

# Para documentación
git commit -m "docs: Actualizar README con instrucciones de API"

# Para refactorización
git commit -m "refactor: Optimizar componente MeshMonitor"
```

---

## ✅ Checklist antes de hacer push

- [ ] Todos los archivos están guardados
- [ ] El proyecto compila sin errores (`npm run build`)
- [ ] Las credenciales sensibles NO están en el código
- [ ] El README está actualizado
- [ ] Los cambios han sido probados localmente
- [ ] No hay archivos temporales o de prueba

---

## 🔐 IMPORTANTE: Archivos a NO subir

Asegúrate de que tu `.gitignore` incluya:

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

**NUNCA subas:**
- Credenciales de producción
- API keys reales
- Contraseñas
- Datos sensibles de clientes
