SELECT "UsuarioId", "MaquinaId", "Fecha", "TirosDiarios", "Cambios", "TirosBonificables", "ValorAPagar", "ValorAPagarBonificable"
FROM "ProduccionDiaria"
WHERE "UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%' LIMIT 1)
AND "Fecha" = '2026-01-16';
