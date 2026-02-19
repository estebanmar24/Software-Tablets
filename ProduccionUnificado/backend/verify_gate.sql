-- Check if 75% gate affects any operator - compute pct100 for each
SELECT u."Nombre" as operario, m."Nombre" as maquina,
    SUM(pd."ValorAPagarBonificable")::int as bonif_sum,
    -- Compute pct100 as in resumenOperarios
    SUM(m."TirosReferencia" * pd."Cambios" + ROUND(pd."RendimientoFinal"))::int as total_tiros,
    SUM(pd."TotalHoras") as total_horas,
    COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0) as meta_base,
    (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * SUM(pd."TotalHoras"))::int as meta100,
    CASE WHEN (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * SUM(pd."TotalHoras")) > 0
        THEN (SUM(m."TirosReferencia" * pd."Cambios" + ROUND(pd."RendimientoFinal"))::decimal / (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * SUM(pd."TotalHoras")) * 100)::int
        ELSE 0
    END as pct100,
    CASE WHEN (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * SUM(pd."TotalHoras")) > 0
        AND (SUM(m."TirosReferencia" * pd."Cambios" + ROUND(pd."RendimientoFinal"))::decimal / (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * SUM(pd."TotalHoras")) * 100) >= 75
        THEN SUM(pd."ValorAPagarBonificable")::int
        ELSE 0
    END as bonif_after_gate
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
GROUP BY u."Nombre", m."Nombre", m."Meta100Porciento", m."MetaRendimiento"
ORDER BY u."Nombre", m."Nombre";
