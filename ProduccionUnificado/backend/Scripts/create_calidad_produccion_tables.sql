-- Tablas para Encuestas de Calidad de Producción
-- Ejecutar en PostgreSQL

CREATE TABLE IF NOT EXISTS "EncuestasCalidadProduccion" (
    "Id" SERIAL PRIMARY KEY,
    "Fecha" DATE NOT NULL,
    "OrdenProduccion" VARCHAR(50) NOT NULL,
    "Referencia" VARCHAR(200),
    "Material" VARCHAR(200),
    "Cabida" VARCHAR(100),
    "CantidadAProducir" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CantidadRecuperada" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "CantidadParaDespacho" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Observaciones" TEXT,
    "FechaCreacion" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "EncuestaCalidadProduccionProcesos" (
    "Id" SERIAL PRIMARY KEY,
    "EncuestaId" INTEGER NOT NULL REFERENCES "EncuestasCalidadProduccion"("Id") ON DELETE CASCADE,
    "Proceso" VARCHAR(100) NOT NULL,
    "CantidadProducida" DECIMAL(18,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "IX_EncCalProdProcesos_EncuestaId" ON "EncuestaCalidadProduccionProcesos"("EncuestaId");
