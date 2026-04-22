-- Crear tablas para el módulo de Hoja de Vida de Máquinas
CREATE TABLE IF NOT EXISTS "HojasVidaMaquinas" (
    "Id" SERIAL PRIMARY KEY,
    "Nombre" TEXT NOT NULL,
    "NumeroInventario" TEXT,
    "Marca" TEXT,
    "Serie" TEXT,
    "Modelo" TEXT,
    "Color" TEXT,
    "FechaCompra" TIMESTAMP,
    "VidaUtil" TEXT,
    "FotoUrl" TEXT,
    "EppsYRiesgos" TEXT,
    "Senalizacion" TEXT,
    "RiesgosAsociados" TEXT,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "FechaRegistro" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CodigoFormato" TEXT NOT NULL DEFAULT 'FO-GM-001',
    "VersionFormato" TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS "MantenimientosHojaVida" (
    "Id" SERIAL PRIMARY KEY,
    "HojaVidaId" INTEGER NOT NULL REFERENCES "HojasVidaMaquinas"("Id") ON DELETE CASCADE,
    "TipoMantenimiento" TEXT NOT NULL,
    "Fecha" TIMESTAMP NOT NULL,
    "EjecutadoPor" TEXT,
    "Observacion" TEXT,
    "FechaRegistro" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "HojaVidaFotos" (
    "Id" SERIAL PRIMARY KEY,
    "HojaVidaId" INTEGER NOT NULL REFERENCES "HojasVidaMaquinas"("Id") ON DELETE CASCADE,
    "Url" TEXT NOT NULL,
    "FechaRegistro" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
