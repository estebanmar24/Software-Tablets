SELECT SUM(pdd."Desperdicio") FROM "ProduccionDiariaDetalles" pdd JOIN "ProduccionDiaria" pd ON pdd."ProduccionDiariaId" = pd."Id" WHERE pd."UsuarioId" = 16 AND pd."Fecha" = '2026-01-22';
