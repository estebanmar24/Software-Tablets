SELECT COUNT(*) FROM "ProduccionDiariaDetalles" d
JOIN "ProduccionDiaria" p ON d."ProduccionDiariaId" = p."Id"
WHERE p."Fecha" >= '2026-01-01' AND p."Fecha" <= '2026-01-31';
