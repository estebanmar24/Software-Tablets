SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('EncuestasCalidadProduccion', 'EncuestaCalidadProduccionProcesos')
ORDER BY table_name, ordinal_position;
