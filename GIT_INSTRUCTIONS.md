# Instrucciones para Git - Rama: feature/mesh-integration

## 📌 Crear Nueva Rama y Subir Cambios

### Opción 1: Desde tu computadora local

```bash
# 1. Ir a tu carpeta del proyecto
cd D:\Sistema-Control-Toner\workspace

# 2. Asegurarte de estar en la rama main
git checkout main

# 3. Crear y cambiar a la nueva rama
git checkout -b feature/mesh-integration

# 4. Agregar todos los cambios
git add .

# 5. Hacer commit con mensaje descriptivo
git commit -m "feat: integrar monitoreo remoto MeshCentral y limpiar datos mockeados

- Agregado componente MeshMonitor para visualizar computadoras remotas
- Integración con mesh.donnet.com.ar
- Eliminados datos mockeados (arrays vacíos)
- Agregados créditos de Sistemas PEDSA en dashboard
- Actualización automática cada 30 segundos
- Estados en tiempo real de dispositivos"

# 6. Subir la rama al repositorio remoto
git push -u origin feature/mesh-integration
```

### Opción 2: Si ya tienes cambios sin commitear

```bash
# 1. Guardar cambios temporales
git stash

# 2. Crear nueva rama
git checkout -b feature/mesh-integration

# 3. Aplicar cambios guardados
git stash pop

# 4. Agregar y commitear
git add .
git commit -m "feat: integrar monitoreo remoto MeshCentral"
git push -u origin feature/mesh-integration
```

---

## 🔄 Fusionar con Main (cuando esté listo)

```bash
# 1. Cambiar a rama main
git checkout main

# 2. Fusionar la rama de features
git merge feature/mesh-integration

# 3. Subir cambios
git push origin main

# 4. (Opcional) Eliminar rama de features
git branch -d feature/mesh-integration
git push origin --delete feature/mesh-integration
```

---

## 📋 Comandos Útiles

```bash
# Ver estado del repositorio
git status

# Ver historial de commits
git log --oneline

# Ver ramas disponibles
git branch

# Cambiar entre ramas
git checkout <nombre-rama>

# Descargar cambios remotos
git pull origin main

# Ver diferencias
git diff

# Deshacer cambios (antes de commit)
git restore <archivo>

# Deshacer último commit (manteniendo cambios)
git reset --soft HEAD~1
```

---

## 🎯 Flujo de Trabajo Recomendado

1. **Crear rama de features** para cada nueva funcionalidad
2. **Desarrollar y probar** localmente
3. **Commitear** con mensajes descriptivos
4. **Push** a la rama remota
5. **Crear Pull Request** en GitHub/GitLab
6. **Review** del código
7. **Merge** a main
8. **Deploy** a producción

---

## 📝 Ejemplo de Mensajes de Commit

```
feat: agregar nueva funcionalidad
fix: corregir error en login
docs: actualizar documentación
style: formatear código
refactor: reorganizar componentes
test: agregar tests unitarios
chore: actualizar dependencias
```

---

## 🔗 Crear Pull Request en GitHub

1. Ve a tu repositorio en GitHub
2. Verás un banner amarillo "Compare & pull request"
3. Click en el banner
4. Revisa los cambios
5. Agrega descripción del PR
6. Click en "Create pull request"
7. Asigna revisores (si es necesario)
8. Click en "Merge pull request" cuando esté aprobado

---

## ⚠️ Notas Importantes

- **Nunca hagas push directo a main** en producción
- **Usa ramas de features** para desarrollo
- **Commits pequeños y frecuentes** son mejores
- **Mensajes descriptivos** ayudan al equipo
- **Revisa antes de commitear** con `git status` y `git diff`

---

## 🆘 Solución de Problemas

### Conflicto de merge
```bash
# 1. Resolver conflictos manualmente en los archivos
# 2. Agregar archivos resueltos
git add .
# 3. Continuar merge
git commit
```

### Rama desactualizada
```bash
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Volver a tu rama
git checkout feature/mesh-integration

# 3. Rebase con main
git rebase main

# 4. Resolver conflictos si los hay
# 5. Forzar push (si hiciste rebase)
git push -f origin feature/mesh-integration
```

### Desechar cambios locales
```bash
# Descartar todos los cambios no commiteados
git reset --hard HEAD

# O descartar un archivo específico
git restore <archivo>
```
