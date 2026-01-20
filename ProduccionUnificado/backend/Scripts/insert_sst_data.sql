-- Insert sample Rubros
INSERT INTO "SST_Rubros" ("Nombre") VALUES 
    ('Medicina Preventiva, Del Trabajo Y otros'),
    ('Capacitación-Asesorías-Auditorías'),
    ('Higiene Industrial Y manejo ambiental'),
    ('Infraestructura Y aseguramiento de la operación'),
    ('Seguridad Industrial'),
    ('Otros');

-- Insert sample TiposServicio
-- Rubro 1: Medicina Preventiva
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (1, 'Exámenes Médicos (Ingreso, Periódicos, Egreso, Post Incapacidad, o de Seguimiento)');

-- Rubro 3: Higiene Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (3, 'Control de plagas'),
    (3, 'Puntos Ecológicos'),
    (3, 'Recolección De residuos Peligrosos'),
    (3, 'Mediciones Ambientales');

-- Rubro 5: Seguridad Industrial
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (5, 'Elementos de Protección Personal (EPP)'),
    (5, 'Dotación de calzado (EPP)'),
    (5, 'Compra y mantenimiento de extintores'),
    (5, 'Recarga y suministro de Botiquines'),
    (5, 'Certificación de bomberos'),
    (5, 'Inspecciones y adecuación de puestos de trabajo administrativos y operativos'),
    (5, 'Kit control de derrames - Multipropósito'),
    (5, 'Compra de equipos de emergencia');

-- Rubro 2: Capacitación
INSERT INTO "SST_TiposServicio" ("RubroId", "Nombre") VALUES
    (2, 'Honorarios Asesor Externo SST'),
    (2, 'Auxiliar de SST'),
    (2, 'Brigada de emergencias (Dotación y Capacitación)'),
    (2, 'Comité de convivencia laboral (Recurso ARL)'),
    (2, 'Comité paritario de seguridad y salud en el trabajo (COPASST recurso ARL)'),
    (2, 'Plan de Capacitaciones y refrigerios'),
    (2, 'Actividad PyP - Semana de la salud'),
    (2, 'Auditoría Sistema de gestión de seguridad y salud en el trabajo');

-- Insert sample Proveedores
-- For Exámenes Médicos
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (1, 'CEMDIL');

-- For Control de plagas
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (2, 'Pest cleanning');

-- For EPP
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (6, 'Hernando Orozco'),
    (6, 'Encirso');

-- For Dotación de calzado
INSERT INTO "SST_Proveedores" ("TipoServicioId", "Nombre") VALUES
    (7, 'Hernando Orozco'),
    (7, 'Encirso');
