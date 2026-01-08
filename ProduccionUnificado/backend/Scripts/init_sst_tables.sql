-- SST Budget and Expense Management Tables
-- Run this script to create the SST tables in PostgreSQL

-- SST_Rubros: Categories for SST expenses
CREATE TABLE IF NOT EXISTS "SST_Rubros" (
    "Id" SERIAL PRIMARY KEY,
    "Nombre" VARCHAR(200) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_TiposServicio: Service types linked to Rubros
CREATE TABLE IF NOT EXISTS "SST_TiposServicio" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL REFERENCES "SST_Rubros"("Id") ON DELETE RESTRICT,
    "Nombre" VARCHAR(300) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_Proveedores: Suppliers linked to TiposServicio
CREATE TABLE IF NOT EXISTS "SST_Proveedores" (
    "Id" SERIAL PRIMARY KEY,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "Nombre" VARCHAR(200) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_PresupuestosMensuales: Monthly budget caps per TipoServicio (set by Admin)
CREATE TABLE IF NOT EXISTS "SST_PresupuestosMensuales" (
    "Id" SERIAL PRIMARY KEY,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "Presupuesto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT "UQ_SST_Presupuesto_TipoServicio_AñoMes" UNIQUE ("TipoServicioId", "Anio", "Mes")
);

-- SST_GastosMensuales: Monthly expense records (entered by SST personnel)
CREATE TABLE IF NOT EXISTS "SST_GastosMensuales" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL REFERENCES "SST_Rubros"("Id") ON DELETE RESTRICT,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "ProveedorId" INTEGER NOT NULL REFERENCES "SST_Proveedores"("Id") ON DELETE RESTRICT,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "NumeroFactura" VARCHAR(100),
    "Precio" DECIMAL(18,2) NOT NULL,
    "FechaCompra" DATE NOT NULL,
    "Nota" VARCHAR(500)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IX_SST_TiposServicio_RubroId" ON "SST_TiposServicio"("RubroId");
CREATE INDEX IF NOT EXISTS "IX_SST_Proveedores_TipoServicioId" ON "SST_Proveedores"("TipoServicioId");
CREATE INDEX IF NOT EXISTS "IX_SST_PresupuestosMensuales_AnioMes" ON "SST_PresupuestosMensuales"("Anio", "Mes");
CREATE INDEX IF NOT EXISTS "IX_SST_GastosMensuales_AnioMes" ON "SST_GastosMensuales"("Anio", "Mes");

-- =====================================================
-- SAMPLE DATA (Optional - uncomment to insert test data)
-- =====================================================

-- Insert sample Rubros
INSERT INTO "SST_Rubros" ("Nombre") VALUES 
    ('Medicina Preventiva, Del Trabajo Y otros'),
    ('Capacitación-Asesorías-Auditorías'),
    ('Higiene Industrial Y manejo ambiental'),
    ('Infraestructura Y aseguramiento de la operación'),
    ('Seguridad Industrial'),
    ('Otros')
ON CONFLICT DO NOTHING;

-- Insert sample TiposServicio
-- Note: RubroId values depend on the order of insertion above
-- Rubro 1: Medicina Preventiva
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (1, 'Exámenes Médicos (Ingreso, Periódicos, Egreso, Post Incapacidad, o de Seguimiento)')
ON CONFLICT DO NOTHING;

-- Rubro 3: Higiene Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (3, 'Control de plagas'),
    (3, 'Puntos Ecológicos'),
    (3, 'Recolección De residuos Peligrosos'),
    (3, 'Mediciones Ambientales')
ON CONFLICT DO NOTHING;

-- Rubro 5: Seguridad Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (5, 'Elementos de Protección Personal (EPP)'),
    (5, 'Dotación de calzado (EPP)'),
    (5, 'Compra y mantenimiento de extintores'),
    (5, 'Recarga y suministro de Botiquines'),
    (5, 'Certificación de bomberos'),
    (5, 'Inspecciones y adecuación de puestos de trabajo administrativos y operativos'),
    (5, 'Kit control de derrames - Multipropósito'),
    (5, 'Compra de equipos de emergencia')
ON CONFLICT DO NOTHING;

-- Rubro 2: Capacitación
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (2, 'Honorarios Asesor Externo SST'),
    (2, 'Auxiliar de SST'),
    (2, 'Brigada de emergencias (Dotación y Capacitación)'),
    (2, 'Comité de convivencia laboral (Recurso ARL)'),
    (2, 'Comité paritario de seguridad y salud en el trabajo (COPASST recurso ARL)'),
    (2, 'Plan de Capacitaciones y refrigerios'),
    (2, 'Actividad PyP - Semana de la salud'),
    (2, 'Auditoría Sistema de gestión de seguridad y salud en el trabajo')
ON CONFLICT DO NOTHING;

COMMIT;
