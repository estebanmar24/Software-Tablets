SELECT 
    pd."Fecha", 
    pd."TotalHorasProductivas" as "Prod", 
    pd."HorasDescanso" as "Desc", 
    pd."TotalHoras" as "TotalRaw",
    pd."TirosBonificables",
    pd."ValorAPagarBonificable" as "CurrentBonus"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Velez%'
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
