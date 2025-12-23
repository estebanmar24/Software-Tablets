# 🏭 Sistema de Producción y Control de Tiempos - Aleph Impresores

Sistema integral para el control de tiempos de producción, seguimiento de rendimiento de operarios y gestión de maquinaria industrial para la empresa Aleph Impresores.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![.NET](https://img.shields.io/badge/.NET_9-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL_Server-CC2927?style=for-the-badge&logo=microsoft-sql-server&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_54-000020?style=for-the-badge&logo=expo&logoColor=white)

---

## 📋 Tabla de Contenidos

1. [Descripción General](#-descripción-general)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Características Principales](#-características-principales)
4. [Instalación y Configuración](#-instalación-y-configuración)
5. [Generación de APK Android](#-generación-de-apk-android)
6. [Base de Datos](#-base-de-datos)
7. [API REST](#-api-rest)
8. [Matemáticas del Sistema](#-matemáticas-del-sistema)
9. [Solución de Problemas](#-solución-de-problemas)

---

## 📖 Descripción General

Este sistema permite a los operarios de una planta de producción registrar sus tiempos de trabajo en diferentes actividades (producción, mantenimiento, descanso, etc.), capturar la cantidad de tiros/impresiones realizadas y el desperdicio generado. El sistema calcula automáticamente métricas de rendimiento y bonificaciones.

### Casos de Uso Principales

- **Operarios**: Registran sus tiempos de trabajo usando un cronómetro digital
- **Supervisores**: Visualizan el rendimiento diario de cada operario y máquina
- **Administración**: Acceso a reportes consolidados y cálculo de bonificaciones

---

## 🏗 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React Native + Expo)                │
│  ┌─────────┐                                                     │
│  │ App.tsx │──► Sidebar, TimerHeader, ActivitySelector,         │
│  └─────────┘    ProductionCard, ActivityHistory, DailyTotals     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (.NET 9 API)                          │
│  Controllers ──► Services ──► Entity Framework ──► DbContext     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Server
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQL SERVER DATABASE                           │
│  Usuarios | Maquinas | Actividades | TiempoProcesos |            │
│  OrdenesProduccion | ProduccionDiaria | Calificaciones           │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | React Native + Expo | SDK 54, RN 0.81.5 |
| **Backend** | ASP.NET Core | .NET 9 |
| **ORM** | Entity Framework Core | 9.0 |
| **Base de Datos** | SQL Server Express | 2019+ |

---

## ✨ Características Principales

### 🕐 Cronómetro de Actividades
- Registro preciso de tiempos con formato HH:MM:SS
- Soporte para 8 tipos de actividades (productivas y no productivas)
- Persistencia de sesión para recuperación ante cierres inesperados

### 📊 Control de Producción
- Registro de tiros/impresiones por sesión
- Conteo de desperdicio
- Cálculo automático de rendimiento vs meta

### 👥 Gestión de Operarios
- 28 operarios pre-configurados
- Historial de actividades por operario
- Métricas de rendimiento individual y mensual

### 🏭 Control de Maquinaria
- 23 máquinas industriales configuradas
- Metas de rendimiento por máquina
- Parámetros de bonificación personalizados
- Sistema de importancia ponderada (suma 100%)

### 📈 Dashboard y Reportes
- Porcentaje de rendimiento vs meta diaria
- Calificaciones mensuales de planta
- Generación de PDFs
- Historial de actividades

---

## ⚙️ Instalación y Configuración

### Requisitos Previos

- **Node.js** 18+ 
- **.NET SDK 9**
- **SQL Server Express** 2019+
- **Expo CLI** (`npm install -g expo-cli`)

### 1. Configurar Base de Datos

```sql
-- Ejecutar el script de instalación en SQL Server Management Studio
-- Archivo: install_database_complete.sql
```

### 2. Configurar Backend

```bash
cd backend

# Editar la cadena de conexión en appsettings.json
# "DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=TiemposProcesos;..."

# Restaurar dependencias y ejecutar
dotnet restore
dotnet run --urls "http://0.0.0.0:5144"
```

El servidor iniciará en `http://TU-IP:5144`

### 3. Configurar Frontend

```bash
cd frontend

# Editar la IP del servidor en src/services/api.ts
# const BASE_URL = 'http://TU-IP:5144/api';

# Instalar dependencias
npm install

# Iniciar Expo
npx expo start --lan
```

### 4. Acceder a la Aplicación

| Plataforma | URL de Acceso |
|------------|---------------|
| **Web** | `http://TU-IP:8081` |
| **API Swagger** | `http://TU-IP:5144/swagger` |
| **Android/Tablets** | Escanear QR con Expo Go o usar APK |

---

## 📱 Generación de APK Android

### Requisitos

1. **Android Studio** instalado con:
   - Android SDK (API 29, 33, 34)
   - Android SDK Build-Tools
   - NDK (Side by side)
   - CMake

2. **Variables de Entorno** configuradas:
   ```
   ANDROID_HOME = C:\Users\TU_USUARIO\AppData\Local\Android\Sdk
   JAVA_HOME = C:\Program Files\Android\Android Studio\jbr
   ```

### Generar APK

> ⚠️ **IMPORTANTE**: Por limitaciones de rutas largas en Windows, el proyecto debe estar en una ruta corta (ej: `C:\FE\`)

```powershell
# 1. Copiar frontend a ruta corta
Copy-Item -Path "frontend" -Destination "C:\FE" -Recurse

# 2. Instalar dependencias
cd C:\FE
npm install

# 3. Generar proyecto Android
$env:ANDROID_HOME = "C:\Users\TU_USUARIO\AppData\Local\Android\Sdk"
npx expo prebuild --platform android --clean

# 4. Compilar APK
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew assembleRelease
```

### Ubicación del APK

```
C:\FE\android\app\build\outputs\apk\release\app-release.apk
```

### Instalar en Tablets

1. Copiar APK a la tablet (USB, Drive, email)
2. En la tablet: **Configuración → Seguridad → Orígenes desconocidos** (habilitar)
3. Abrir el archivo APK e instalar

---

## 🗄 Base de Datos

### Diagrama de Tablas

| Tabla | Descripción |
|-------|-------------|
| `Usuarios` | 28 operarios con nombre y estado |
| `Maquinas` | 23 máquinas con metas, valores, importancia |
| `Actividades` | 8 tipos de actividad |
| `TiempoProcesos` | Registros del cronómetro |
| `ProduccionDiaria` | Resumen diario consolidado |
| `OrdenesProduccion` | Órdenes de producción |
| `CalificacionesMensuales` | Calificación de planta por mes |
| `RendimientoOperariosMensual` | Historial de rendimiento mensual |

### Actividades Disponibles

| Código | Nombre | Productiva | Categoría |
|--------|--------|------------|-----------|
| 01 | Puesta a Punto | ✅ Sí | Operativo |
| 02 | Producción | ✅ Sí | Operativo |
| 03 | Reparación | No | Tiempo Muerto |
| 04 | Descanso | No | Auxiliar |
| 08 | Otro Tiempo Muerto | No | Tiempo Muerto |
| 10 | Mantenimiento y Aseo | No | Auxiliar |
| 13 | Falta de Trabajo | No | Tiempo Muerto |
| 14 | Otros tiempos | No | Auxiliar |

---

## 🔌 API REST

Base URL: `http://TU-IP:5144/api`

### Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tiempoproceso/actividades` | Lista de actividades |
| GET | `/tiempoproceso/usuarios` | Lista de operarios |
| GET | `/tiempoproceso/maquinas` | Lista de máquinas |
| GET | `/tiempoproceso/produccion-dia` | Producción del día |
| POST | `/tiempoproceso/registrar` | Registrar tiempo |
| GET | `/produccion/resumen` | Resumen mensual |
| GET | `/maquinas` | CRUD de máquinas |
| GET | `/usuarios` | CRUD de usuarios |

---

## 📐 Matemáticas del Sistema

### Clasificación de Tiempos

```
TIEMPOS OPERATIVOS (Productivos):
├── TiempoPuestaPunto    ← Código 01
└── HorasOperativas      ← Código 02 (genera tiros)

TIEMPOS AUXILIARES:
├── HorasDescanso        ← Código 04
├── HorasMantenimiento   ← Código 10
└── HorasOtrosAux        ← Código 14

TIEMPOS MUERTOS:
├── TiempoReparacion     ← Código 03
├── TiempoOtroMuerto     ← Código 08
└── TiempoFaltaTrabajo   ← Código 13
```

### Fórmulas Principales

```
TOTALES:
TotalHorasProductivas = HorasOperativas + TiempoPuestaPunto
TotalHorasAuxiliares  = Mantenimiento + Descanso + OtrosAux
TotalTiemposMuertos   = FaltaTrabajo + Reparación + OtroMuerto
TotalHoras            = TotalProductivas + TotalAux + TotalMuertos

RENDIMIENTO:
                      TirosDiarios
RendimientoHora = ────────────────  (solo horas de Producción)
                   HorasOperativas

SEMÁFORO:
                  TirosDiarios
Porcentaje    = ────────────────── × 100
                 MetaRendimiento

Color = 🟢 VERDE si >= 100%, 🔴 ROJO si < 100%

BONIFICACIÓN:
ValorAPagar = (TirosDiarios - Desperdicio) × ValorPorTiro
```

### Ejemplo Práctico

| Actividad | Duración | Tiros | Desperdicio |
|-----------|----------|-------|-------------|
| Puesta a Punto | 0.5h | - | - |
| Producción | 5.0h | 10,000 | 80 |
| Descanso | 0.5h | - | - |
| Reparación | 0.5h | - | - |

**Resultados:**
- TotalHorasProductivas = 5.5h
- RendimientoHora = 10,000 ÷ 5.0 = 2,000 tiros/hora
- Porcentaje = (10,000 ÷ 15,000) × 100 = 66.7% 🔴
- ValorAPagar = (10,000 - 80) × $5 = $49,600 COP

---

## 🔧 Solución de Problemas

### Error: "Network request failed"
- Verificar que el backend esté corriendo
- Verificar la IP en `src/services/api.ts`
- Asegurar que dispositivos estén en la misma red

### Error al generar APK: "ninja: error: manifest 'build.ninja' still dirty"
- Mover el proyecto a una ruta más corta (ej: `C:\FE\`)
- Eliminar carpeta `android` y regenerar con `npx expo prebuild --clean`

### Los datos no se guardan
- Verificar conexión a SQL Server
- Revisar cadena de conexión en `appsettings.json`

### El cronómetro no inicia
- Verificar que máquina, operario y actividad estén seleccionados

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

---

## 👥 Desarrollo

**Aleph Impresores** - Sistema de Control de Producción

📧 Soporte: Departamento de TI
