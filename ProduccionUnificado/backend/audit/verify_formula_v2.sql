-- VERIFY: Check new formula matches Cuadro values for ALL operators
SELECT u."Nombre" as operario, m."Nombre" as maquina,
    SUM(pd."ValorAPagar")::numeric(12,2) as db_actual,
    SUM(
        CASE WHEN EXTRACT(DOW FROM pd."Fecha") = 0 THEN 0
        ELSE GREATEST(0::decimal, 
            ((m."TirosReferencia" * pd."Cambios" + pd."RendimientoFinal")::decimal
             - (COALESCE(NULLIF(m."Meta100Porciento", 0), m."MetaRendimiento", 0)::decimal / 8.0 
                * (pd."HorasOperativas" + pd."TiempoPuestaPunto" + pd."HorasMantenimiento" + pd."HorasDescanso" + pd."HorasOtrosAux" + pd."TiempoFaltaTrabajo" + pd."TiempoReparacion" + pd."TiempoOtroMuerto")
                * 0.75)
            ) * pd."ValorTiroSnapshot"
        )
        END
    )::numeric(12,2) as formula_v2
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
GROUP BY u."Nombre", m."Nombre", m."Meta100Porciento", m."MetaRendimiento", m."TirosReferencia"
ORDER BY u."Nombre", m."Nombre";
