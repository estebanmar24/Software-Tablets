-- Comparar: valores actuales vs formula Cuadro (solo columnas clave)
SELECT pd."Fecha"::date as fecha,
    u."Nombre" as operario,
    pd."ValorAPagarBonificable"::int as bonif_bd,
    CASE WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
    ELSE GREATEST(0::decimal, 
        (pd."TirosBonificables"::decimal
         - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 * pd."TotalHoras" * 0.75)
        ) * pd."ValorTiroSnapshot")::int
    END as bonif_cuadro
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND (u."Nombre" ILIKE '%Bedoya%' OR u."Nombre" ILIKE '%Velez%')
ORDER BY u."Nombre", pd."Fecha";
