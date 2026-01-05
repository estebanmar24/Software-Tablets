-- Script de Diagnóstico Global de Caracteres (Corrected Columns)
-- Busca 'Ã' en todas las columnas de texto relevantes

SELECT 'Usuarios' as Tabla, "Id", "Nombre" as Texto  FROM "Usuarios"  WHERE "Nombre" LIKE '%Ã%';
SELECT 'Maquinas' as Tabla, "Id", "Nombre" as Texto  FROM "Maquinas"  WHERE "Nombre" LIKE '%Ã%';
SELECT 'Actividades' as Tabla, "Id", "Nombre" as Texto  FROM "Actividades"  WHERE "Nombre" LIKE '%Ã%';
SELECT 'OrdenesProduccion' as Tabla, "Id", "Descripcion" as Texto  FROM "OrdenesProduccion"  WHERE "Descripcion" LIKE '%Ã%' OR "Numero" LIKE '%Ã%';
SELECT 'ProduccionDiaria' as Tabla, "Id", "Novedades" as Texto  FROM "ProduccionDiaria"  WHERE "Novedades" LIKE '%Ã%';

-- Columnas corregidas
SELECT 'EncuestasCalidad' as Tabla, "Id", "Observacion" as Texto  FROM "EncuestasCalidad"  WHERE "Observacion" LIKE '%Ã%';
SELECT 'EncuestaNovedades' as Tabla, "Id", "Descripcion" as Texto  FROM "EncuestaNovedades"  WHERE "Descripcion" LIKE '%Ã%';
SELECT 'AdminUsuarios' as Tabla, "Id", "NombreMostrar" as Texto  FROM "AdminUsuarios"  WHERE "NombreMostrar" LIKE '%Ã%';
