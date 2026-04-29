SELECT u."Nombre", p."Fecha", p."TirosDiarios", p."Cambios", p."RendimientoFinal"
FROM "ProduccionDiaria" p 
JOIN "Usuarios" u ON p."UsuarioId" = u."Id" 
WHERE u."Nombre" LIKE '%Bedoya%' 
AND p."Fecha" = '2026-01-16';
