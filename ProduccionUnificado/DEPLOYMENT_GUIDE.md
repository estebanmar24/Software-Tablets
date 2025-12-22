# 🚀 Guía de Despliegue - Sistema de Producción Aleph

## Requisitos del Servidor

### Software Necesario

| Software | Versión | Descarga |
|----------|---------|----------|
| **SQL Server Express** | 2019 o 2022 | Ya instalado ✅ |
| **.NET Runtime** | 8.0 | https://dotnet.microsoft.com/download/dotnet/8.0 |
| **Node.js** | 18.x o 20.x | https://nodejs.org/ (opcional, solo para desarrollo) |

> **Nota:** Solo necesitas el **.NET Runtime** (no el SDK completo) para ejecutar el backend en producción.

---

## Paso 1: Instalar .NET 8 Runtime

1. Descargar desde: https://dotnet.microsoft.com/download/dotnet/8.0
2. Seleccionar: **"ASP.NET Core Runtime 8.0.x"** (Windows x64)
3. Ejecutar el instalador
4. Verificar instalación:
   ```powershell
   dotnet --info
   ```

---

## Paso 2: Configurar SQL Server Express

### 2.1 Habilitar TCP/IP
1. Abrir **SQL Server Configuration Manager**
2. Ir a: SQL Server Network Configuration → Protocols for SQLEXPRESS
3. Habilitar **TCP/IP**
4. Click derecho en TCP/IP → Properties → IP Addresses
5. En **IPAll**: configurar TCP Port = `1433`
6. Reiniciar SQL Server

### 2.2 Configurar Autenticación Mixta
1. Abrir **SQL Server Management Studio (SSMS)**
2. Click derecho en el servidor → Properties → Security
3. Seleccionar: **SQL Server and Windows Authentication mode**
4. Crear un usuario SQL (si no existe):
   ```sql
   CREATE LOGIN AppUser WITH PASSWORD = 'TuPasswordSeguro123!';
   CREATE DATABASE TiemposProcesos;
   USE TiemposProcesos;
   CREATE USER AppUser FOR LOGIN AppUser;
   ALTER ROLE db_owner ADD MEMBER AppUser;
   ```

### 2.3 Ejecutar Scripts de Base de Datos
Ejecutar en orden en SSMS:
1. `init_db.sql` - Crea tablas base
2. `crear_tabla_calificaciones.sql` - Tabla de calificaciones mensuales
3. `crear_tabla_rendimiento_operarios.sql` - Tabla de rendimiento por operario
4. `actualizar_importancia_decimal.sql` - Actualiza tipo de importancia a decimal

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
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=TiemposProcesos;User Id=AppUser;Password=TuPasswordSeguro123!;TrustServerCertificate=True;"
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

# Puerto de SQL Server (si se accede remotamente)
netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=tcp localport=1433
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
- [ ] SQL Server Express instalado y configurado
- [ ] .NET 8 Runtime instalado
- [ ] Base de datos creada con todos los scripts SQL ejecutados
- [ ] Backend publicado y ejecutándose
- [ ] Firewall configurado
- [ ] Frontend apuntando a la IP correcta del servidor
- [ ] Prueba de conexión desde tablets/móviles

### Comandos de Diagnóstico
```powershell
# Verificar .NET
dotnet --info

# Verificar conexión a SQL Server
sqlcmd -S .\SQLEXPRESS -U AppUser -P TuPassword -Q "SELECT @@VERSION"

# Verificar que el API responde
curl http://localhost:5144/api/produccion/periodos-disponibles
```

---

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| "Connection refused" | Verificar firewall y que TCP/IP esté habilitado |
| "Login failed" | Verificar credenciales en connection string |
| "Cannot open database" | Ejecutar scripts SQL en orden |
| "Port 5144 in use" | Cambiar puerto en `launchSettings.json` |

---

## Contacto de Soporte
En caso de problemas, revisar los logs del servidor o contactar al equipo de desarrollo.
