-- Step 1: Verify formula matches Velez's known-correct $343,313
-- Formula: VrPagar = MAX(0, (TirosEquivalentes - Meta75) * ValorTiroSnapshot)
-- where TirosEquivalentes = TirosRef * Cambios + RendimientoFinal
-- and Meta75 = (MetaBase / 8) * TotalHoras * 0.75
-- and VrPagar = 0 on Sundays
SELECT u."Nombre" as operario, m."Nombre" as maquina,
    SUM(pd."ValorAPagar")::numeric(12,2) as db_actual,
    SUM(
        CASE WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
        END
    )::numeric(12,2) as formula_cuadro
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
GROUP BY u."Nombre", m."Nombre", m."Meta100Porciento", m."MetaRendimiento", m."TirosReferencia"
ORDER BY u."Nombre", m."Nombre";
