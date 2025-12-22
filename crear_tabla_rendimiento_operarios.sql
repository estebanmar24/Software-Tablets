-- ============================================
-- Script: Crear tabla para historial de rendimiento por operario
-- Fecha: 2025-12-22
-- ============================================

-- Crear tabla para guardar rendimiento mensual por operario
IF OBJECT_ID('dbo.RendimientoOperariosMensual', 'U') IS NULL
BEGIN
    CREATE TABLE [RendimientoOperariosMensual] (
        [Id] int NOT NULL IDENTITY,
        [UsuarioId] int NOT NULL,
        [Mes] int NOT NULL,
        [Anio] int NOT NULL,
        [RendimientoPromedio] decimal(10, 2) NOT NULL DEFAULT 0,
        [TotalTiros] int NOT NULL DEFAULT 0,
        [TotalMaquinas] int NOT NULL DEFAULT 0,
        [FechaCalculo] datetime NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_RendimientoOperariosMensual] PRIMARY KEY ([Id]),
        CONSTRAINT [UQ_RendimientoOperariosMensual_UsuarioMesAnio] UNIQUE ([UsuarioId], [Mes], [Anio]),
        CONSTRAINT [FK_RendimientoOperariosMensual_Usuario] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios]([Id])
    );
    CREATE INDEX [IX_RendimientoOperariosMensual_Usuario] ON [RendimientoOperariosMensual] ([UsuarioId], [Anio] DESC, [Mes] DESC);
    PRINT 'Tabla RendimientoOperariosMensual creada.';
END
GO

-- Verificar
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RendimientoOperariosMensual';
GO
