SELECT DISTINCT pd."UsuarioId", u."Nombre" 
FROM "ProduccionDiaria" pd 
JOIN "Usuarios" u ON pd."UsuarioId" = u."Id"
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31';
