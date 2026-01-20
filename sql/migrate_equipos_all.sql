-- ==============================================================
-- Script de Migración Completo para Módulo de Equipos
-- Ejecutar en PostgreSQL después de create_equipos_tables.sql
-- ==============================================================

-- 1. Reemplazar columna Folio por FechaInspeccion
DO $$
BEGIN
    -- Eliminar columna Folio si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='Folio') THEN
        ALTER TABLE "Equipos" DROP COLUMN "Folio";
    END IF;

    -- Agregar columna FechaInspeccion si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='FechaInspeccion') THEN
        ALTER TABLE "Equipos" ADD COLUMN "FechaInspeccion" TIMESTAMP;
    END IF;
END $$;

-- 2. Agregar columnas de mantenimiento requerido
ALTER TABLE "Equipos" ADD COLUMN IF NOT EXISTS "MantenimientoRequerido" VARCHAR(1000);
ALTER TABLE "Equipos" ADD COLUMN IF NOT EXISTS "Observaciones" VARCHAR(1000);

-- 3. Agregar columna de prioridad
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='Prioridad') THEN
        ALTER TABLE "Equipos" ADD COLUMN "Prioridad" VARCHAR(20);
    END IF;
END $$;

-- Verificar que todas las columnas necesarias existan
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Equipos'
ORDER BY ordinal_position;
