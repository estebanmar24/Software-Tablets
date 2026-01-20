ALTER TABLE "Produccion_Gastos" ADD COLUMN "TipoRecargoId" INTEGER;
ALTER TABLE "Produccion_Gastos" ADD CONSTRAINT "Produccion_Gastos_TipoRecargoId_fkey" FOREIGN KEY ("TipoRecargoId") REFERENCES "Produccion_TiposRecargo"("Id");
