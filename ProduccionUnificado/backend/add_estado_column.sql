ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "GH_GastosMensuales" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "SST_GastosMensuales" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "Planeacion_Gastos" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';
ALTER TABLE "Diseno_Gastos" ADD COLUMN IF NOT EXISTS "Estado" VARCHAR(50) DEFAULT 'Montado';

-- Actualizar registros existentes si es necesario
UPDATE "Produccion_Gastos" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "Talleres_Gastos" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "Mantenimiento_Gastos" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "GH_GastosMensuales" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "SST_GastosMensuales" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "Planeacion_Gastos" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
UPDATE "Diseno_Gastos" SET "Estado" = 'Montado' WHERE "Estado" IS NULL;
