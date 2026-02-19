-- Fix ValorAPagar para FEBRERO 2026 usando la misma formula exacta del Cuadro
UPDATE "ProduccionDiaria" pd
SET "ValorAPagar" = 
    CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 
                * (pd."HorasOperativas" + pd."TiempoPuestaPunto" + pd."HorasMantenimiento" + pd."HorasDescanso" + pd."HorasOtrosAux" + pd."TiempoFaltaTrabajo" + pd."TiempoReparacion" + pd."TiempoOtroMuerto")
                * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
    END
FROM "Maquinas" m
WHERE pd."MaquinaId" = m."Id"
AND pd."Fecha" >= '2026-02-01' AND pd."Fecha" < '2026-03-01';
