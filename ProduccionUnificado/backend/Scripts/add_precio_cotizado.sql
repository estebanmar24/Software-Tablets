-- Add quoted price to Proveedores
ALTER TABLE "Produccion_Proveedores" ADD COLUMN IF NOT EXISTS "PrecioCotizado" DECIMAL(18,2);
