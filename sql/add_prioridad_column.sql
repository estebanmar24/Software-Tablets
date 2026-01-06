DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='Prioridad') THEN
        ALTER TABLE "Equipos" ADD COLUMN "Prioridad" VARCHAR(20);
    END IF;
END $$;
