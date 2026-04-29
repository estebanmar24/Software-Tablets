IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Produccion_Producto') AND name = 'Referencia')
BEGIN
    ALTER TABLE Produccion_Producto ADD Referencia NVARCHAR(100) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Produccion_Producto') AND name = 'Descripcion')
BEGIN
    ALTER TABLE Produccion_Producto ADD Descripcion NVARCHAR(500) NULL;
END
