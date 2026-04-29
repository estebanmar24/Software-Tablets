-- Check daily ValorAPagar for Velez on 1B CONVERTIDORA
SELECT pd."Fecha"::date,
    pd."ValorAPagar"::int as valor_pagar_bd,
    pd."ValorAPagarBonificable"::int as bonif_bd,
    pd."RendimientoFinal"::int as r_final,
    pd."Cambios",
    m."TirosReferencia" as t_ref,
    (m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::int as tiros_eq,
    pd."TotalHoras"::numeric(6,2) as total_horas,
    COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0) as meta_base,
    (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)::int as meta75,
    pd."ValorTiroSnapshot" as vr_tiro
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND u."Nombre" ILIKE '%Velez%'
ORDER BY pd."Fecha";
