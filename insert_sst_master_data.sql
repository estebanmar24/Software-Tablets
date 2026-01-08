-- ===========================================
-- SST Master Data Insert Script - PostgreSQL
-- ===========================================
-- Ejecutar con: psql -h localhost -U postgres -d TiemposProcesos -f insert_sst_master_data.sql
-- ===========================================

-- ===========================================
-- 1. INSERTAR RUBROS
-- ===========================================

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Medicina Preventiva, Del Trabajo Y otros', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Medicina Preventiva, Del Trabajo Y otros');

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Capacitacion-Asesorias-Auditorias', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias');

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Higiene Industrial Y manejo ambiental', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Higiene Industrial Y manejo ambiental');

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Infraestructura Y aseguramiento de la operación', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Infraestructura Y aseguramiento de la operación');

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Seguridad Industrial', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial');

INSERT INTO "SST_Rubros" ("Nombre", "Activo") 
SELECT 'Otros', true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Rubros" WHERE "Nombre" = 'Otros');

-- ===========================================
-- 2. INSERTAR TIPOS DE SERVICIO
-- ===========================================

-- Medicina Preventiva, Del Trabajo Y otros
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Medicina Preventiva, Del Trabajo Y otros'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento');

-- Higiene Industrial Y manejo ambiental
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Control de plagas', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Higiene Industrial Y manejo ambiental'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Control de plagas');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Puntos Ecologicos', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Higiene Industrial Y manejo ambiental'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Puntos Ecologicos');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Recoleccion De residuos Peligrosos', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Higiene Industrial Y manejo ambiental'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Recoleccion De residuos Peligrosos');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Mediciones Ambientales', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Higiene Industrial Y manejo ambiental'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Mediciones Ambientales');

-- Seguridad Industrial
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Elementos de Proteccion Personal (EPP)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Elementos de Proteccion Personal (EPP)');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Dotacion de calzado (EPP)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Dotacion de calzado (EPP)');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Compra y mantenimiento de extintores', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra y mantenimiento de extintores');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Recarga y suministro de Botiquines', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Recarga y suministro de Botiquines');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Certificacion de bomberos', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Certificacion de bomberos');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Inspecciones y adecuacion de puestos de trabajo administrativos y operativos', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Inspecciones y adecuacion de puestos de trabajo administrativos y operativos');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Kit control de derrames - Multiproposito', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Kit control de derrames - Multiproposito');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Compra de equipos de emergencia', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Seguridad Industrial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra de equipos de emergencia');

-- Capacitacion-Asesorias-Auditorias
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Honorarios Asesor Externo SST', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Honorarios Asesor Externo SST');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Auxiliar de SST', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Auxiliar de SST');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Brigada de emergencias (Dotacion y Capacitacion)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Brigada de emergencias (Dotacion y Capacitacion)');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Comité de convivencia laboral (Recurso ARL)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Comité de convivencia laboral (Recurso ARL)');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Comité paritario de seguridad y salud en el trabajo (COPASST recurso ARL)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Comité paritario de seguridad y salud en el trabajo (COPASST recurso ARL)');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Plan de Capacitaciones y refigerios', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Plan de Capacitaciones y refigerios');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Actividad PyP - Semana de la salud', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Actividad PyP - Semana de la salud');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Auditoria Sistema de gestion de seguridad y salud en el trabajo', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Capacitacion-Asesorias-Auditorias'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Auditoria Sistema de gestion de seguridad y salud en el trabajo');

-- Infraestructura Y aseguramiento de la operación
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Señalizacion y demarcacion', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Infraestructura Y aseguramiento de la operación'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Señalizacion y demarcacion');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Arreglos locativos (Para riesgo Mecanico, locativo)', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Infraestructura Y aseguramiento de la operación'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Arreglos locativos (Para riesgo Mecanico, locativo)');

-- Otros
INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Afiches, Carteleras, avisos, medios de comunicación', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Otros'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Afiches, Carteleras, avisos, medios de comunicación');

INSERT INTO "SST_TiposServicio" ("Nombre", "RubroId", "Activo")
SELECT 'Aplicación de la bateria del riesgo psicosocial', 
       (SELECT "Id" FROM "SST_Rubros" WHERE "Nombre" = 'Otros'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_TiposServicio" WHERE "Nombre" = 'Aplicación de la bateria del riesgo psicosocial');

-- ===========================================
-- 3. INSERTAR PROVEEDORES
-- ===========================================

-- Examenes Medicos -> CEMDIL
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'CEMDIL', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'CEMDIL' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Examenes Medicos (Ingreso, Periodicos, Egreso, Post Incapacidad, o de Seguimiento'));

-- Control de plagas -> Pest cleanning
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Pest cleanning', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Control de plagas'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Pest cleanning' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Control de plagas'));

