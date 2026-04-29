WITH Metas AS (
    SELECT 
        p."UsuarioId", 
        u."Id" as "Uid",
        u."Nombre" as "Operario",
        p."MaquinaId", 
        m."Nombre" as "Maquina",
        SUM(p."RendimientoFinal") as "TotalRendimiento",
        AVG(CASE 
            WHEN m."Meta100Porciento" > 0 THEN m."Meta100Porciento" 
            ELSE m."MetaRendimiento" / 0.75 
        END) * 0.75 as "Umbral75"
    FROM "ProduccionDiaria" p
    JOIN "Usuarios" u ON p."UsuarioId" = u."Id"
    JOIN "Maquinas" m ON p."MaquinaId" = m."Id"
    WHERE p."Fecha" >= '2026-02-01' AND p."Fecha" <= '2026-02-28'
    GROUP BY p."UsuarioId", u."Id", u."Nombre", p."MaquinaId", m."Nombre"
)
SELECT "Operario", "Maquina", "TotalRendimiento", "Umbral75", ("TotalRendimiento" / "Umbral75" * 100) as "Pct"
FROM Metas
WHERE "TotalRendimiento" > "Umbral75"
ORDER BY "Pct" DESC;
