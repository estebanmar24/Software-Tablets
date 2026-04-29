ALTER TABLE "Cronogramas_Actividades" ADD COLUMN IF NOT EXISTS "TipoMantenimiento" VARCHAR(50) DEFAULT 'preventivo';
