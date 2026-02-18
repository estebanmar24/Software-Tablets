-- Manual Recovery from PDF
UPDATE "ProduccionDiaria" SET "Desperdicio" = 16 WHERE "Fecha" = '2026-01-05' AND "MaquinaId" = 11 AND "UsuarioId" = 30 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 30 WHERE "Fecha" = '2026-01-05' AND "MaquinaId" = 10 AND "UsuarioId" = 4 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 0 WHERE "Fecha" = '2026-01-07' AND "MaquinaId" = 16 AND "UsuarioId" = 10 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 5 WHERE "Fecha" = '2026-01-30' AND "MaquinaId" = 8 AND "UsuarioId" = 3 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 5 WHERE "Fecha" = '2026-01-31' AND "MaquinaId" = 8 AND "UsuarioId" = 3 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 30 WHERE "Fecha" = '2026-01-15' AND "MaquinaId" = 7 AND "UsuarioId" = 14 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 12 WHERE "Fecha" = '2026-01-15' AND "MaquinaId" = 16 AND "UsuarioId" = 16 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 20 WHERE "Fecha" = '2026-01-14' AND "MaquinaId" = 13 AND "UsuarioId" = 21 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 50 WHERE "Fecha" = '2026-01-16' AND "MaquinaId" = 16 AND "UsuarioId" = 21 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
UPDATE "ProduccionDiaria" SET "Desperdicio" = 23 WHERE "Fecha" = '2026-01-16' AND "MaquinaId" = 11 AND "UsuarioId" = 22 AND ("Desperdicio" = 0 OR "Desperdicio" IS NULL);
