SELECT 
    DATE("Fecha") as "LogDate",
    SUM("Duracion") as "TotalDuracionSecs",
    COUNT(*) as "NumLogs"
FROM "TiempoProcesos" 
WHERE "UsuarioId" = 16
AND "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31'
GROUP BY DATE("Fecha")
ORDER BY "LogDate";
