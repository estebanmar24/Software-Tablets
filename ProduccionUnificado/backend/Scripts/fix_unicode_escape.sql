-- Script de Corrección Infalible (Unicode Escapes)
-- Usa sintaxis U&'\xxxx' para garantizar los caracteres exactos sin depender del encoding del archivo.

-- 1. Tabla Actividades
UPDATE "Actividades" SET "Nombre" = U&'Producci\00F3n' WHERE "Codigo" = '02';
UPDATE "Actividades" SET "Nombre" = U&'Reparaci\00F3n' WHERE "Codigo" = '03';
UPDATE "Actividades" SET "Nombre" = U&'Autom\00E1ticamente' WHERE "Nombre" LIKE '%Autom%';

-- 2. Tabla OrdenesProduccion
UPDATE "OrdenesProduccion" SET "Descripcion" = U&'Generada Autom\00E1ticamente' WHERE "Descripcion" LIKE '%Autom%';
UPDATE "OrdenesProduccion" SET "Numero" = U&'Generada Autom\00E1ticamente' WHERE "Numero" LIKE '%Autom%';

-- 3. Tabla Maquinas (tildes comunes)
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", U&'\00C3\00B3', U&'\00F3'); -- Ã³ -> ó
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", U&'\00C3\00A1', U&'\00E1'); -- Ã¡ -> á
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", U&'\00C3\00A9', U&'\00E9'); -- Ã© -> é
UPDATE "Maquinas" SET "Nombre" = REPLACE("Nombre", U&'\00C3\00B1', U&'\00F1'); -- Ã± -> ñ

-- Verificar y notificar
DO $$
BEGIN 
  RAISE NOTICE 'Corrección Unicode aplicada.';
END $$;
