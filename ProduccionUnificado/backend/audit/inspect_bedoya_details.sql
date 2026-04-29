SELECT d.* 
FROM "ProduccionDiariaDetalles" d
JOIN "ProduccionDiaria" p ON d."ProduccionDiariaId" = p."Id"
JOIN "Usuarios" u ON p."UsuarioId" = u."Id"
WHERE u."Nombre" LIKE '%Bedoya%' AND p."Fecha" = '2026-01-16';
