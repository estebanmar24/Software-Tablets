-- 1. Asegurar que las columnas existen
ALTER TABLE "MantenimientosHojaVida" ADD COLUMN IF NOT EXISTS "Consecutivo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BitacorasMaquinas" ADD COLUMN IF NOT EXISTS "Consecutivo" INTEGER NOT NULL DEFAULT 0;

-- 2. Reparar consecutivos de Mantenimientos (por cada máquina)
WITH Corregidos AS (
    SELECT "Id", ROW_NUMBER() OVER (PARTITION BY "HojaVidaId" ORDER BY "Fecha" ASC) as nuevo_cons
    FROM "MantenimientosHojaVida"
)
UPDATE "MantenimientosHojaVida" m
SET "Consecutivo" = c.nuevo_cons
FROM Corregidos c
WHERE m."Id" = c."Id";

-- 3. Reparar consecutivos de Bitácoras/Tickets (por cada máquina)
WITH CorregidosTickets AS (
    SELECT "Id", ROW_NUMBER() OVER (PARTITION BY "HojaVidaId" ORDER BY "Fecha" ASC) as nuevo_cons
    FROM "BitacorasMaquinas"
)
UPDATE "BitacorasMaquinas" t
SET "Consecutivo" = ct.nuevo_cons
FROM CorregidosTickets ct
WHERE t."Id" = ct."Id";

-- 4. A�adir nuevos campos para vinculaci�n de tickets y personal
ALTER TABLE "MantenimientosHojaVida" ADD COLUMN IF NOT EXISTS "TicketId" INTEGER;
ALTER TABLE "MantenimientosHojaVida" ADD COLUMN IF NOT EXISTS "TipoPersonal" VARCHAR(50) DEFAULT 'Interno';
