-- Sync ProduccionDiaria summary from RegistrosDesperdicio details
UPDATE "ProduccionDiaria" pd
SET "Desperdicio" = (
    SELECT COALESCE(SUM(rd."Cantidad"), 0)
    FROM "RegistrosDesperdicio" rd
    WHERE rd."Fecha"::date = pd."Fecha"::date
      AND rd."MaquinaId" = pd."MaquinaId"
      AND rd."UsuarioId" = pd."UsuarioId"
)
WHERE pd."Fecha" >= '2026-04-01' AND pd."Fecha" <= '2026-04-30';
