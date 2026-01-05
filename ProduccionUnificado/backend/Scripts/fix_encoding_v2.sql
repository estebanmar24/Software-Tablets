-- Script de Corrección de Caracteres V2 (Force Fix)

-- 1. Tabla Actividades - Reemplazos directos de palabras completas
UPDATE "Actividades" SET "Nombre" = 'Producción' WHERE "Nombre" LIKE '%Producci%';
UPDATE "Actividades" SET "Nombre" = 'Reparación' WHERE "Nombre" LIKE '%Reparaci%';
UPDATE "Actividades" SET "Nombre" = 'Puesta a Punto' WHERE "Nombre" LIKE '%Puesta%';
UPDATE "Actividades" SET "Nombre" = 'Mantenimiento y Aseo' WHERE "Nombre" LIKE '%Mantenimiento%';

-- Intento genérico de nuevo por si acaso
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ');

-- 2. Tabla OrdenesProduccion - Automáticamente
UPDATE "OrdenesProduccion" SET "Numero" = REPLACE("Numero", 'AutomÃ¡ticamente', 'Automáticamente');
UPDATE "OrdenesProduccion" SET "Descripcion" = REPLACE("Descripcion", 'AutomÃ¡ticamente', 'Automáticamente');
UPDATE "OrdenesProduccion" SET "Descripcion" = REPLACE("Descripcion", 'AutomÃ', 'Automá');

-- 3. Maquinas
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');

-- 4. Usuarios
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ');
