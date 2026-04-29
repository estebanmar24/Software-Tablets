-- Sum of ValorAPagar and ValorAPagarBonificable for Velez on 1B CONVERTIDORA
SELECT 
    SUM(pd."ValorAPagar")::int as total_valor_pagar,
    SUM(pd."ValorAPagarBonificable")::int as total_bonif,
    COUNT(*) as dias
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND u."Nombre" ILIKE '%Velez%'
AND m."Nombre" ILIKE '%CONVERTIDORA%';
