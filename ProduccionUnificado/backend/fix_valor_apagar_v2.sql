-- FIXED: Use recomputed TotalHoras from individual fields (matching frontend exactly)
-- Frontend formula: TotalHoras = (HorasOperativas + PuestaPunto) + (Mant + Desc + OtrosAux) + (Falta + Repar + OtroM)
-- Then: Meta75 = MetaBase/8 * TotalHoras * 0.75
-- Then: VrPagar = MAX(0, (TirosRef*Cambios + R_Final - Meta75) * ValorTiro)

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
AND pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01';
