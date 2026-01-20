CREATE TABLE IF NOT EXISTS "LicenciasEquipos" (
    "Id" SERIAL PRIMARY KEY,
    "EquipoId" INTEGER NOT NULL REFERENCES "Equipos"("Id") ON DELETE CASCADE,
    "Nombre" VARCHAR(200) NOT NULL,
    "Clave" VARCHAR(200),
    "FechaInicio" TIMESTAMP,
    "FechaExpiracion" TIMESTAMP,
    "Observaciones" VARCHAR(500),
    "FechaRegistro" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
