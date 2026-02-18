SELECT "Id", "MaquinaId", "UsuarioId", "Cantidad", "Fecha", "OrdenProduccion" 
FROM "RegistrosDesperdicio" 
WHERE "Fecha"::date = '2026-01-31';
