SELECT u."Nombre", p."Fecha", p."HoraInicio", p."HoraFin", p."RendimientoFinal", p."TirosBonificables", p."ValorAPagarBonificable" 
FROM "ProduccionDiaria" p 
JOIN "Usuarios" u ON p."UsuarioId" = u."Id" 
WHERE u."Nombre" LIKE '%Bedoya%' 
AND p."Fecha" >= '2026-01-01' AND p."Fecha" <= '2026-01-31' 
LIMIT 5;
