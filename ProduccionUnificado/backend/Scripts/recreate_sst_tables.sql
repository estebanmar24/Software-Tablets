-- Drop and recreate SST tables with clean data
DROP TABLE IF EXISTS "SST_GastosMensuales" CASCADE;
DROP TABLE IF EXISTS "SST_PresupuestosMensuales" CASCADE;
DROP TABLE IF EXISTS "SST_Proveedores" CASCADE;
DROP TABLE IF EXISTS "SST_TiposServicio" CASCADE;
DROP TABLE IF EXISTS "SST_Rubros" CASCADE;

-- SST_Rubros
CREATE TABLE "SST_Rubros" (
    "Id" SERIAL PRIMARY KEY,
    "Nombre" VARCHAR(200) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_TiposServicio
CREATE TABLE "SST_TiposServicio" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL REFERENCES "SST_Rubros"("Id") ON DELETE RESTRICT,
    "Nombre" VARCHAR(300) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_Proveedores
CREATE TABLE "SST_Proveedores" (
    "Id" SERIAL PRIMARY KEY,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "Nombre" VARCHAR(200) NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE
);

-- SST_PresupuestosMensuales
CREATE TABLE "SST_PresupuestosMensuales" (
    "Id" SERIAL PRIMARY KEY,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "Presupuesto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT "UQ_SST_Presupuesto_TipoServicio_AnioMes" UNIQUE ("TipoServicioId", "Anio", "Mes")
);

-- SST_GastosMensuales
CREATE TABLE "SST_GastosMensuales" (
    "Id" SERIAL PRIMARY KEY,
    "RubroId" INTEGER NOT NULL REFERENCES "SST_Rubros"("Id") ON DELETE RESTRICT,
    "TipoServicioId" INTEGER NOT NULL REFERENCES "SST_TiposServicio"("Id") ON DELETE RESTRICT,
    "ProveedorId" INTEGER NOT NULL REFERENCES "SST_Proveedores"("Id") ON DELETE RESTRICT,
    "Anio" INTEGER NOT NULL,
    "Mes" INTEGER NOT NULL CHECK ("Mes" >= 1 AND "Mes" <= 12),
    "NumeroFactura" VARCHAR(100) NOT NULL,
    "Precio" DECIMAL(18,2) NOT NULL,
    "FechaCompra" DATE NOT NULL,
    "Nota" VARCHAR(500),
    "ArchivoFactura" TEXT
);

-- Create indexes
CREATE INDEX "IX_SST_TiposServicio_RubroId" ON "SST_TiposServicio"("RubroId");
CREATE INDEX "IX_SST_Proveedores_TipoServicioId" ON "SST_Proveedores"("TipoServicioId");
CREATE INDEX "IX_SST_PresupuestosMensuales_AnioMes" ON "SST_PresupuestosMensuales"("Anio", "Mes");
CREATE INDEX "IX_SST_GastosMensuales_AnioMes" ON "SST_GastosMensuales"("Anio", "Mes");

-- Insert Rubros
INSERT INTO "SST_Rubros" ("Nombre") VALUES 
    ('Medicina Preventiva, Del Trabajo Y otros'),
    ('Capacitacion-Asesorias-Auditorias'),
    ('Higiene Industrial Y manejo ambiental'),
    ('Infraestructura Y aseguramiento de la operacion'),
    ('Seguridad Industrial'),
    ('Otros');

-- Insert TiposServicio
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    -- Rubro 1: Medicina Preventiva
    (1, 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento)'),
    -- Rubro 2: Capacitacion
    (2, 'Honorarios Asesor Externo SST'),
    (2, 'Auxiliar de SST'),
    (2, 'Brigada de emergencias (Dotacion y Capacitacion)'),
    (2, 'Comite de convivencia laboral (Recurso ARL)'),
    (2, 'Comite paritario de seguridad y salud en el trabajo'),
    (2, 'Plan de Capacitaciones y refrigerios'),
    (2, 'Actividad PyP - Semana de la salud'),
    (2, 'Auditoria Sistema de gestion de seguridad y salud'),
    -- Rubro 3: Higiene Industrial
    (3, 'Control de plagas'),
    (3, 'Puntos Ecologicos'),
    (3, 'Recoleccion De residuos Peligrosos'),
    (3, 'Mediciones Ambientales'),
    -- Rubro 5: Seguridad Industrial
    (5, 'Elementos de Proteccion Personal (EPP)'),
    (5, 'Dotacion de calzado (EPP)'),
    (5, 'Compra y mantenimiento de extintores'),
    (5, 'Recarga y suministro de Botiquines'),
    (5, 'Certificacion de bomberos'),
    (5, 'Inspecciones y adecuacion de puestos de trabajo'),
    (5, 'Kit control de derrames - Multiproposito'),
    (5, 'Compra de equipos de emergencia');

-- Insert Proveedores
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (1, 'CEMDIL'),
    (10, 'Pest cleanning'),
    (14, 'Hernando Orozco'),
    (14, 'Encirso'),
    (15, 'Hernando Orozco'),
    (15, 'Encirso');
