-- ============================================
-- Script: Distribuir importancia equitativamente (100% entre todas las activas)
-- Fecha: 2025-12-22
-- ============================================

-- Primero verificar cuántas máquinas activas hay
DECLARE @TotalMaquinasActivas INT;
SELECT @TotalMaquinasActivas = COUNT(*) FROM [Maquinas] WHERE [Activa] = 1;
PRINT 'Total máquinas activas: ' + CAST(@TotalMaquinasActivas AS VARCHAR);

-- Calcular la importancia exacta para cada máquina
DECLARE @ImportanciaPorMaquina DECIMAL(10, 4);
SET @ImportanciaPorMaquina = 100.0 / @TotalMaquinasActivas;
PRINT 'Importancia por máquina: ' + CAST(@ImportanciaPorMaquina AS VARCHAR);

-- Actualizar todas las máquinas activas con la importancia calculada
UPDATE [Maquinas]
SET [Importancia] = ROUND(@ImportanciaPorMaquina, 2)
WHERE [Activa] = 1;

-- Las inactivas tienen 0
UPDATE [Maquinas]
SET [Importancia] = 0
WHERE [Activa] = 0;

-- Ajustar la primera máquina para que la suma sea exactamente 100%
-- (por el redondeo puede quedar 99.96% o similar)
DECLARE @SumaActual DECIMAL(10, 2);
SELECT @SumaActual = SUM([Importancia]) FROM [Maquinas] WHERE [Activa] = 1;

DECLARE @Diferencia DECIMAL(10, 2);
SET @Diferencia = 100.00 - @SumaActual;

IF @Diferencia <> 0
BEGIN
    -- Ajustar la primera máquina activa para compensar
    UPDATE [Maquinas]
    SET [Importancia] = [Importancia] + @Diferencia
    WHERE [Id] = (SELECT TOP 1 [Id] FROM [Maquinas] WHERE [Activa] = 1 ORDER BY [Id]);
    
    PRINT 'Ajuste aplicado: ' + CAST(@Diferencia AS VARCHAR) + ' para sumar exactamente 100%';
END
GO

-- Verificar resultado
SELECT 
    [Id],
    [Nombre],
    [Activa],
    CAST([Importancia] AS DECIMAL(5,2)) AS [Importancia],
    [Meta100Porciento]
FROM [Maquinas]
ORDER BY [Nombre] DESC;
GO

-- Verificar que suma 100%
SELECT 
    SUM([Importancia]) AS TotalImportancia,
    COUNT(*) AS MaquinasActivas
FROM [Maquinas]
WHERE [Activa] = 1;
GO
