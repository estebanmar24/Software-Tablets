SELECT u."Nombre", p."Fecha", p."TirosDiarios", p."ValorAPagarBonificable" 
FROM "ProduccionDiaria" p 
JOIN "Usuarios" u ON p."UsuarioId" = u."Id" 
WHERE p."Fecha" >= '2026-01-01' AND p."Fecha" <= '2026-01-31' 
AND p."ValorAPagarBonificable" > 0 
ORDER BY p."Fecha" ASC 
LIMIT 10;
