-- Agregar columnas de mantenimiento requerido a la tabla Equipos
ALTER TABLE "Equipos" ADD COLUMN IF NOT EXISTS "MantenimientoRequerido" VARCHAR(1000);
ALTER TABLE "Equipos" ADD COLUMN IF NOT EXISTS "Observaciones" VARCHAR(1000);
