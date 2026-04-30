-- Añadir campos a Mantenimiento_Productos
ALTER TABLE [Mantenimiento_Productos] ADD [Descripcion] nvarchar(max) NULL;
ALTER TABLE [Mantenimiento_Productos] ADD [Medida] nvarchar(50) NULL;
ALTER TABLE [Mantenimiento_Productos] ADD [PuntoReorden] int NOT NULL DEFAULT 0;
ALTER TABLE [Mantenimiento_Productos] ADD [MaxStock] int NOT NULL DEFAULT 0;

-- Añadir campos a Mantenimiento_Gastos
ALTER TABLE [Mantenimiento_Gastos] ADD [ProductoId] int NULL;
ALTER TABLE [Mantenimiento_Gastos] ADD [Cantidad] decimal(18,2) NULL;

-- Opcional: Agregar Constraint de clave foránea
ALTER TABLE [Mantenimiento_Gastos] ADD CONSTRAINT [FK_Mantenimiento_Gastos_Mantenimiento_Productos_ProductoId] FOREIGN KEY ([ProductoId]) REFERENCES [Mantenimiento_Productos] ([Id]);
