TRUNCATE TABLE "CalificacionesMensuales" RESTART IDENTITY CASCADE;
SELECT setval('"CalificacionesMensuales_Id_seq"', (SELECT COALESCE(MAX("Id"), 1) FROM "CalificacionesMensuales") + 1, false);
