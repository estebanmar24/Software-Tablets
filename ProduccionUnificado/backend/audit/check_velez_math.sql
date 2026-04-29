SELECT 
    pd."TotalHoras", 
    pd."TotalHorasProductivas", 
    pd."HorasDescanso", 
    pd."TirosBonificables",
    pd."Cambios",
    m."TirosReferencia",
    m."Meta100Porciento"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE u."Nombre" ILIKE '%Velez%'
AND pd."Fecha" = '2026-01-22';
