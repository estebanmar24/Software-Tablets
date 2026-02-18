SELECT "Fecha", "UsuarioId", "MaquinaId", "TotalHoras", "RendimientoFinal", "Cambios", "TirosDiarios", "ValorAPagar", "ValorAPagarBonificable", "TirosBonificables"
FROM "ProduccionDiaria" 
WHERE "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31' 
AND "RendimientoFinal" > 0
LIMIT 5;
