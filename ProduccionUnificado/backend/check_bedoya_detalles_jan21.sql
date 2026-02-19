SELECT 
    pdd."HoraInicio", 
    pdd."HoraFin", 
    pdd."Tiros", 
    pdd."ActividadId"
FROM "ProduccionDiariaDetalles" pdd
JOIN "ProduccionDiaria" pd ON pdd."ProduccionDiariaId" = pd."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Bedoya%'
AND pd."Fecha" = '2026-01-21'
ORDER BY pdd."HoraInicio";
