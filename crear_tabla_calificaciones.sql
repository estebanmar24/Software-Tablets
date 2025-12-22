-- ============================================
-- Script: Crear tabla CalificacionesMensuales
-- Fecha: 2025-12-22
-- Descripción: Tabla para almacenar las calificaciones mensuales de la planta
-- ============================================

-- Verificar si la tabla ya existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CalificacionesMensuales')
BEGIN
    CREATE TABLE [dbo].[CalificacionesMensuales] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Mes] INT NOT NULL,
        [Anio] INT NOT NULL,
        [CalificacionTotal] DECIMAL(10, 2) NOT NULL DEFAULT 0,
        [FechaCalculo] DATETIME NOT NULL DEFAULT GETDATE(),
        [Notas] NVARCHAR(500) NULL,
        [DesgloseMaquinas] NVARCHAR(MAX) NULL,
        
        -- Índice único para evitar duplicados de mes/año
        CONSTRAINT [UQ_CalificacionesMensuales_MesAnio] UNIQUE ([Mes], [Anio])
    );
    
    PRINT 'Tabla CalificacionesMensuales creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'La tabla CalificacionesMensuales ya existe.';
END
GO

-- Crear índice para consultas por año
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CalificacionesMensuales_Anio')
BEGIN
    CREATE INDEX [IX_CalificacionesMensuales_Anio] 
    ON [dbo].[CalificacionesMensuales] ([Anio] DESC, [Mes] DESC);
    
    PRINT 'Índice IX_CalificacionesMensuales_Anio creado.';
END
GO

-- Verificar estructura
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'CalificacionesMensuales'
ORDER BY ORDINAL_POSITION;
GO
