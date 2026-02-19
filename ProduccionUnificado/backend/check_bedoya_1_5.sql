SELECT "Id", "Fecha", "TotalHoras", "TirosDiarios" 
FROM "ProduccionDiaria" 
WHERE "UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%') 
AND "MaquinaId" = (SELECT "Id" FROM "Maquinas" WHERE "Nombre" LIKE '%10A%') 
AND "Fecha" <= '2026-02-05' 
ORDER BY "Fecha" ASC;
