# 🚀 Guía de Despliegue - Sistema de Producción Aleph

## Requisitos del Servidor

### Software Necesario

| Software | Versión | Descarga |
|----------|---------|----------|
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ |
| **.NET Runtime** | 9.0 | https://dotnet.microsoft.com/download/dotnet/9.0 |
| **Node.js** | 18.x o 20.x | https://nodejs.org/ (opcional, solo para desarrollo) |

> **Nota:** Solo necesitas el **.NET Runtime** (no el SDK completo) para ejecutar el backend en producción.

---

## Paso 1: Instalar .NET 9 Runtime

1. Descargar desde: https://dotnet.microsoft.com/download/dotnet/9.0
2. Seleccionar: **"ASP.NET Core Runtime 9.0.x"** (Windows x64)
3. Ejecutar el instalador
4. Verificar instalación:
   ```powershell
   dotnet --info
   ```

---

## Paso 2: Configurar PostgreSQL

### 2.1 Instalar PostgreSQL
1. Descargar desde: https://www.postgresql.org/download/windows/
2. Durante la instalación, recordar la contraseña del usuario `postgres`
3. Puerto por defecto: `5432`

### 2.2 Crear la Base de Datos
1. Abrir **pgAdmin** o usar la terminal `psql`:
   ```bash
   psql -U postgres
   CREATE DATABASE "TiemposProcesos";
   \q
   ```

### 2.3 Verificar Conexión
```bash
psql -U postgres -d TiemposProcesos -c "SELECT version();"
```

---

## Paso 3: Configurar el Backend

### 3.1 Compilar para Producción (en máquina de desarrollo)
```powershell
cd ProduccionUnificado/backend
dotnet publish -c Release -o ./publish
```

### 3.2 Copiar archivos al servidor
Copiar la carpeta `publish` completa al servidor.

### 3.3 Configurar Connection String
Editar `appsettings.json` en la carpeta publish:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=TiemposProcesos;Username=postgres;Password=TuPasswordSeguro"
  },
  "AllowedHosts": "*"
}
```

### 3.4 Ejecutar el Backend
```powershell
cd C:\ruta\a\publish
dotnet TiempoProcesos.API.dll
```

El backend estará disponible en: `http://localhost:5144`

---

## Paso 4: Configurar como Servicio de Windows (Opcional)

Para que el backend se ejecute automáticamente al iniciar el servidor:

### Opción A: Usando NSSM (Non-Sucking Service Manager)
1. Descargar NSSM: https://nssm.cc/download
2. Ejecutar:
   ```powershell
   nssm install ProduccionAPI
   ```
3. Configurar:
   - Path: `C:\Program Files\dotnet\dotnet.exe`
   - Startup directory: `C:\ruta\a\publish`
   - Arguments: `TiempoProcesos.API.dll`
4. Iniciar el servicio:
   ```powershell
   nssm start ProduccionAPI
   ```

### Opción B: Usando sc.exe
```powershell
sc create ProduccionAPI binPath= "C:\Program Files\dotnet\dotnet.exe exec C:\ruta\a\publish\TiempoProcesos.API.dll" start= auto
sc start ProduccionAPI
```

---

## Paso 5: Configurar el Firewall

Abrir puertos necesarios:
```powershell
# Puerto del API
netsh advfirewall firewall add rule name="Produccion API" dir=in action=allow protocol=tcp localport=5144

# Puerto de PostgreSQL (si se accede remotamente)
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=tcp localport=5432
```

---

## Paso 6: Configurar el Frontend (Tablets/Móviles)

### 6.1 Actualizar URL del API
En el frontend, editar `productionApi.ts` y cambiar:
```typescript
const BASE_URL = 'http://IP-DEL-SERVIDOR:5144/api';
```

### 6.2 Acceso desde navegadores
Los usuarios acceden desde: `http://IP-DEL-SERVIDOR:8081`

Para el panel de administración web: `http://IP-DEL-SERVIDOR:5144`

---

## Verificación Final

### Checklist ✓
- [ ] PostgreSQL instalado y configurado
- [ ] .NET 9 Runtime instalado
- [ ] Base de datos creada
- [ ] Backend publicado y ejecutándose
- [ ] Firewall configurado
- [ ] Frontend apuntando a la IP correcta del servidor
- [ ] Prueba de conexión desde tablets/móviles

### Comandos de Diagnóstico
```powershell
# Verificar .NET
dotnet --info

# Verificar conexión a PostgreSQL
psql -U postgres -d TiemposProcesos -c "SELECT version();"

# Verificar que el API responde
curl http://localhost:5144/api/produccion/periodos-disponibles
```

---

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| "Connection refused" | Verificar firewall y que PostgreSQL esté corriendo |
| "Login failed" | Verificar credenciales en connection string |
| "Cannot open database" | Verificar que la base de datos fue creada |
| "Port 5144 in use" | Cambiar puerto en `launchSettings.json` |

---

## Contacto de Soporte
En caso de problemas, revisar los logs del servidor o contactar al equipo de desarrollo.
