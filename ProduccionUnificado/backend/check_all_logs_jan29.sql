SELECT 
    u."Nombre",
    tp."HoraInicio", 
    tp."HoraFin", 
    tp."Duracion", 
    tp."ActividadId",
    tp."Tiros"
FROM "TiempoProcesos" tp
JOIN "Usuarios" u ON tp."UsuarioId" = u."Id"
WHERE DATE(tp."Fecha") = '2026-01-29'
LIMIT 10;
