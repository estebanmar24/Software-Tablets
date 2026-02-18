-- Delete detailed records
DELETE FROM "RegistrosDesperdicio" 
WHERE "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31';

-- Reset daily totals to 0
UPDATE "ProduccionDiaria" 
SET "Desperdicio" = 0 
WHERE "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31';
