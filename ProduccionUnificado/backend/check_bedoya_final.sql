SELECT 
    pd."Fecha", 
    pd."TotalHoras" as "BaseH",
    pd."TirosBonificables",
    pd."ValorAPagarBonificable" as "Bonus"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE '%Bedoya%'
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
