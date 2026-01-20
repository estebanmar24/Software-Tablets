DO $$
BEGIN
    -- Eliminar columna Folio si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='Folio') THEN
        ALTER TABLE "Equipos" DROP COLUMN "Folio";
    END IF;

    -- Agregar columna FechaInspeccion si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Equipos' AND column_name='FechaInspeccion') THEN
        ALTER TABLE "Equipos" ADD COLUMN "FechaInspeccion" TIMESTAMP;
    END IF;
END $$;
