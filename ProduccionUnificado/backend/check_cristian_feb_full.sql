SELECT "Id", "Nombre", "MetaRendimiento", "Meta100Porciento", "TirosReferencia" FROM "Maquinas" WHERE "Id" = 11;
SELECT "Id", "Fecha", "MaquinaId", "TotalHoras", "TirosDiarios", "Cambios", "TirosBonificables", "ValorAPagarBonificable", "RendimientoFinal" 
FROM "ProduccionDiaria" 
WHERE "UsuarioId" = 30 
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-28' 
ORDER BY "Fecha", "MaquinaId";
