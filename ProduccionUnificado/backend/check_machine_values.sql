SELECT m."Id", m."Nombre", m."ValorPorTiro", m."Meta100Porciento"
FROM "Maquinas" m
WHERE m."Nombre" ILIKE '%CONVERTIDORA%' OR m."Nombre" ILIKE '%Colaminadora%';
