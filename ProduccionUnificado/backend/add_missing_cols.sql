DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='EncuestasCalidadProduccion' AND column_name='Cliente') THEN
        ALTER TABLE "EncuestasCalidadProduccion" ADD COLUMN "Cliente" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='EncuestaCalidadProduccionProcesos' AND column_name='Observaciones') THEN
        ALTER TABLE "EncuestaCalidadProduccionProcesos" ADD COLUMN "Observaciones" TEXT;
    END IF;
END $$;
