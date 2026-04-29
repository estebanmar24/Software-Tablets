IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Produccion_Producto') AND name = 'Medida')
BEGIN
    ALTER TABLE Produccion_Producto ADD Medida NVARCHAR(20) NULL;
END
