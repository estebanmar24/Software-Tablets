-- PostgreSQL: columnas opcionales para desglose de precio (ejecutar una vez si no usas migración EF).
-- Idempotente con IF NOT EXISTS (PG 9.5+).
-- El API también intenta crear estas columnas al arrancar (StartupSchemaPatches.ApplyCriticalGastosColumns),
-- además de EsEfectivo y Estado, una sentencia por bloque try/catch para no quedar a medias si otro ALTER falla.
-- Nota: el arranque del API (Program.cs) también ejecuta estos ALTER para BD ya desplegadas;
--         puedes usar solo este script si prefieres aplicar cambios a mano en el servidor.

ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "Planeacion_Gastos" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "Planeacion_Gastos" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "Diseno_Gastos" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "Diseno_Gastos" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "GH_GastosMensuales" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "GH_GastosMensuales" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);

ALTER TABLE "SST_GastosMensuales" ADD COLUMN IF NOT EXISTS "PrecioBase" numeric(18,2);
ALTER TABLE "SST_GastosMensuales" ADD COLUMN IF NOT EXISTS "PrecioIva" numeric(18,2);
