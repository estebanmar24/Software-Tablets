# 🏭 Software-Tablets - Sistema de Producción y Control de Tiempos

[![React Native](https://img.shields.io/badge/React_Native-0.81.5-blue?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_54-black?logo=expo)](https://expo.dev/)
[![.NET](https://img.shields.io/badge/.NET-9.0-purple?logo=.net)](https://dotnet.microsoft.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Sistema integral de gestión de producción y control de tiempos para **Aleph Impresores**. Diseñado para tablets y dispositivos móviles con soporte web.

---

## 📁 Estructura del Proyecto

```
Software-Tablets/
├── ProduccionUnificado/        # Aplicación principal
│   ├── frontend/               # React Native + Expo
│   └── backend/                # ASP.NET Core API
├── TB/                         # Módulos adicionales
├── sql/                        # Scripts SQL de utilidad
└── ANALISIS_PROYECTO.md        # Documentación de análisis
```

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- .NET SDK 9.0
- PostgreSQL 14+

### Instalación

```bash
# Backend
cd ProduccionUnificado/backend
dotnet restore
dotnet run --urls "http://0.0.0.0:5144"

# Frontend
cd ProduccionUnificado/frontend
npm install
npx expo start --web
```

## 📖 Documentación

- **[Documentación Completa](ProduccionUnificado/README.md)** - Guía detallada del sistema
- **[Guía de Despliegue](ProduccionUnificado/DEPLOYMENT_GUIDE.md)** - Instrucciones de producción
- **[Análisis del Proyecto](ANALISIS_PROYECTO.md)** - Arquitectura y diseño

## ✨ Características Principales

- 📱 **Cronómetro de Actividades** - Registro de tiempos en tiempo real
- 📊 **Dashboard** - Visualización de KPIs y métricas
- 🏭 **Control de Producción** - Captura mensual y reportes
- 👥 **Gestión de Operarios** - Calificaciones y rendimiento
- 🔧 **Control de Maquinaria** - Mantenimiento y estado
- 💰 **Módulos de Gastos** - GH, SST, Talleres, Producción

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

**Desarrollado para Aleph Impresores** © 2024-2026
