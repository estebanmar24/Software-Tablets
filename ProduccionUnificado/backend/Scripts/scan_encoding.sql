-- Script de Diagnóstico Global de Caracteres
-- Busca cualquier ocurrencia de 'Ã' en columnas de texto

SELECT 'Usuarios' as Tabla, "Id", "Nombre" as Texto 
FROM "Usuarios" 
WHERE "Nombre" LIKE '%Ã%';

SELECT 'Maquinas' as Tabla, "Id", "Nombre" as Texto 
FROM "Maquinas" 
WHERE "Nombre" LIKE '%Ã%';

SELECT 'Actividades' as Tabla, "Id", "Nombre" as Texto 
FROM "Actividades" 
WHERE "Nombre" LIKE '%Ã%';

SELECT 'OrdenesProduccion' as Tabla, "Id", "Descripcion" as Texto 
FROM "OrdenesProduccion" 
WHERE "Descripcion" LIKE '%Ã%' OR "Numero" LIKE '%Ã%';

SELECT 'ProduccionDiaria' as Tabla, "Id", "Novedades" as Texto 
FROM "ProduccionDiaria" 
WHERE "Novedades" LIKE '%Ã%';

SELECT 'EncuestasCalidad' as Tabla, "Id", "Observaciones" as Texto 
FROM "EncuestasCalidad" 
WHERE "Observaciones" LIKE '%Ã%';

SELECT 'EncuestaNovedades' as Tabla, "Id", "Detalle" as Texto 
FROM "EncuestaNovedades" 
WHERE "Detalle" LIKE '%Ã%';

SELECT 'AdminUsuarios' as Tabla, "Id", "Nombre" as Texto 
FROM "AdminUsuarios" 
WHERE "Nombre" LIKE '%Ã%';
