SELECT "Fecha", "TirosDiarios", "ValorAPagarBonificable", "RendimientoFinal" 
FROM "ProduccionDiaria" 
WHERE "UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%' LIMIT 1) 
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-28' 
AND "ValorAPagarBonificable" > 0 
ORDER BY "Fecha";
