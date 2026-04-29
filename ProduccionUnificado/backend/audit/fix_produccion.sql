-- Add RubroId column to Produccion_Proveedores table
ALTER TABLE "Produccion_Proveedores" ADD COLUMN IF NOT EXISTS "RubroId" INT NULL;

-- Reinsert default data for Rubros (if empty)
INSERT INTO "Produccion_Rubros" ("Nombre", "Activo")
SELECT 'Horas Extras', true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_Rubros" WHERE "Nombre" = 'Horas Extras');

INSERT INTO "Produccion_Rubros" ("Nombre", "Activo")
SELECT 'Mantenimiento', true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_Rubros" WHERE "Nombre" = 'Mantenimiento');

INSERT INTO "Produccion_Rubros" ("Nombre", "Activo")
SELECT 'Repuesto', true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_Rubros" WHERE "Nombre" = 'Repuesto');

INSERT INTO "Produccion_Rubros" ("Nombre", "Activo")
SELECT 'Refrigerios', true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_Rubros" WHERE "Nombre" = 'Refrigerios');

-- Reinsert default data for TiposHora (if empty)
INSERT INTO "Produccion_TiposHora" ("Nombre", "Porcentaje", "Factor", "Activo")
SELECT 'Hora Extra Diurna', 25, 1.25, true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_TiposHora" WHERE "Nombre" = 'Hora Extra Diurna');

INSERT INTO "Produccion_TiposHora" ("Nombre", "Porcentaje", "Factor", "Activo")
SELECT 'Hora Extra Nocturna', 75, 1.75, true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_TiposHora" WHERE "Nombre" = 'Hora Extra Nocturna');

INSERT INTO "Produccion_TiposHora" ("Nombre", "Porcentaje", "Factor", "Activo")
SELECT 'Hora Dominical/Festiva Diurna', 100, 2.0, true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_TiposHora" WHERE "Nombre" = 'Hora Dominical/Festiva Diurna');

INSERT INTO "Produccion_TiposHora" ("Nombre", "Porcentaje", "Factor", "Activo")
SELECT 'Hora Dominical/Festiva Nocturna', 150, 2.5, true
WHERE NOT EXISTS (SELECT 1 FROM "Produccion_TiposHora" WHERE "Nombre" = 'Hora Dominical/Festiva Nocturna');
