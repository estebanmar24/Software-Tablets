SELECT "Id", "Fecha", "TirosDiarios", "TotalHoras" FROM "ProduccionDiaria" 
WHERE "UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%' LIMIT 1) 
AND "MaquinaId" = (SELECT "Id" FROM "Maquinas" WHERE "Nombre" LIKE '%10B%' LIMIT 1) 
AND "Fecha" >= '2026-02-01' AND "Fecha" <= '2026-02-28' 
ORDER BY "Fecha";
