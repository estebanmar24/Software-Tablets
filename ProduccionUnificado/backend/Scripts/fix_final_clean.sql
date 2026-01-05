-- Script de Limpieza Final y Re-poblado (Clean Slate)

-- 1. Tabla Actividades: Datos Maestros (Reconstrucción total)
TRUNCATE TABLE "Actividades" RESTART IDENTITY CASCADE;

INSERT INTO "Actividades" ("Id", "Codigo", "Nombre", "EsProductiva", "Orden", "Observaciones") VALUES
(1, '01', 'Puesta a Punto', true, 1, NULL),
(2, '02', 'Producción', true, 2, NULL),
(3, '03', 'Reparación', false, 3, NULL),
(4, '04', 'Descanso', false, 4, NULL),
(5, '08', 'Reuniones y Capacitaciones', false, 8, NULL),
(6, '10', 'Mantenimiento y Aseo', false, 5, NULL),
(7, '11', 'Otros', false, 6, NULL),
(8, '13', 'Falta de Trabajo', false, 7, NULL);

SELECT setval('"Actividades_Id_seq"', 8, true);


-- 2. Tabla OrdenesProduccion: Corrección forzada
-- Actualizamos TODOS los registros que contengan "Autom" en la descripción
UPDATE "OrdenesProduccion" 
SET "Descripcion" = 'Generada Automáticamente', 
    "Numero" = 'Generada Automáticamente'
WHERE "Descripcion" LIKE '%Autom%' OR "Numero" LIKE '%Autom%';


-- 3. Confirmación
DO $$
BEGIN 
  RAISE NOTICE 'Tabla Actividades reconstruida exitosamente con 8 registros.';
  RAISE NOTICE 'Ordenes de Producción corregidas.';
END $$;
