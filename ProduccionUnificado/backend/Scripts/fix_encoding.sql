-- Script de Corrección de Caracteres (Fix Encoding Artifacts)
-- Reemplaza secuencias UTF-8 mal interpretadas

-- 1. Tabla Actividades
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã©', 'é');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ãed', 'í');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ãn', 'í');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'Ãº', 'ú');

-- Casos específicos vistos en la imagen
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'ProducciÃ³n', 'Producción');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'ReparaciÃ³n', 'Reparación');
UPDATE "Actividades" SET "Nombre" = REPLACE("Nombre", 'AutomÃ¡ticamente', 'Automáticamente');

-- 2. Tabla Maquinas
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã©', 'é');
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ');

-- 3. Tabla OrdenesProduccion
UPDATE "OrdenesProduccion" SET "Numero" = REPLACE("Numero", 'Ã³', 'ó');
UPDATE "OrdenesProduccion" SET "Descripcion" = REPLACE("Descripcion", 'Ã³', 'ó');
UPDATE "OrdenesProduccion" SET "Descripcion" = REPLACE("Descripcion", 'AutomÃ¡ticamente', 'Automáticamente');

-- 4. Tabla Usuarios (Nombres)
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã©', 'é');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ãº', 'ú');
UPDATE "Usuarios" SET "Nombre" = REPLACE("Nombre", 'Ã', 'í'); -- Cuidado con este, usar al final
