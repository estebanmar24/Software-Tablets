SELECT 
    pd."Fecha", 
    pd."TotalHoras", 
    pd."TotalHorasProductivas", 
    pd."HorasDescanso", 
    pd."ValorAPagarBonificable", 
    (pd."TirosBonificables" + (pd."Cambios" * m."TirosReferencia")) as "TirosTotalesEq",
    (m."Meta100Porciento" * 0.75 * (pd."TotalHoras" / 8.0)) as "Meta75Prorrateada"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE u."Nombre" ILIKE '%Bedoya%'
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
