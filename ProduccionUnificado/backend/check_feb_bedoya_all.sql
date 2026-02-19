SELECT p."Id", p."Fecha", p."MaquinaId", m."Nombre" as "Maquina", p."TirosDiarios", p."ValorAPagarBonificable", p."RendimientoFinal"
FROM "ProduccionDiaria" p
JOIN "Maquinas" m ON p."MaquinaId" = m."Id"
WHERE p."UsuarioId" = (SELECT "Id" FROM "Usuarios" WHERE "Nombre" LIKE '%Bedoya%')
AND p."Fecha" >= '2026-02-01' AND p."Fecha" <= '2026-02-28'
ORDER BY p."Fecha" ASC;
