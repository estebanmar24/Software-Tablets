-- Agregar nuevos campos a la Hoja de Vida de Máquinas
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Proceso" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Ubicacion" TEXT;

-- Campos de Ficha Técnica (Opcionales)
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Voltaje" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Corriente" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Potencia" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Dimensiones" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "Peso" TEXT;
ALTER TABLE "HojasVidaMaquinas" ADD COLUMN IF NOT EXISTS "OtroTecnico" TEXT;
