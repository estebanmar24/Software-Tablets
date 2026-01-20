TRUNCATE TABLE "EncuestaNovedades" RESTART IDENTITY CASCADE;
INSERT INTO "EncuestaNovedades" ("Id", "EncuestaId", "TipoNovedad", "FotoPath", "Descripcion", "CantidadDefectuosa") VALUES ('14', '9', 'Impresión lavada', NULL, NULL, '1000');
INSERT INTO "EncuestaNovedades" ("Id", "EncuestaId", "TipoNovedad", "FotoPath", "Descripcion", "CantidadDefectuosa") VALUES ('15', '9', 'Rasgado de despique', NULL, NULL, '0');
INSERT INTO "EncuestaNovedades" ("Id", "EncuestaId", "TipoNovedad", "FotoPath", "Descripcion", "CantidadDefectuosa") VALUES ('16', '10', 'Impresión lavada', 'C:\Users\Desarrollo3\Desktop\Software-Tablets\ProduccionUnificado\backend\wwwroot\fotos-calidad\10_20251230115228_89e06cf995fe4e258529701a5fe360db.jpg', NULL, '5000');
INSERT INTO "EncuestaNovedades" ("Id", "EncuestaId", "TipoNovedad", "FotoPath", "Descripcion", "CantidadDefectuosa") VALUES ('17', '11', 'Sin hallazgos', NULL, NULL, '0');
INSERT INTO "EncuestaNovedades" ("Id", "EncuestaId", "TipoNovedad", "FotoPath", "Descripcion", "CantidadDefectuosa") VALUES ('18', '12', 'Sin diligenciar documentos', 'C:\Users\Desarrollo3\Desktop\Software-Tablets\ProduccionUnificado\backend\wwwroot\fotos-calidad\12_20251230131118_ea1883cd5a4e4206ab1e443c1c4c6c7a.jpg', NULL, '0');
SELECT setval('"EncuestaNovedades_Id_seq"', (SELECT COALESCE(MAX("Id"), 1) FROM "EncuestaNovedades") + 1, false);
