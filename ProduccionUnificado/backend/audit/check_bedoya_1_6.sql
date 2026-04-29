SELECT "Id", "Fecha", "TotalHoras", "TirosDiarios", "MaquinaId" 
FROM "ProduccionDiaria" 
WHERE "UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%') 
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-06'
ORDER BY "Fecha" ASC;
