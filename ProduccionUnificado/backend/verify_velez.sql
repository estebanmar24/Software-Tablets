SELECT 
    pd."Fecha",
    pd."TotalHorasProductivas",
    pd."TirosDiarios",
    pd."Cambios",
    pd."TirosBonificables",
    pd."ValorAPagarBonificable",
    m."Meta100Porciento",
    m."ValorPorTiro"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE u."Nombre" ILIKE '%Velez%'
AND pd."Fecha" >= '2026-01-27' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
