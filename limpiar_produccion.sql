-- ============================================
-- Script para LIMPIAR datos (Actualizado)
-- ============================================
-- ADVERTENCIA: Este script borrará:
-- 1. Historial de Producción (ProduccionDiaria)
-- 2. Historial de Tiempos (TiempoProcesos)
--
-- No borrará Usuarios, Máquinas ni Actividades.
-- ============================================

BEGIN TRANSACTION;

BEGIN TRY
    -- 1. Borrar datos de ProduccionDiaria
    DELETE FROM [dbo].[ProduccionDiaria];
    DBCC CHECKIDENT ('[dbo].[ProduccionDiaria]', RESEED, 0);
    PRINT 'Tabla ProduccionDiaria limpiada.';

    -- 2. Borrar datos de TiempoProcesos
    DELETE FROM [dbo].[TiempoProcesos];
    DBCC CHECKIDENT ('[dbo].[TiempoProcesos]', RESEED, 0);
    PRINT 'Tabla TiempoProcesos limpiada.';
    
    -- Opcional: Si deseas borrar Órdenes de Producción, descomenta las siguientes líneas:
    -- DELETE FROM [dbo].[OrdenesProduccion];
    -- DBCC CHECKIDENT ('[dbo].[OrdenesProduccion]', RESEED, 0);

    COMMIT TRANSACTION;
    PRINT 'Limpieza completada exitosamente.';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'Error al intentar borrar los datos: ' + ERROR_MESSAGE();
END CATCH;
