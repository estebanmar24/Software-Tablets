SELECT "Id", "Fecha", "TotalHoras", "TirosDiarios", "TirosBonificables", "ValorAPagarBonificable", "RendimientoFinal" 
FROM "ProduccionDiaria" 
WHERE "UsuarioId" = 30 AND "MaquinaId" = 11
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-28' 
ORDER BY "Fecha";
