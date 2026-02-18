SELECT "Fecha", SUM("TirosDiarios") as Tiros
FROM "ProduccionDiaria"
WHERE "MaquinaId" = (SELECT "Id" FROM "Maquinas" WHERE "Nombre" = '1B CONVERTIDORA')
  AND "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31'
GROUP BY "Fecha"
ORDER BY "Fecha";
