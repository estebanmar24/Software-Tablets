SELECT 
    u."Nombre" as "Operario", 
    SUM(p."ValorAPagarBonificable") as "TotalBonoFeb" 
FROM "ProduccionDiaria" p 
JOIN "Usuarios" u ON p."UsuarioId" = u."Id" 
WHERE p."Fecha" >= '2026-02-01' AND p."Fecha" <= '2026-02-28' 
GROUP BY u."Nombre" 
HAVING SUM(p."ValorAPagarBonificable") > 0 
ORDER BY "TotalBonoFeb" DESC;