-- Recoleccion De residuos Peligrosos -> Combustibles Juanchito
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Combustibles Juanchito', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Recoleccion De residuos Peligrosos'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Combustibles Juanchito' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Recoleccion De residuos Peligrosos'));

-- Mediciones Ambientales -> Vladimir Ramirez
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Vladimir Ramirez', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Mediciones Ambientales'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Vladimir Ramirez' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Mediciones Ambientales'));

-- EPP -> Hernando Orozco, Encirso
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Hernando Orozco', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Elementos de Proteccion Personal (EPP)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Hernando Orozco' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Elementos de Proteccion Personal (EPP)'));

INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Encirso', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Elementos de Proteccion Personal (EPP)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Encirso' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Elementos de Proteccion Personal (EPP)'));

-- Dotacion de calzado -> Hernando Orozco, Encirso
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Hernando Orozco', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Dotacion de calzado (EPP)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Hernando Orozco' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Dotacion de calzado (EPP)'));

INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Encirso', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Dotacion de calzado (EPP)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Encirso' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Dotacion de calzado (EPP)'));

-- Extintores -> Fire Finish
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Fire Finish', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra y mantenimiento de extintores'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Fire Finish' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra y mantenimiento de extintores'));

-- Botiquines -> Fire Finish
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Fire Finish', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Recarga y suministro de Botiquines'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Fire Finish' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Recarga y suministro de Botiquines'));

-- Bomberos -> Bomberos Cali
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Bomberos Cali', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Certificacion de bomberos'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Bomberos Cali' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Certificacion de bomberos'));

-- Kit derrames -> Encirso
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Encirso', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Kit control de derrames - Multiproposito'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Encirso' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Kit control de derrames - Multiproposito'));

-- Equipos de emergencia -> Ecolite SAS
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Ecolite SAS', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra de equipos de emergencia'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Ecolite SAS' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Compra de equipos de emergencia'));

-- Asesor Externo SST -> Lionard Grizales
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Lionard Grizales', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Honorarios Asesor Externo SST'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Lionard Grizales' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Honorarios Asesor Externo SST'));

-- Auxiliar de SST -> Tatiana
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Tatiana', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Auxiliar de SST'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Tatiana' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Auxiliar de SST'));

-- Brigada de emergencias -> Fire Finish
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Fire Finish', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Brigada de emergencias (Dotacion y Capacitacion)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Fire Finish' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Brigada de emergencias (Dotacion y Capacitacion)'));

-- Plan de Capacitaciones -> Kuti, Cañaveral
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Kuti', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Plan de Capacitaciones y refigerios'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Kuti' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Plan de Capacitaciones y refigerios'));

INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Cañaveral', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Plan de Capacitaciones y refigerios'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Cañaveral' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Plan de Capacitaciones y refigerios'));

-- Señalizacion y demarcacion -> Segurita, Tecnipinturas ACC
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Segurita', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Señalizacion y demarcacion'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Segurita' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Señalizacion y demarcacion'));

INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Tecnipinturas ACC', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Señalizacion y demarcacion'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Tecnipinturas ACC' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Señalizacion y demarcacion'));

-- Arreglos locativos -> FerroLopez, Comercio Electrico
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'FerroLopez', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Arreglos locativos (Para riesgo Mecanico, locativo)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'FerroLopez' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Arreglos locativos (Para riesgo Mecanico, locativo)'));

INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Comercio Electrico', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Arreglos locativos (Para riesgo Mecanico, locativo)'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Comercio Electrico' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Arreglos locativos (Para riesgo Mecanico, locativo)'));

-- Afiches, Carteleras -> Wallys
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Wallys', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Afiches, Carteleras, avisos, medios de comunicación'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Wallys' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Afiches, Carteleras, avisos, medios de comunicación'));

-- Bateria del riesgo psicosocial -> Lizeth Martinez
INSERT INTO "SST_Proveedores" ("Nombre", "TipoServicioId", "Activo")
SELECT 'Lizeth Martinez', 
       (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Aplicación de la bateria del riesgo psicosocial'), true
WHERE NOT EXISTS (SELECT 1 FROM "SST_Proveedores" WHERE "Nombre" = 'Lizeth Martinez' 
    AND "TipoServicioId" = (SELECT "Id" FROM "SST_TiposServicio" WHERE "Nombre" = 'Aplicación de la bateria del riesgo psicosocial'));

-- ===========================================
-- 4. VERIFICAR RESULTADOS
-- ===========================================
SELECT 'RUBROS' AS "Tabla", COUNT(*) AS "Total" FROM "SST_Rubros" WHERE "Activo" = true
UNION ALL
SELECT 'TIPOS DE SERVICIO', COUNT(*) FROM "SST_TiposServicio" WHERE "Activo" = true
UNION ALL
SELECT 'PROVEEDORES', COUNT(*) FROM "SST_Proveedores" WHERE "Activo" = true;
