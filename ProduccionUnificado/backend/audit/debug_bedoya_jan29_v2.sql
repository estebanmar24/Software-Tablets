SELECT 
    pd."Fecha",
    pd."TirosDiarios",
    pd."TirosBonificables",
    pd."TotalHorasProductivas",
    pd."HorasDescanso",
    pd."ValorAPagar",
    pd."ValorAPagarBonificable",
    m."Nombre" as Maquina
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
WHERE pd."UsuarioId" = 16 AND pd."Fecha" = '2026-01-29';

SELECT 
    pdd."ActividadId",
    a."Nombre",
    COUNT(*) as Count,
    SUM(pdd."Tiros") as SumTiros
FROM "ProduccionDiariaDetalles" pdd
LEFT JOIN "Actividades" a ON pdd."ActividadId" = a."Id"
JOIN "ProduccionDiaria" pd ON pdd."ProduccionDiariaId" = pd."Id"
WHERE pd."UsuarioId" = 16 AND pd."Fecha" = '2026-01-29'
GROUP BY pdd."ActividadId", a."Nombre";
