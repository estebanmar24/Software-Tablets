-- PostgreSQL DDL Script for GH (Gestión Humana) Tables
-- Run this script in PostgreSQL to create the GH module tables

-- GH_Rubros (Expense Categories)
CREATE TABLE IF NOT EXISTS "GH_Rubros" (
    "Id" SERIAL PRIMARY KEY,
    "Nombre" VARCHAR(200) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- GH_TiposServicio (Activity Types)
CREATE TABLE IF NOT EXISTS "GH_TiposServicio" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL,
    "Nombre" VARCHAR(200) NOT NULL,
    "PresupuestoMensual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "FK_GH_TiposServicio_Rubro" FOREIGN KEY ("RubroId") REFERENCES "GH_Rubros"("Id")
);

-- GH_Proveedores (Suppliers with extended info)
CREATE TABLE IF NOT EXISTS "GH_Proveedores" (
    "Id" SERIAL PRIMARY KEY,
    "TipoServicioId" INTEGER NOT NULL,
    "Nombre" VARCHAR(200) NOT NULL,
    "Telefono" VARCHAR(20),
    "Correo" VARCHAR(100),
    "Direccion" VARCHAR(300),
    "NIT" VARCHAR(20),
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "FK_GH_Proveedores_TipoServicio" FOREIGN KEY ("TipoServicioId") REFERENCES "GH_TiposServicio"("Id")
);

-- GH_Cotizaciones (Quotations for price comparison)
CREATE TABLE IF NOT EXISTS "GH_Cotizaciones" (
    "Id" SERIAL PRIMARY KEY,
    "ProveedorId" INTEGER NOT NULL,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "PrecioCotizado" DECIMAL(18,2) NOT NULL,
    "FechaCotizacion" TIMESTAMP NOT NULL,
    "Descripcion" VARCHAR(500),
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "FK_GH_Cotizaciones_Proveedor" FOREIGN KEY ("ProveedorId") REFERENCES "GH_Proveedores"("Id")
);

-- GH_GastosMensuales (Monthly Expenses)
CREATE TABLE IF NOT EXISTS "GH_GastosMensuales" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL,
    "TipoServicioId" INTEGER NOT NULL,
    "ProveedorId" INTEGER NOT NULL,
    "CotizacionId" INTEGER,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "NumeroFactura" VARCHAR(100),
    "Precio" DECIMAL(18,2) NOT NULL,
    "FechaCompra" TIMESTAMP NOT NULL,
    "Nota" TEXT,
    "ArchivoFactura" TEXT,
    "ArchivoFacturaNombre" VARCHAR(500),
    CONSTRAINT "FK_GH_GastosMensuales_Rubro" FOREIGN KEY ("RubroId") REFERENCES "GH_Rubros"("Id"),
    CONSTRAINT "FK_GH_GastosMensuales_TipoServicio" FOREIGN KEY ("TipoServicioId") REFERENCES "GH_TiposServicio"("Id"),
    CONSTRAINT "FK_GH_GastosMensuales_Proveedor" FOREIGN KEY ("ProveedorId") REFERENCES "GH_Proveedores"("Id"),
    CONSTRAINT "FK_GH_GastosMensuales_Cotizacion" FOREIGN KEY ("CotizacionId") REFERENCES "GH_Cotizaciones"("Id")
);

-- Seed initial Rubros (12 categories)
INSERT INTO "GH_Rubros" ("Nombre", "Activo")
SELECT * FROM (VALUES
    ('Compradores de Desperdicio', TRUE),
    ('Servicios Publicos', TRUE),
    ('Seguridad', TRUE),
    ('GPS', TRUE),
    ('Cafeteria', TRUE),
    ('Papeleria', TRUE),
    ('Mantenimiento', TRUE),
    ('Dotacion', TRUE),
    ('Aseo', TRUE),
    ('Cable', TRUE),
    ('Telefonia', TRUE),
    ('Ayuda Emocional', TRUE)
) AS v(nombre, activo)
WHERE NOT EXISTS (SELECT 1 FROM "GH_Rubros" LIMIT 1);

-- Seed TiposServicio (20 types, only if not exists)
INSERT INTO "GH_TiposServicio" ("RubroId", "Nombre", "PresupuestoMensual", "Activo")
SELECT r."Id", v.nombre, v.presupuesto, v.activo
FROM (VALUES
    ('Compradores de Desperdicio', 'Desperdicio', 0, TRUE),
    ('Servicios Publicos', 'Agua', 0, TRUE),
    ('Servicios Publicos', 'Luz', 0, TRUE),
    ('Servicios Publicos', 'Alcantarillado', 0, TRUE),
    ('Servicios Publicos', 'Aseo Municipal', 0, TRUE),
    ('Seguridad', 'Vigilancia', 0, TRUE),
    ('GPS', 'GPS Vehiculos', 0, TRUE),
    ('Cafeteria', 'Insumos Cafeteria', 0, TRUE),
    ('Papeleria', 'Insumos Oficina', 0, TRUE),
    ('Papeleria', 'Impresoras', 0, TRUE),
    ('Mantenimiento', 'Aire Acondicionado', 0, TRUE),
    ('Mantenimiento', 'Plomeria', 0, TRUE),
    ('Mantenimiento', 'Redes', 0, TRUE),
    ('Mantenimiento', 'Arreglos Varios', 0, TRUE),
    ('Dotacion', 'Uniforme', 0, TRUE),
    ('Aseo', 'Insumos Aseo', 0, TRUE),
    ('Cable', 'Internet 1', 0, TRUE),
    ('Cable', 'Internet 2', 0, TRUE),
    ('Telefonia', 'Telefonia Fija', 0, TRUE),
    ('Ayuda Emocional', 'Insumos Michi', 0, TRUE)
) AS v(rubro_nombre, nombre, presupuesto, activo)
JOIN "GH_Rubros" r ON r."Nombre" = v.rubro_nombre
WHERE NOT EXISTS (SELECT 1 FROM "GH_TiposServicio" LIMIT 1);

-- Create indexes
CREATE INDEX IF NOT EXISTS "IX_GH_TiposServicio_RubroId" ON "GH_TiposServicio" ("RubroId");
CREATE INDEX IF NOT EXISTS "IX_GH_Proveedores_TipoServicioId" ON "GH_Proveedores" ("TipoServicioId");
CREATE INDEX IF NOT EXISTS "IX_GH_Cotizaciones_ProveedorId" ON "GH_Cotizaciones" ("ProveedorId");
CREATE INDEX IF NOT EXISTS "IX_GH_GastosMensuales_RubroId" ON "GH_GastosMensuales" ("RubroId");
CREATE INDEX IF NOT EXISTS "IX_GH_GastosMensuales_TipoServicioId" ON "GH_GastosMensuales" ("TipoServicioId");
CREATE INDEX IF NOT EXISTS "IX_GH_GastosMensuales_ProveedorId" ON "GH_GastosMensuales" ("ProveedorId");
