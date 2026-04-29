-- Batch UPDATE: Recalcular ValorAPagar para TODOS los operarios usando la formula exacta del Cuadro
-- Formula: VrPagar = MAX(0, (TirosEquivalentes - Meta75) * ValorTiroSnapshot)
-- TirosEquivalentes = TirosRef * Cambios + RendimientoFinal
-- Meta75 = (MetaBase / 8) * TotalHoras * 0.75
-- VrPagar = 0 en domingos

UPDATE "ProduccionDiaria" pd
SET "ValorAPagar" = 
    CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
    END
FROM "Maquinas" m
WHERE pd."MaquinaId" = m."Id"
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01';
