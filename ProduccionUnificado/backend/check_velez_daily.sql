SELECT 
    pd."Fecha", 
    pd."TotalHorasProductivas" as "Prod", 
    pd."HorasDescanso" as "Desc", 
    (Math.Round(pd."TotalHorasProductivas", 2) + Math.Round(pd."HorasDescanso", 2)) as "T_Horas_New",
    pd."TirosBonificables" as "Tiros",
    pd."ValorAPagarBonificable" as "Bonus"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Velez%'
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
