-- Verificar Bedoya y Velez: valores actuales vs fórmula del Cuadro
SELECT 
    pd."Fecha"::date,
    u."Nombre" as operario,
    m."Nombre" as maquina,
    pd."RendimientoFinal"::int as r_final,
    pd."Cambios",
    m."TirosReferencia" as tiros_ref,
    (m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::int as tiros_eq,
    pd."TirosBonificables"::int as tiros_bonif,
    pd."TotalHoras"::numeric(6,2) as horas,
    COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0) as meta_base,
    pd."ValorTiroSnapshot" as vr_tiro,
    pd."ValorAPagar"::int as vr_pagar_actual,
    pd."ValorAPagarBonificable"::int as bonif_actual,
    -- Recalcular con fórmula del Cuadro:
    CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )::int
    END as vr_pagar_cuadro,
    CASE 
        WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            (pd."TirosBonificables"::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
            ) * pd."ValorTiroSnapshot"
        )::int
    END as bonif_cuadro
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND (u."Nombre" ILIKE '%Bedoya%' OR u."Nombre" ILIKE '%Velez%')
ORDER BY u."Nombre", pd."Fecha"
LIMIT 15;
