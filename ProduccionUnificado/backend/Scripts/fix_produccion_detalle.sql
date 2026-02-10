-- Script to create missing ProduccionDiariaDetalles table
-- Run this if you get 500 errors accessing day details

CREATE TABLE IF NOT EXISTS "ProduccionDiariaDetalles" (
    "Id" SERIAL PRIMARY KEY,
    "ProduccionDiariaId" BIGINT NOT NULL,
    "HoraInicio" INTERVAL NOT NULL,
    "HoraFin" INTERVAL NOT NULL,
    "ActividadId" INTEGER NOT NULL,
    "Tiros" INTEGER NOT NULL DEFAULT 0,
    "ReferenciaOP" TEXT,
    "Observaciones" TEXT,
    CONSTRAINT "FK_ProduccionDiariaDetalles_ProduccionDiaria_ProduccionDiariaId"
        FOREIGN KEY ("ProduccionDiariaId")
        REFERENCES "ProduccionDiaria" ("Id")
        ON DELETE CASCADE,
    CONSTRAINT "FK_ProduccionDiariaDetalles_Actividades_ActividadId"
        FOREIGN KEY ("ActividadId")
        REFERENCES "Actividades" ("Id")
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_ProduccionDiariaDetalles_ProduccionDiariaId"
    ON "ProduccionDiariaDetalles" ("ProduccionDiariaId");

CREATE INDEX IF NOT EXISTS "IX_ProduccionDiariaDetalles_ActividadId"
    ON "ProduccionDiariaDetalles" ("ActividadId");
