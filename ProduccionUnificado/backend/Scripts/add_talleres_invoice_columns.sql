-- Add FacturaPdfUrl to Talleres_Gastos
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "FacturaPdfUrl" VARCHAR(500);

-- Add PrecioCotizado to Talleres_Proveedores
ALTER TABLE "Talleres_Proveedores" ADD COLUMN IF NOT EXISTS "PrecioCotizado" DECIMAL(18,2);
