SELECT "Id", "Fecha", "TirosDiarios", "TirosBonificables", "ValorAPagar", "ValorAPagarBonificable", "RendimientoFinal"
FROM "ProduccionDiaria"
WHERE "UsuarioId" = 27 AND "MaquinaId" = 13
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-28'
ORDER BY "Fecha" ASC;
