SELECT "Fecha", "UsuarioId", "MaquinaId", "HoraInicio", "HoraFin", "Tiros", "ActividadId"
FROM "TiemposProceso" 
WHERE "Fecha" >= '2026-01-01' AND "Fecha" <= '2026-01-31' 
AND "Tiros" > 0
LIMIT 10;
