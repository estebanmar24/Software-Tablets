-- Migration: Add history tracking fields to expense tables (PostgreSQL)
-- Date: 2026-01-22
-- Description: Adds FechaCreacion and FechaModificacion columns to track when expenses are created and modified

-- Add columns to Produccion_Gastos table
ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "FechaCreacion" TIMESTAMP DEFAULT NOW();
ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "FechaModificacion" TIMESTAMP NULL;

-- Add columns to Talleres_Gastos table
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "FechaCreacion" TIMESTAMP DEFAULT NOW();
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "FechaModificacion" TIMESTAMP NULL;

-- Add columns to GH_GastosMensuales table
ALTER TABLE "GH_GastosMensuales" ADD COLUMN IF NOT EXISTS "FechaCreacion" TIMESTAMP DEFAULT NOW();
ALTER TABLE "GH_GastosMensuales" ADD COLUMN IF NOT EXISTS "FechaModificacion" TIMESTAMP NULL;

-- Add columns to SST_GastosMensuales table
ALTER TABLE "SST_GastosMensuales" ADD COLUMN IF NOT EXISTS "FechaCreacion" TIMESTAMP DEFAULT NOW();
ALTER TABLE "SST_GastosMensuales" ADD COLUMN IF NOT EXISTS "FechaModificacion" TIMESTAMP NULL;
