SELECT "Fecha", "UsuarioId", "ValorAPagar", "ValorAPagarBonificable" 
FROM "ProduccionDiaria" 
WHERE "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31' 
AND ("ValorAPagar" > 0 OR "ValorAPagarBonificable" > 0)
LIMIT 10;
