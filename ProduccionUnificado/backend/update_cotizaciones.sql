ALTER TABLE "Mantenimiento_Cotizaciones" ADD COLUMN IF NOT EXISTS "ProductoId" INTEGER;
ALTER TABLE "Mantenimiento_Cotizaciones" ADD COLUMN IF NOT EXISTS "Cantidad" DECIMAL;
ALTER TABLE "Mantenimiento_Cotizaciones" ADD COLUMN IF NOT EXISTS "ValorUnitario" DECIMAL;

-- Add foreign key if not exists (checking by constraint name)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Mantenimiento_Cotizaciones_Mantenimiento_Productos_ProdId') THEN
        ALTER TABLE "Mantenimiento_Cotizaciones" 
        ADD CONSTRAINT "FK_Mantenimiento_Cotizaciones_Mantenimiento_Productos_ProdId" 
        FOREIGN KEY ("ProductoId") REFERENCES "Mantenimiento_Productos" ("Id") ON DELETE RESTRICT;
    END IF;
END $$;
