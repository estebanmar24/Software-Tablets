-- Recalcular ValorAPagar y ValorAPagarBonificable usando la fórmula EXACTA del Cuadro (frontend)
-- Fórmula del Cuadro:
--   TirosEquivalentes = (TirosReferencia * Cambios) + RendimientoFinal
--   MetaBase = COALESCE(NULLIF(Meta100Porciento, 0), MetaRendimiento, 0)
--   MetaRendimiento_dia = (MetaBase / 8.0) * TotalHoras
--   Meta75 = MetaRendimiento_dia * 0.75
--   VrPagar = GREATEST(0, (TirosEquivalentes - Meta75) * ValorTiroSnapshot)   -- 0 si domingo
--   VrPagarBonif = GREATEST(0, (TirosBonificables - Meta75) * ValorTiroSnapshot) -- 0 si domingo

UPDATE "ProduccionesDiarias" pd
SET 
    "ValorAPagar" = CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            (
                (m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
                - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
    END,
    "ValorAPagarBonificable" = CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            (
                pd."TirosBonificables"::decimal
                - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
    END
FROM "Maquinas" m
WHERE pd."MaquinaId" = m."Id"
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01';
