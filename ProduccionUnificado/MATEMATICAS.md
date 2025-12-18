# 📐 Matemáticas del Sistema de Producción

Este documento explica en detalle todas las fórmulas y cálculos utilizados en el sistema de control de producción de Aleph Impresores.

---

## 📋 Tabla de Contenidos

1. [Variables de Entrada](#variables-de-entrada)
2. [Clasificación de Tiempos](#clasificación-de-tiempos)
3. [Tabla ProduccionDiaria](#tabla-producciondiaria)
4. [Fórmulas de Cálculo](#fórmulas-de-cálculo)
5. [Sistema de Semáforo](#sistema-de-semáforo)
6. [Cálculo de Bonificaciones](#cálculo-de-bonificaciones)
7. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## Variables de Entrada

### Datos por Actividad Registrada

Cada vez que un operario detiene el cronómetro, se registran estos datos:

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `HoraInicio` | DateTime | Hora exacta en que inició la actividad |
| `HoraFin` | DateTime | Hora exacta en que finalizó la actividad |
| `Duracion` | TimeSpan | Tiempo transcurrido (HoraFin - HoraInicio) |
| `Tiros` | Entero | Cantidad de impresiones/tiros realizados |
| `Desperdicio` | Entero | Cantidad de material desperdiciado |
| `ActividadId` | Entero | Código de la actividad realizada |

### Parámetros de Máquina

Cada máquina tiene parámetros configurados que afectan los cálculos:

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `MetaRendimiento` | Tiros esperados por día | 15,000 tiros |
| `MetaDesperdicio` | % máximo de desperdicio aceptable | 0.25 (25%) |
| `ValorPorTiro` | Pesos colombianos por cada tiro bueno | $5 COP |
| `TirosReferencia` | Tiros de referencia para cálculos | 1,250 tiros |

---

## Clasificación de Tiempos

El sistema tiene 8 tipos de actividades organizadas en 3 categorías:

### Tabla de Actividades

| Id | Código | Nombre | Hora Productiva | Genera Tiros | Categoría |
|----|--------|--------|-----------------|--------------|-----------|
| 1 | 01 | Puesta a Punto | ✅ Sí | No | Operativo |
| 2 | 02 | Producción | ✅ Sí | **Sí** | Operativo |
| 3 | 03 | Reparación | No | No | Tiempo Muerto |
| 4 | 04 | Descanso | No | No | Auxiliar |
| 5 | 08 | Otro Tiempo Muerto | No | No | Tiempo Muerto |
| 6 | 10 | Mantenimiento y Aseo | No | No | Auxiliar |
| 7 | 13 | Falta de Trabajo | No | No | Tiempo Muerto |
| 8 | 14 | Otros tiempos | No | No | Auxiliar |

> ✅ **Nota:** Tanto "Puesta a Punto" como "Producción" son **horas productivas** del operario.
> La diferencia es que solo "Producción" genera tiros y desperdicio.

---

## Tabla ProduccionDiaria

Esta tabla consolida TODOS los tiempos del día para cada operario+máquina.

### Campos de Tiempos Operativos

Solo dos actividades van a los tiempos operativos:

```
┌───────────────────────────────────────────────────────────────────────┐
│                      TIEMPOS OPERATIVOS                               │
├───────────────────────┬───────────────────────────────────────────────┤
│ TiempoPuestaPunto     │ Horas de "Puesta a Punto" (Código 01)         │
│                       │ Preparación inicial de la máquina             │
├───────────────────────┼───────────────────────────────────────────────┤
│ HorasOperativas       │ Horas de "Producción" (Código 02)             │
│                       │ Tiempo efectivo imprimiendo                   │
│                       │ (ÚNICO que genera tiros y desperdicio)        │
├───────────────────────┼───────────────────────────────────────────────┤
│ TotalHorasProductivas │ = HorasOperativas + TiempoPuestaPunto         │
│                       │ (ES UNA SUMA, no se asigna directamente)      │
└───────────────────────┴───────────────────────────────────────────────┘
```

### Campos de Tiempos Auxiliares

```
┌───────────────────────────────────────────────────────────────────────┐
│                      TIEMPOS AUXILIARES                               │
├───────────────────────┬───────────────────────────────────────────────┤
│ HorasMantenimiento    │ Horas de "Mantenimiento y Aseo" (Código 10)   │
├───────────────────────┼───────────────────────────────────────────────┤
│ HorasDescanso         │ Horas de "Descanso" (Código 04)               │
├───────────────────────┼───────────────────────────────────────────────┤
│ HorasOtrosAux         │ Horas de "Otros tiempos" (Código 14)          │
├───────────────────────┼───────────────────────────────────────────────┤
│ TotalHorasAuxiliares  │ = HorasMantenimiento + HorasDescanso +        │
│                       │   HorasOtrosAux                               │
└───────────────────────┴───────────────────────────────────────────────┘
```

### Campos de Tiempos Muertos

```
┌───────────────────────────────────────────────────────────────────────┐
│                      TIEMPOS MUERTOS                                  │
├───────────────────────┬───────────────────────────────────────────────┤
│ TiempoFaltaTrabajo    │ Horas de "Falta de Trabajo" (Código 13)       │
├───────────────────────┼───────────────────────────────────────────────┤
│ TiempoReparacion      │ Horas de "Reparación" (Código 03)             │
├───────────────────────┼───────────────────────────────────────────────┤
│ TiempoOtroMuerto      │ Horas de "Otro Tiempo Muerto" (Código 08)     │
├───────────────────────┼───────────────────────────────────────────────┤
│ TotalTiemposMuertos   │ = TiempoFaltaTrabajo + TiempoReparacion +     │
│                       │   TiempoOtroMuerto                            │
└───────────────────────┴───────────────────────────────────────────────┘
```

---

## Fórmulas de Cálculo

### 1. Asignación Directa de Tiempos

Cuando se registra una actividad, su duración va al campo correspondiente:

```
Si Código = "01" (Puesta a Punto):
    TiempoPuestaPunto += Duración (en horas)

Si Código = "02" (Producción):
    HorasOperativas += Duración (en horas)
    TirosDiarios += Tiros
    Desperdicio += Desperdicio
```

---

### 2. Total Horas Productivas

Es la **SUMA** de las horas de Producción + Puesta a Punto:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TotalHorasProductivas = HorasOperativas + TiempoPuestaPunto        │
└─────────────────────────────────────────────────────────────────────┘
```

**Ejemplo del día:**
- HorasOperativas (Producción) = 6.0 horas
- TiempoPuestaPunto = 1.5 horas
- **TotalHorasProductivas = 6.0 + 1.5 = 7.5 horas**

---

### 3. Total de Horas del Día

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TotalHoras = TotalHorasProductivas + TotalHorasAuxiliares + TotalMuertos   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Rendimiento Final (Tiros por Hora)

Se calcula **SOLO sobre HorasOperativas** (tiempo efectivo de producción):

```
┌─────────────────────────────────────────────────────────────────┐
│                     TirosDiarios                                │
│  RendimientoFinal = ────────────────                            │
│                     HorasOperativas                             │
└─────────────────────────────────────────────────────────────────┘
```

> ⚠️ **IMPORTANTE:** El denominador es HorasOperativas (solo Producción), 
> NO TotalHorasProductivas. Esto es justo porque el operario no puede 
> generar tiros durante la Puesta a Punto.

**Ejemplo:**
- TirosDiarios = 12,000 tiros
- HorasOperativas = 6.0 horas
- **RendimientoFinal = 12,000 ÷ 6.0 = 2,000 tiros/hora**

---

## Sistema de Semáforo

El semáforo indica si el operario alcanzó la meta del día. Es **binario** (solo ROJO o VERDE):

### Cálculo del Porcentaje

```
┌─────────────────────────────────────────────────────────────────┐
│                    TirosTotales                                 │
│  Porcentaje = ───────────────────── × 100                       │
│                  MetaRendimiento                                │
└─────────────────────────────────────────────────────────────────┘
```

### Colores del Semáforo

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Si Porcentaje < 100%   ──────────►  🔴 ROJO                   │
│                                       (No alcanzó la meta)      │
│                                                                 │
│   Si Porcentaje >= 100%  ──────────►  🟢 VERDE                  │
│                                       (Alcanzó o superó meta)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Ejemplo:**
- TirosTotales = 12,000 tiros
- MetaRendimiento = 15,000 tiros/día
- Porcentaje = (12,000 ÷ 15,000) × 100 = **80%**
- Semáforo = **🔴 ROJO** (porque 80% < 100%)

---

## Cálculo de Bonificaciones

### Valor a Pagar

La bonificación se calcula sobre los tiros **buenos** (descontando desperdicio):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TirosBuenos = TirosDiarios - Desperdicio                               │
│                                                                         │
│  ValorAPagar = TirosBuenos × ValorPorTiro                               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Ejemplo:**
- TirosDiarios = 12,000 tiros
- Desperdicio = 500 tiros
- ValorPorTiro = $5 COP
- TirosBuenos = 12,000 - 500 = **11,500 tiros**
- ValorAPagar = 11,500 × $5 = **$57,500 COP**

---

## Ejemplos Prácticos

### Ejemplo: Registro de ProduccionDiaria

Supongamos que un operario trabaja así en un día:

| Actividad | Código | Duración | Tiros | Desperdicio |
|-----------|--------|----------|-------|-------------|
| Puesta a Punto | 01 | 0.5 horas | - | - |
| Producción | 02 | 3.0 horas | 6,000 | 50 |
| Descanso | 04 | 0.5 horas | - | - |
| Producción | 02 | 2.0 horas | 4,000 | 30 |
| Reparación | 03 | 0.5 horas | - | - |

**Cálculos paso a paso:**

```
1. ASIGNACIÓN DIRECTA:
   TiempoPuestaPunto = 0.5 horas
   HorasOperativas = 3.0 + 2.0 = 5.0 horas
   HorasDescanso = 0.5 horas
   TiempoReparacion = 0.5 horas
   TirosDiarios = 6,000 + 4,000 = 10,000 tiros
   Desperdicio = 50 + 30 = 80 tiros

2. SUMAS CALCULADAS:
   TotalHorasProductivas = 5.0 + 0.5 = 5.5 horas
   TotalHorasAuxiliares = 0.5 horas
   TotalTiemposMuertos = 0.5 horas
   TotalHoras = 5.5 + 0.5 + 0.5 = 6.5 horas

3. RENDIMIENTO:
   RendimientoFinal = 10,000 ÷ 5.0 = 2,000 tiros/hora
   (Nota: se divide entre HorasOperativas, no TotalHorasProductivas)

4. SEMÁFORO (Meta = 15,000):
   Porcentaje = (10,000 ÷ 15,000) × 100 = 66.7%
   Semáforo = 🔴 ROJO (porque 66.7% < 100%)

5. BONIFICACIÓN (ValorPorTiro = $5):
   TirosBuenos = 10,000 - 80 = 9,920
   ValorAPagar = 9,920 × $5 = $49,600 COP
```

---

## Resumen de Fórmulas

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         FÓRMULAS PRINCIPALES                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ASIGNACIÓN DIRECTA:                                                       │
│  • TiempoPuestaPunto     ← Horas de actividad "01"                         │
│  • HorasOperativas       ← Horas de actividad "02" (Producción)            │
│                                                                            │
│  SUMAS CALCULADAS:                                                         │
│  • TotalHorasProductivas = HorasOperativas + TiempoPuestaPunto             │
│  • TotalHorasAuxiliares  = Mantenimiento + Descanso + OtrosAux             │
│  • TotalTiemposMuertos   = FaltaTrabajo + Reparación + OtroMuerto          │
│  • TotalHoras            = TotalProductivas + TotalAux + TotalMuertos      │
│                                                                            │
│  RENDIMIENTO:                                                              │
│                       TirosDiarios                                         │
│  • RendimientoHora = ────────────────  (solo horas de Producción)          │
│                      HorasOperativas                                       │
│                                                                            │
│  SEMÁFORO:                                                                 │
│                       TirosDiarios                                         │
│  • Porcentaje    = ────────────────── × 100                                │
│                     MetaRendimiento                                        │
│  • Color         = VERDE si >= 100%, ROJO si < 100%                        │
│                                                                            │
│  BONIFICACIÓN:                                                             │
│  • ValorAPagar   = (TirosDiarios - Desperdicio) × ValorPorTiro             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Notas Importantes

1. **Solo la actividad "02 - Producción"** genera tiros y desperdicio
2. **HorasOperativas** guarda el tiempo de Producción (no es una suma)
3. **TotalHorasProductivas** es la SUMA de HorasOperativas + TiempoPuestaPunto
4. El **RendimientoFinal** se calcula sobre **HorasOperativas** (solo Producción)
5. El **semáforo** solo tiene 2 colores: ROJO (< 100%) o VERDE (>= 100%)
6. El **desperdicio** reduce el ValorAPagar pero NO el porcentaje del semáforo
