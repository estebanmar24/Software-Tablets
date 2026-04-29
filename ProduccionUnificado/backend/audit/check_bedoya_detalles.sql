SELECT 
    "HoraInicio", 
    "HoraFin", 
    "TiempoPasado" as "DuracionDecimal", 
    "CodigoActividad",
    "TirosSumados"
FROM "ProduccionDiariaDetalles" pdd
JOIN "Usuarios" u ON pdd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Bedoya%'
AND DATE(pdd."Fecha") = '2026-01-29'
ORDER BY "HoraInicio";
