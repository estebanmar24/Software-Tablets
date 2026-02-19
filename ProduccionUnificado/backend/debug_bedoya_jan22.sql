SELECT 
    pdd."ActividadId",
    a."Nombre",
    pdd."HoraInicio",
    pdd."HoraFin",
    pdd."Tiros",
    (EXTRACT(EPOCH FROM (pdd."HoraFin" - pdd."HoraInicio")) / 3600) as HorasReales
FROM "ProduccionDiariaDetalles" pdd
LEFT JOIN "Actividades" a ON pdd."ActividadId" = a."Id"
JOIN "ProduccionDiaria" pd ON pdd."ProduccionDiariaId" = pd."Id"
WHERE pd."UsuarioId" = 16 AND pd."Fecha" = '2026-01-22';
