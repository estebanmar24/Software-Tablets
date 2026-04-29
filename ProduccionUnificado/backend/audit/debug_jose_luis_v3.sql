-- Check Metas for Machines 6 and 7
SELECT "Id", "Nombre", "MetaRendimiento", "Meta100Porciento", "ValorPorTiro" 
FROM "Maquinas" 
WHERE "Id" IN (6, 7);

-- Check ProduccionDiaria for Jose Luis in January on Machines 6 and 7
SELECT 
    pd."Fecha",
    m."Nombre" as "Maquina",
    pd."TirosDiarios",
    pd."TirosBonificables",
    pd."Desperdicio",
    pd."DesperdicioBonificable",
    pd."ValorAPagar",
    pd."ValorAPagarBonificable",
    pd."ValorTiroSnapshot",
    pd."EsHorarioLaboral"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE u."Nombre" ILIKE '%Jose Luis%'
AND pd."MaquinaId" IN (6, 7)
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
