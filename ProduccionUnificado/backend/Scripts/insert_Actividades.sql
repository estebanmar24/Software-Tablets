TRUNCATE TABLE "Actividades" RESTART IDENTITY CASCADE;
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('1', '01', 'Puesta a Punto', '0', '1', 'Preparación inicial de la máquina');
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('2', '02', 'Producción', '1', '2', 'Tiempo productivo de operación');
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('3', '03', 'Reparación', '0', '3', 'Reparación de fallas o averías');
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('4', '04', 'Descanso', '0', '4', 'Tiempo de descanso programado');
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('6', '10', 'Mantenimiento y Aseo', '0', '6', 'Mantenimiento preventivo');
INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES ('7', '13', 'Falta de Trabajo', '0', '7', 'Sin órdenes asignadas');
SELECT setval('"Actividades_Id_seq"', (SELECT COALESCE(MAX("Id"), 1) FROM "Actividades") + 1, false);
