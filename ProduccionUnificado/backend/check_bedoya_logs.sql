SELECT 
    tp."HoraInicio", 
    tp."HoraFin", 
    tp."Duracion", 
    tp."ActividadId",
    tp."Tiros"
FROM "TiempoProcesos" tp
JOIN "Usuarios" u ON tp."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Bedoya%'
AND DATE(tp."Fecha") = '2026-01-29'
ORDER BY tp."HoraInicio";
