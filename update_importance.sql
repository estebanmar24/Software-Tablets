-- Fine tune to exactly 100%
-- Current total: 99.91%, missing 0.09%
-- Add the difference to the first active machine
\pset pager off

-- Find the difference
SELECT 100.00 - SUM("Importancia") as missing FROM "Maquinas" WHERE "Activa" = true;

-- Add the difference to machine ID 1 (or first active)
UPDATE "Maquinas" 
SET "Importancia" = "Importancia" + (100.00 - (SELECT SUM("Importancia") FROM "Maquinas" WHERE "Activa" = true))
WHERE "Id" = (SELECT MIN("Id") FROM "Maquinas" WHERE "Activa" = true);

-- Final verification
SELECT 'Final importance total:' as info;
SELECT SUM("Importancia") as total FROM "Maquinas" WHERE "Activa" = true;

SELECT 'All active machines:' as info;
SELECT "Id", "Nombre", "Importancia" FROM "Maquinas" WHERE "Activa" = true ORDER BY "Id";
