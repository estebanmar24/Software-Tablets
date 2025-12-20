-- ============================================
-- Script de Migración: Agregar columnas a Maquinas
-- Fecha: 2025-12-18
-- Descripción: Agrega Importancia y Meta100Porciento, calcula valores
-- ============================================

-- Verificar y agregar columna Importancia
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Maquinas' AND COLUMN_NAME = 'Importancia'
)
BEGIN
    ALTER TABLE [dbo].[Maquinas]
    ADD [Importancia] INT NOT NULL DEFAULT 0;
    
    PRINT 'Columna Importancia agregada exitosamente.';
END
ELSE
BEGIN
    PRINT 'La columna Importancia ya existe.';
END
GO

-- Verificar y agregar columna Meta100Porciento
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Maquinas' AND COLUMN_NAME = 'Meta100Porciento'
)
BEGIN
    ALTER TABLE [dbo].[Maquinas]
    ADD [Meta100Porciento] INT NOT NULL DEFAULT 0;
    
    PRINT 'Columna Meta100Porciento agregada exitosamente.';
END
ELSE
BEGIN
    PRINT 'La columna Meta100Porciento ya existe.';
END
GO

-- ============================================
-- PASO 2: Calcular Meta100Porciento basado en MetaRendimiento actual
-- MetaRendimiento actual = 75%, entonces Meta100 = MetaRendimiento / 0.75
-- ============================================
UPDATE Maquinas 
SET Meta100Porciento = CAST(ROUND(MetaRendimiento / 0.75, 0) AS INT)
WHERE Meta100Porciento = 0 OR Meta100Porciento IS NULL;

PRINT 'Meta100Porciento calculado para todas las máquinas.';
GO

-- ============================================
-- PASO 3: Distribuir Importancia equitativamente entre máquinas activas
-- 100% dividido entre el número de máquinas activas
-- ============================================
DECLARE @CantidadMaquinas INT;
DECLARE @ImportanciaIgual INT;
DECLARE @Residuo INT;

-- Contar máquinas activas
SELECT @CantidadMaquinas = COUNT(*) FROM Maquinas WHERE Activa = 1;

IF @CantidadMaquinas > 0
BEGIN
    -- Calcular porcentaje igual para cada una
    SET @ImportanciaIgual = 100 / @CantidadMaquinas;
    SET @Residuo = 100 % @CantidadMaquinas;
    
    -- Asignar importancia igual a todas las máquinas activas
    UPDATE Maquinas 
    SET Importancia = @ImportanciaIgual
    WHERE Activa = 1;
    
    -- Si hay residuo, asignarlo a la primera máquina para que sume 100%
    IF @Residuo > 0
    BEGIN
        UPDATE TOP(1) Maquinas 
        SET Importancia = Importancia + @Residuo
        WHERE Activa = 1;
    END
    
    PRINT 'Importancia distribuida equitativamente entre ' + CAST(@CantidadMaquinas AS VARCHAR) + ' máquinas (' + CAST(@ImportanciaIgual AS VARCHAR) + '% cada una).';
END
GO

-- ============================================
-- Verificar resultados
-- ============================================
SELECT 
    Id,
    Nombre,
    MetaRendimiento AS 'Meta 75%',
    Meta100Porciento AS 'Meta 100%',
    Importancia AS 'Importancia %',
    ValorPorTiro,
    Activa
FROM Maquinas
ORDER BY Nombre;

-- Verificar que la suma de importancias sea 100%
SELECT 
    SUM(Importancia) AS 'Total Importancia (debe ser 100)',
    COUNT(*) AS 'Cantidad Máquinas Activas'
FROM Maquinas 
WHERE Activa = 1;

