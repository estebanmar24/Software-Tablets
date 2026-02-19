-- Debug: Cristian Felipe on 8B perdiendo $94 (28844 vs 28750)
-- Check each day's components
SELECT pd."Fecha"::date,
    pd."RendimientoFinal"::int as r_final,
    pd."Cambios" as cambios,
    m."TirosReferencia" as t_ref,
    (m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::int as tiros_eq,
    pd."HorasOperativas"::numeric(8,4) as h_operativas,
    pd."TiempoPuestaPunto"::numeric(8,4) as p_punto,
    pd."TotalHorasProductivas"::numeric(8,4) as h_prod_bd,
    (pd."HorasOperativas" + pd."TiempoPuestaPunto")::numeric(8,4) as h_prod_calc,
    pd."TotalHoras"::numeric(8,4) as total_horas_bd,
    (pd."TotalHorasProductivas" + pd."HorasMantenimiento" + pd."HorasDescanso" + pd."HorasOtrosAux" + pd."TiempoFaltaTrabajo" + pd."TiempoReparacion" + pd."TiempoOtroMuerto")::numeric(8,4) as total_horas_calc,
    COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::int as meta_base,
    pd."ValorTiroSnapshot"::numeric(8,2) as vr_tiro,
    pd."ValorAPagar"::numeric(12,2) as vr_pagar_bd,
    GREATEST(0::decimal, 
        ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
         - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
        ) * pd."ValorTiroSnapshot"
    )::numeric(12,2) as vr_pagar_formula
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND u."Nombre" ILIKE '%Cristian%Echavarria%'
AND m."Nombre" ILIKE '%8B%'
ORDER BY pd."Fecha";
