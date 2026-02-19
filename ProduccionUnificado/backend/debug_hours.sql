-- Check if TotalHoras in DB matches what frontend would compute
-- Frontend: TotalHoras = (HorasOperativas + PuestaPunto) + Aux + Muertos
-- DB stores: TotalHoras = TotalHorasProductivas + Aux + Muertos
-- Difference could be if TotalHorasProductivas != HorasOperativas + PuestaPunto
SELECT pd."Fecha"::date,
    pd."HorasOperativas"::numeric(8,4) as h_op,
    pd."TiempoPuestaPunto"::numeric(8,4) as pp,
    (pd."HorasOperativas" + pd."TiempoPuestaPunto")::numeric(8,4) as h_op_plus_pp,
    pd."TotalHorasProductivas"::numeric(8,4) as h_prod_stored,
    pd."TotalHoras"::numeric(8,4) as total_h_stored,
    (pd."HorasOperativas" + pd."TiempoPuestaPunto" + pd."HorasMantenimiento" + pd."HorasDescanso" + pd."HorasOtrosAux" + pd."TiempoFaltaTrabajo" + pd."TiempoReparacion" + pd."TiempoOtroMuerto")::numeric(8,4) as total_h_frontend,
    pd."ValorAPagar"::numeric(12,2) as vr_pagar
FROM "ProduccionDiaria" pd
JOIN "Maquinas" m ON pd."MaquinaId" = m."Id"
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" < '2026-02-01'
AND u."Nombre" ILIKE '%Cristian%Echavarria%'
AND m."Nombre" ILIKE '%8B%'
ORDER BY pd."Fecha";
