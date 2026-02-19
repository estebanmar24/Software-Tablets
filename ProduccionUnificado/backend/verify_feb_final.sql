SELECT 
    u."Nombre" as "Operario",
    m."Nombre" as "Maquina",
    p."Fecha",
    p."TirosDiarios",
    p."TirosBonificables",
    p."ValorAPagarBonificable",
    p."RendimientoFinal",
    p."TotalHoras"
FROM "ProduccionDiaria" p
JOIN "Usuarios" u ON p."UsuarioId" = u."Id"
JOIN "Maquinas" m ON p."MaquinaId" = m."Id"
WHERE (u."Nombre" LIKE '%Bedoya%' OR u."Nombre" LIKE '%Cristian%')
AND p."Fecha" >= '2026-02-01' AND p."Fecha" <= '2026-02-28'
ORDER BY u."Nombre", p."Fecha";
