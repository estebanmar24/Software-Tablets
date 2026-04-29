UPDATE "ProduccionDiaria" pd
SET "Desperdicio" = COALESCE((
    SELECT SUM("Cantidad")
    FROM "RegistrosDesperdicio" rd
    WHERE rd."Fecha"::date = pd."Fecha"
      AND rd."MaquinaId" = pd."MaquinaId"
      AND rd."UsuarioId" = pd."UsuarioId"
), pd."Desperdicio")
WHERE pd."Fecha" >= '2026-01-01' AND pd."Fecha" <= '2026-01-31';
