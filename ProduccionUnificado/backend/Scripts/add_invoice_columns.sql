-- Add invoice fields to Produccion_Gastos
ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "NumeroFactura" VARCHAR(50);
ALTER TABLE "Produccion_Gastos" ADD COLUMN IF NOT EXISTS "FacturaPdfUrl" VARCHAR(500);
