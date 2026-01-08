-- Clean up duplicate data
DELETE FROM "SST_GastosMensuales";
DELETE FROM "SST_PresupuestosMensuales";
DELETE FROM "SST_Proveedores";
DELETE FROM "SST_TiposServicio";
DELETE FROM "SST_Rubros";

-- Re-insert clean data with proper encoding
INSERT INTO "SST_Rubros" ("Nombre") VALUES 
    ('Medicina Preventiva, Del Trabajo Y otros'),
    ('Capacitacion-Asesorias-Auditorias'),
    ('Higiene Industrial Y manejo ambiental'),
    ('Infraestructura Y aseguramiento de la operacion'),
    ('Seguridad Industrial'),
    ('Otros');

-- Insert TiposServicio
-- Rubro 1: Medicina Preventiva
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (1, 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento)');

-- Rubro 3: Higiene Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (3, 'Control de plagas'),
    (3, 'Puntos Ecologicos'),
    (3, 'Recoleccion De residuos Peligrosos'),
    (3, 'Mediciones Ambientales');

-- Rubro 5: Seguridad Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (5, 'Elementos de Proteccion Personal (EPP)'),
    (5, 'Dotacion de calzado (EPP)'),
    (5, 'Compra y mantenimiento de extintores'),
    (5, 'Recarga y suministro de Botiquines'),
    (5, 'Certificacion de bomberos'),
    (5, 'Inspecciones y adecuacion de puestos de trabajo'),
    (5, 'Kit control de derrames - Multiproposito'),
    (5, 'Compra de equipos de emergencia');

-- Rubro 2: Capacitacion
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (2, 'Honorarios Asesor Externo SST'),
    (2, 'Auxiliar de SST'),
    (2, 'Brigada de emergencias (Dotacion y Capacitacion)'),
    (2, 'Comite de convivencia laboral (Recurso ARL)'),
    (2, 'Comite paritario de seguridad y salud en el trabajo'),
    (2, 'Plan de Capacitaciones y refrigerios'),
    (2, 'Actividad PyP - Semana de la salud'),
    (2, 'Auditoria Sistema de gestion de seguridad y salud');

-- Insert Proveedores
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (1, 'CEMDIL'),
    (2, 'Pest cleanning'),
    (6, 'Hernando Orozco'),
    (6, 'Encirso'),
    (7, 'Hernando Orozco'),
    (7, 'Encirso');
