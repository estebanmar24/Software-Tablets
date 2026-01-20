ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "PersonalId" INTEGER REFERENCES "Talleres_Personal"("Id");
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "TipoHoraId" INTEGER REFERENCES "Produccion_TiposHora"("Id");
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "TipoRecargoId" INTEGER REFERENCES "Produccion_TiposRecargo"("Id");
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "CantidadHoras" DECIMAL(18,2);
ALTER TABLE "Talleres_Gastos" ADD COLUMN IF NOT EXISTS "NumeroOP" VARCHAR(100);
