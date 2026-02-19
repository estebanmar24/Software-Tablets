SELECT "Fecha", COUNT(*) FROM "ProduccionDiaria" WHERE "UsuarioId" = 13 AND "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31' GROUP BY "Fecha" HAVING COUNT(*) > 1;
