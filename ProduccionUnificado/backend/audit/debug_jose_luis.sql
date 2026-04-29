-- Find User ID for Jose Luis
SELECT * FROM "Usuarios" WHERE "Nombre" ILIKE '%Jose Luis%';

-- Check ProduccionDiaria for Jose Luis in January
SELECT 
    pd."Fecha",
    m."Nombre" as "Maquina",
    pd."TirosDiarios",
    pd."TirosBonificables",
    pd."Desperdicio",
    pd."DesperdicioBonificable",
    pd."ValorAPagarBonificable",
    pd."ValorTiroSnapshot",
    pd."MetaRendimientoSnapshot",
    pd."Meta100Snapshot",
    pd."EsHorarioLaboral"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE u."Nombre" ILIKE '%Jose Luis%'
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31'
ORDER BY pd."Fecha";
