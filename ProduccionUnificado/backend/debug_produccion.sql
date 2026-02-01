SELECT 
    pd."Fecha", 
    u."Nombre" as Usuario, 
    m."Nombre" as Maquina, 
    pd."TirosDiarios", 
    pd."TirosBonificables", 
    pd."ValorAPagar", 
    pd."ValorAPagarBonificable",
    m."MetaRendimiento"
FROM "ProduccionDiaria" pd
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
ORDER BY pd."ValorAPagarBonificable" DESC, pd."Fecha" DESC
LIMIT 50;
