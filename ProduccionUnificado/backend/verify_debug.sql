-- Debug: ver los componentes para un dia especifico de Bedoya donde hay discrepancia
-- Jan 16 bonif_bd=16731, bonif_cuadro=16731 (match!)
-- Jan 22 bonif_bd=21225, bonif_cuadro=9225 (big diff!)
SELECT pd."Fecha"::date,
    pd."TotalHorasProductivas"::numeric(6,2) as h_prod,
    pd."HorasMantenimiento"::numeric(6,2) as h_mant,
    pd."HorasDescanso"::numeric(6,2) as h_desc,
    pd."HorasOtrosAux"::numeric(6,2) as h_otros_aux,
    pd."TiempoFaltaTrabajo"::numeric(6,2) as h_falta,
    pd."TiempoReparacion"::numeric(6,2) as h_repar,
    pd."TiempoOtroMuerto"::numeric(6,2) as h_otro_m,
    pd."TotalHoras"::numeric(6,2) as total_horas_bd,
    (pd."TotalHorasProductivas" + pd."HorasMantenimiento" + pd."HorasDescanso" + pd."HorasOtrosAux" + pd."TiempoFaltaTrabajo" + pd."TiempoReparacion" + pd."TiempoOtroMuerto")::numeric(6,2) as total_horas_calc,
    pd."RendimientoFinal"::int as r_final,
    pd."Cambios",
    m."TirosReferencia",
    pd."TirosBonificables"::int as t_bonif,
    pd."ValorTiroSnapshot" as vr_tiro,
    COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0) as meta_base,
    (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)::int as meta75_bd,
    pd."ValorAPagarBonificable"::int as bonif_bd
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-21' AND pd."Fecha" <= '2026-01-22'
AND u."Nombre" ILIKE '%Bedoya%'
ORDER BY pd."Fecha";
