SELECT "Id", "Nombre", "MetaRendimiento", "Meta100Porciento", "TirosReferencia", "ValorPorTiro"
FROM "Maquinas"
WHERE "Nombre" ILIKE '%1B%';
