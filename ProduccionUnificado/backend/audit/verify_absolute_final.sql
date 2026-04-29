SELECT 
    u."Nombre",
    SUM(pd."ValorAPagarBonificable") as "ExactTotalBonusJan"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE u."Nombre" ILIKE ANY (ARRAY['%Bedoya%', '%Velez%'])
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
GROUP BY u."Nombre"
ORDER BY u."Nombre";
