-- Verificación de Conteo de Datos Corruptos
-- Debe devolver 0 para todas las tablas

SELECT 'Usuarios' as Tabla, COUNT(*) as Corruptos FROM "Usuarios" WHERE "Nombre" LIKE '%Ã%';
SELECT 'Maquinas' as Tabla, COUNT(*) as Corruptos FROM "Maquinas" WHERE "Nombre" LIKE '%Ã%';
SELECT 'Actividades' as Tabla, COUNT(*) as Corruptos FROM "Actividades" WHERE "Nombre" LIKE '%Ã%';
SELECT 'OrdenesProduccion' as Tabla, COUNT(*) as Corruptos FROM "OrdenesProduccion" WHERE "Descripcion" LIKE '%Ã%' OR "Numero" LIKE '%Ã%';
SELECT 'ProduccionDiaria' as Tabla, COUNT(*) as Corruptos FROM "ProduccionDiaria" WHERE "Novedades" LIKE '%Ã%';
SELECT 'EncuestasCalidad' as Tabla, COUNT(*) as Corruptos FROM "EncuestasCalidad" WHERE "Observacion" LIKE '%Ã%';
SELECT 'EncuestaNovedades' as Tabla, COUNT(*) as Corruptos FROM "EncuestaNovedades" WHERE "Descripcion" LIKE '%Ã%';
SELECT 'AdminUsuarios' as Tabla, COUNT(*) as Corruptos FROM "AdminUsuarios" WHERE "NombreMostrar" LIKE '%Ã%';
