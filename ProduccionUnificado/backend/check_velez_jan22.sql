SELECT 
    "Fecha", "TotalHoras", "TotalHorasProductivas", "HorasOperativas", "TiempoPuestaPunto",
    "HorasDescanso", "HorasMantenimiento", "HorasOtrosAux",
    "TiempoFaltaTrabajo", "TiempoReparacion", "TiempoOtroMuerto",
    "ValorAPagarBonificable"
FROM "ProduccionDiaria"
WHERE "UsuarioId" = 13
AND "Fecha" = '2026-01-22';
