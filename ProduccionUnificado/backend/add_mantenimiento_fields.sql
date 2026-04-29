-- Add missing columns to Mantenimiento_Gastos
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "UsuarioId" INTEGER;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "TipoHoraId" INTEGER;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "TipoRecargoId" INTEGER;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "CantidadHoras" NUMERIC;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "HoraInicio" TEXT;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "HoraFin" TEXT;
ALTER TABLE "Mantenimiento_Gastos" ADD COLUMN IF NOT EXISTS "OtraMaquinaNombre" TEXT;

-- Add constraints if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_Mantenimiento_Gastos_Usuarios_UsuarioId') THEN
        ALTER TABLE "Mantenimiento_Gastos" ADD CONSTRAINT "FK_Mantenimiento_Gastos_Usuarios_UsuarioId" FOREIGN KEY ("UsuarioId") REFERENCES "Usuarios"("Id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_Mantenimiento_Gastos_Mantenimiento_TiposHora_TipoHoraId') THEN
        ALTER TABLE "Mantenimiento_Gastos" ADD CONSTRAINT "FK_Mantenimiento_Gastos_Mantenimiento_TiposHora_TipoHoraId" FOREIGN KEY ("TipoHoraId") REFERENCES "Mantenimiento_TiposHora"("Id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_Mantenimiento_Gastos_Mantenimiento_TiposRecargo_TipoRecargoId') THEN
        ALTER TABLE "Mantenimiento_Gastos" ADD CONSTRAINT "FK_Mantenimiento_Gastos_Mantenimiento_TiposRecargo_TipoRecargoId" FOREIGN KEY ("TipoRecargoId") REFERENCES "Mantenimiento_TiposRecargo"("Id");
    END IF;
END $$;
