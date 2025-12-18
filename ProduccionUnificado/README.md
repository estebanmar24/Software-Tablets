# 🏭 Sistema de Producción y Control de Tiempos - Aleph Impresores

Sistema integral para el control de tiempos de producción, seguimiento de rendimiento de operarios y gestión de maquinaria industrial para la empresa Aleph Impresores.

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![.NET](https://img.shields.io/badge/.NET-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL_Server-CC2927?style=for-the-badge&logo=microsoft-sql-server&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)

---

## 📋 Tabla de Contenidos

1. [Descripción General](#-descripción-general)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Características Principales](#-características-principales)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Base de Datos](#-base-de-datos)
6. [API REST](#-api-rest)
7. [Componentes del Frontend](#-componentes-del-frontend)
8. [Instalación y Configuración](#-instalación-y-configuración)
9. [Uso de la Aplicación](#-uso-de-la-aplicación)
10. [Configuración de Producción](#-configuración-de-producción)

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
│  TiempoProcesoController ──► TiempoProcesoService ──► DbContext  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Entity Framework
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQL SERVER DATABASE                           │
│  Usuarios | Maquinas | Actividades | TiempoProcesos |            │
│  OrdenesProduccion | ProduccionDiaria                            │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Frontend** | React Native + Expo | SDK 52 |
| **UI Framework** | React Native Paper | 5.x |
| **Backend** | ASP.NET Core | .NET 9 |
| **ORM** | Entity Framework Core | 9.0 |
| **Base de Datos** | SQL Server | 2019+ |
| **Hosting Cloud** | Site4Now | - |

---

## ✨ Características Principales

### 🕐 Cronómetro de Actividades
- Registro preciso de tiempos con formato HH:MM:SS
- Soporte para múltiples tipos de actividades (productivas y no productivas)
- Persistencia de sesión para recuperación ante cierres inesperados

### 📊 Control de Producción
- Registro de tiros/impresiones por sesión
- Conteo de desperdicio
- Cálculo automático de rendimiento vs meta

### 👥 Gestión de Operarios
- 28 operarios pre-configurados
- Historial de actividades por operario
- Métricas de rendimiento individual

### 🏭 Control de Maquinaria
- 23 máquinas industriales configuradas
- Metas de rendimiento por máquina
- Parámetros de bonificación personalizados

### 📈 Dashboard de Rendimiento
- Porcentaje de rendimiento vs meta diaria
- Totales de producción del día
- Historial de actividades recientes

---

## 📁 Estructura del Proyecto

```
ProduccionUnificado/
├── 📂 frontend/                    # Aplicación React Native
│   ├── 📂 src/
│   │   ├── 📂 components/          # Componentes reutilizables
│   │   │   ├── ActivityHistory.tsx # Historial de actividades
│   │   │   ├── ActivitySelector.tsx# Selector de actividades
│   │   │   ├── AdminDashboard.tsx  # Panel de administración
│   │   │   ├── DailyTotals.tsx     # Totales del día
│   │   │   ├── HistoryModal.tsx    # Modal de historial completo
│   │   │   ├── ProductionCard.tsx  # Tarjeta de producción
│   │   │   ├── Sidebar.tsx         # Barra lateral
│   │   │   └── TimerHeader.tsx     # Encabezado con cronómetro
│   │   ├── 📂 hooks/               # Custom hooks
│   │   │   ├── useTimer.ts         # Lógica del cronómetro
│   │   │   └── usePersistence.ts   # Persistencia local
│   │   ├── 📂 services/            # Servicios de API
│   │   │   ├── api.ts              # API principal
│   │   │   └── productionApi.ts    # API de producción
│   │   └── 📂 types/               # Tipos TypeScript
│   │       └── index.ts
│   ├── App.tsx                     # Componente principal
│   └── app.json                    # Configuración Expo
│
├── 📂 backend/                     # API .NET
│   ├── 📂 Controllers/
│   │   └── TiempoProcesoController.cs
│   ├── 📂 Services/
│   │   └── TiempoProcesoService.cs
│   ├── 📂 Models/                  # Modelos de datos
│   │   ├── TiempoProceso.cs
│   │   ├── Usuario.cs
│   │   ├── Maquina.cs
│   │   ├── Actividad.cs
│   │   └── ProduccionDiaria.cs
│   ├── 📂 DTOs/                    # Objetos de transferencia
│   │   └── TiempoProcesoDto.cs
│   ├── 📂 Data/
│   │   ├── AppDbContext.cs
│   │   └── DbInitializer.cs
│   ├── init_db.sql                 # Script de inicialización
│   ├── appsettings.json            # Configuración
│   └── Program.cs                  # Punto de entrada
│
└── README.md                       # Esta documentación
```

---

## 🗄 Base de Datos

### Diagrama Entidad-Relación

```
┌──────────────┐       ┌──────────────────┐       ┌─────────────┐
│   USUARIOS   │──────►│  TIEMPOPROCESOS  │◄──────│  MAQUINAS   │
│              │       │                  │       │             │
│ Id           │       │ Id               │       │ Id          │
│ Nombre       │       │ Fecha            │       │ Nombre      │
│ Estado       │       │ HoraInicio       │       │ MetaRendim. │
└──────────────┘       │ HoraFin          │       └─────────────┘
                       │ Duracion         │
┌──────────────┐       │ UsuarioId (FK)   │       ┌─────────────┐
│ ACTIVIDADES  │──────►│ MaquinaId (FK)   │◄──────│  ORDENES    │
│              │       │ ActividadId (FK) │       │ PRODUCCION  │
│ Id           │       │ Tiros            │       │             │
│ Codigo       │       │ Desperdicio      │       │ Id          │
│ Nombre       │       └──────────────────┘       │ Numero      │
│ EsProductiva │                                   │ Descripcion │
└──────────────┘       ┌──────────────────┐       └─────────────┘
                       │PRODUCCION DIARIA │
                       │                  │
                       │ Fecha, UsuarioId │
                       │ MaquinaId, Tiros │
                       │ Rendimiento, etc │
                       └──────────────────┘
```

### Tablas Principales

#### 1. `Usuarios` - Operarios
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Id | INT | Identificador único |
| Nombre | NVARCHAR(100) | Nombre completo del operario |
| Estado | BIT | Activo (1) / Inactivo (0) |
| FechaCreacion | DATETIME | Fecha de registro |

#### 2. `Maquinas` - Equipos de Producción
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Id | INT | Identificador único |
| Nombre | NVARCHAR(100) | Nombre de la máquina |
| MetaRendimiento | INT | Meta de tiros por día |
| MetaDesperdicio | DECIMAL(5,4) | % máximo de desperdicio aceptable |
| ValorPorTiro | DECIMAL(10,2) | Valor monetario por tiro para bonificación |
| TirosReferencia | INT | Tiros de referencia para cálculos |

#### 3. `Actividades` - Tipos de Actividad
| Código | Nombre | Es Productiva |
|--------|--------|---------------|
| 01 | Puesta a Punto | No |
| 02 | Producción | **Sí** |
| 03 | Reparación | No |
| 04 | Descanso | No |
| 08 | Otro Tiempo Muerto | No |
| 10 | Mantenimiento y Aseo | No |
| 13 | Falta de Trabajo | No |
| 14 | Otros tiempos | No |

#### 4. `TiempoProcesos` - Registros del Cronómetro
| Campo | Tipo | Descripción |
|-------|------|-------------|
| Id | BIGINT | Identificador único |
| Fecha | DATETIME2 | Fecha del registro |
| HoraInicio | DATETIME2 | Hora de inicio de la actividad |
| HoraFin | DATETIME2 | Hora de finalización |
| Duracion | BIGINT | Duración en ticks (.NET TimeSpan) |
| UsuarioId | INT | FK → Usuarios |
| MaquinaId | INT | FK → Maquinas |
| ActividadId | INT | FK → Actividades |
| Tiros | INT | Cantidad de tiros/impresiones |
| Desperdicio | INT | Cantidad de desperdicio |

#### 5. `ProduccionDiaria` - Resumen Diario
Tabla que consolida la producción diaria por operario y máquina, incluyendo:
- Horas operativas
- Rendimiento final (%)
- Tiros diarios totales
- Valor a pagar (bonificación)
- Desglose de tiempos (productivos, auxiliares, muertos)

---

## 🔌 API REST

Base URL: `http://localhost:5144/api/tiempoproceso`

### Endpoints Disponibles

#### 📋 Catálogos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/actividades` | Lista de actividades disponibles |
| GET | `/usuarios` | Lista de operarios activos |
| GET | `/maquinas` | Lista de máquinas activas |
| GET | `/ordenes` | Lista de órdenes de producción |

#### 📊 Producción

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/produccion-dia` | Obtiene historial y totales del día |
| POST | `/registrar` | Registra un nuevo tiempo de actividad |
| DELETE | `/limpiar` | Elimina datos del día (admin) |

### Detalle de Endpoints

#### GET `/produccion-dia`

Obtiene la producción y el historial de actividades del día.

**Query Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| fecha | DateTime | No | Fecha a consultar (default: hoy) |
| maquinaId | int | No | Filtrar por máquina |
| usuarioId | int | No | Filtrar por operario |

**Response:**
```json
{
  "tirosTotales": 53302,
  "desperdicioTotal": 2,
  "historial": [
    {
      "id": 1,
      "fecha": "2025-12-17",
      "horaInicio": "08:00:00",
      "horaFin": "08:15:00",
      "duracion": "00:15:00",
      "usuarioId": 16,
      "usuarioNombre": "Bedoya Maria Fernanda",
      "maquinaId": 14,
      "maquinaNombre": "10A Colaminadora Carton",
      "actividadId": 2,
      "actividadNombre": "Producción",
      "actividadCodigo": "02",
      "tiros": 5000,
      "desperdicio": 0
    }
  ]
}
```

#### POST `/registrar`

Registra un nuevo tiempo de actividad en el sistema.

**Request Body:**
```json
{
  "fecha": "2025-12-17",
  "horaInicio": "08:00:00",
  "horaFin": "08:15:00",
  "duracion": "00:15:00",
  "usuarioId": 16,
  "maquinaId": 14,
  "actividadId": 2,
  "tiros": 5000,
  "desperdicio": 0,
  "ordenProduccionId": null,
  "referenciaOP": "",
  "observaciones": ""
}
```

**Response:** Retorna el objeto `TiempoProcesoDto` creado.

---

## 🧩 Componentes del Frontend

### Componentes Principales

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| **App** | `App.tsx` | Componente raíz, maneja estado global |
| **Sidebar** | `Sidebar.tsx` | Selección de máquina y operario |
| **TimerHeader** | `TimerHeader.tsx` | Cronómetro y actividad actual |
| **ActivitySelector** | `ActivitySelector.tsx` | Grid de botones de actividades |
| **ProductionCard** | `ProductionCard.tsx` | Registro de tiros y desperdicio |
| **DailyTotals** | `DailyTotals.tsx` | Totales del día y rendimiento |
| **ActivityHistory** | `ActivityHistory.tsx` | Historial reciente de actividades |
| **HistoryModal** | `HistoryModal.tsx` | Modal con historial completo |

### Custom Hooks

| Hook | Archivo | Propósito |
|------|---------|-----------|
| `useTimer` | `useTimer.ts` | Lógica del cronómetro (start, stop, pause, reset) |
| `usePersistence` | `usePersistence.ts` | Persistencia local con AsyncStorage |

### Flujo de Datos

```
FLUJO DE DATOS:

1. Usuario ──► Selecciona Maquina/Operario en App
2. Usuario ──► Selecciona Actividad
3. Usuario ──► Presiona Iniciar Cronometro
4. App     ──► Llama timer.start()
   │
   │ (loop cada segundo)
   └─► Timer actualiza displayTime en pantalla

5. Usuario ──► Agrega Tiros/Desperdicio
6. Usuario ──► Presiona Detener
7. App     ──► Llama timer.stop() → retorna duracion, horaInicio, horaFin
8. App     ──► POST /api/tiempoproceso/registrar → Backend
9. Backend ──► INSERT TiempoProcesos (SQL)
10. Backend ──► UPDATE ProduccionDiaria (SQL)
11. Backend ──► Retorna TiempoProcesoDto → App
12. App     ──► Actualiza historial local
```

---

## ⚙️ Instalación y Configuración

### Requisitos Previos

- **Node.js** 18+ ([descargar](https://nodejs.org/))
- **.NET SDK 9** ([descargar](https://dotnet.microsoft.com/download))
- **SQL Server** 2019+ o acceso a base de datos en la nube
- **Expo CLI** (`npm install -g expo-cli`)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/ProduccionUnificado.git
cd ProduccionUnificado
```

### 2. Configurar Base de Datos

#### Opción A: Base de datos local
```bash
# Crear la base de datos en SQL Server Management Studio
# Ejecutar el script de inicialización
sqlcmd -S localhost -d ProduccionDB -i backend/init_db.sql
```

#### Opción B: Base de datos en la nube (Site4Now)
El proyecto ya está configurado para usar la base de datos remota.

### 3. Configurar Backend

```bash
cd backend

# Verificar/editar la cadena de conexión
# Archivo: appsettings.json o appsettings.Production.json

# Restaurar dependencias
dotnet restore

# Ejecutar el backend
dotnet run
```

El servidor iniciará en `http://localhost:5144`

### 4. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar URL del API (opcional)
# Editar: src/services/api.ts línea 12
# const BASE_URL = 'http://TU-IP:5144/api';

# Iniciar Expo
npx expo start
```

### 5. Ejecutar la Aplicación

- **Web**: Presiona `w` en la terminal de Expo
- **Android**: Escanea el QR con la app Expo Go
- **iOS**: Escanea el QR con la cámara (requiere Expo Go)

---

## 📱 Uso de la Aplicación

### Flujo de Trabajo del Operario

```
FLUJO DE TRABAJO DEL OPERARIO:

    ┌───────────┐
    │ Abrir App │
    └─────┬─────┘
          │
          ▼
    ┌────────────────────┐
    │ Seleccionar Maquina  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ Seleccionar Operario │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐       ┌──────────────────┐
    │  Elegir Actividad  │◄──────┤ Guardado Automatico│
    └─────────┬──────────┘       └─────────┬────────┘
              │                       │
              ▼                       │
    ┌────────────────────┐       │
    │ Iniciar Cronometro │       │
    └─────────┬──────────┘       │
              │                       │
              ▼                       │
    ┌────────────────────┐       │
    │   Registrar Tiros  │       │
    └─────────┬──────────┘       │
              │                       │
              ▼                       │
    ┌────────────────────┐       │
    │     Detener        │───────┘
    └────────────────────┘
```

### Paso a Paso

1. **Seleccionar Máquina**: En el panel izquierdo, elige la máquina donde trabajarás
2. **Seleccionar Operario**: Selecciona tu nombre de la lista
3. **Elegir Actividad**: Toca la actividad que vas a realizar (Producción, Puesta a Punto, etc.)
4. **Iniciar Cronómetro**: Presiona el botón ▶️ verde para comenzar
5. **Registrar Producción**: Durante la actividad, ingresa los tiros y desperdicio
6. **Detener**: Al finalizar, presiona ⏹️ rojo para guardar automáticamente

### Panel de Información

- **Cronómetro**: Muestra el tiempo transcurrido (HH:MM:SS)
- **Actividad Actual**: Indica qué actividad está en curso
- **Producción del Día**: Tiros totales y desperdicio acumulado
- **Rendimiento del Operario**: Porcentaje vs meta de la máquina
- **Historial de Actividades**: Últimas 5 actividades registradas

---

## 🚀 Configuración de Producción

### Variables de Entorno

Crear archivo `.env` en la carpeta `frontend/`:

```env
EXPO_PUBLIC_API_URL=https://tu-api.site4now.net/api
```

### Configuración del Backend para Producción

Editar `appsettings.Production.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=SQL_SERVER;Initial Catalog=DB_NAME;User Id=USER;Password=PASS;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Warning"
    }
  }
}
```

### Desplegar Backend

```bash
dotnet publish -c Release -o ./publish
# Subir carpeta 'publish' al servidor
```

### Generar APK para Android

```bash
cd frontend
npx expo build:android
# O para generar localmente:
npx eas build --platform android --profile preview
```

---

## 🔧 Solución de Problemas

### Error: "Network request failed"
- Verificar que el backend esté corriendo
- Verificar la URL en `src/services/api.ts`
- Asegurar que el dispositivo esté en la misma red

### Error: "400 Bad Request" al seleccionar operario
- Asegurarse de que la base de datos tenga datos iniciales
- Verificar logs del backend para ver el error específico

### Los datos no se guardan después de recargar
- Verificar que el backend esté escribiendo a la base de datos
- Revisar la fecha (problemas de zona horaria pueden causar esto)

### El cronómetro no inicia
- Verificar que la máquina, operario y actividad estén seleccionados

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Autores

- **Aleph Impresores** - Desarrollo y mantenimiento

---

## 📞 Soporte

Para reportar problemas o solicitar nuevas características, contactar al departamento de TI de Aleph Impresores.
