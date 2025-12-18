-- =============================================
-- SCRIPT DE INSTALACIÓN PARA BD EN LA NUBE
-- Sistema de Producción y Bonificaciones - Alleph
-- Base de datos: db_ac0a9d_trabajo (site4now.net)
-- =============================================

-- =============================================
-- BORRAR TABLAS SI EXISTEN (Para empezar limpio)
-- =============================================
IF OBJECT_ID('TiempoProcesos', 'U') IS NOT NULL DROP TABLE TiempoProcesos;
IF OBJECT_ID('ProduccionDiaria', 'U') IS NOT NULL DROP TABLE ProduccionDiaria;
IF OBJECT_ID('OrdenesProduccion', 'U') IS NOT NULL DROP TABLE OrdenesProduccion;
IF OBJECT_ID('Actividades', 'U') IS NOT NULL DROP TABLE Actividades;
IF OBJECT_ID('Maquinas', 'U') IS NOT NULL DROP TABLE Maquinas;
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;

-- =============================================
-- 1. TABLA USUARIOS (Operarios)
-- =============================================
CREATE TABLE Usuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL,
    Estado BIT DEFAULT 1,
    FechaCreacion DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 2. TABLA MAQUINAS (Parámetros)
-- =============================================
CREATE TABLE Maquinas (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL UNIQUE,
    MetaRendimiento INT NOT NULL,
    MetaDesperdicio DECIMAL(5,4) NOT NULL,
    ValorPorTiro DECIMAL(10,2) NOT NULL,
    TirosReferencia INT NOT NULL,
    SemaforoMin INT NOT NULL,
    SemaforoNormal INT NOT NULL,
    SemaforoMax INT NOT NULL,
    Activa BIT DEFAULT 1
);

-- =============================================
-- 3. TABLA ACTIVIDADES
-- =============================================
CREATE TABLE Actividades (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Codigo NVARCHAR(10) NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    EsProductiva BIT NOT NULL DEFAULT 0,
    Orden INT NOT NULL,
    Observaciones NVARCHAR(MAX) NULL
);

-- =============================================
-- 4. TABLA ORDENES PRODUCCION
-- =============================================
CREATE TABLE OrdenesProduccion (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Numero NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200) NOT NULL,
    Estado NVARCHAR(50) NOT NULL,
    FechaCreacion DATETIME DEFAULT GETDATE()
);

-- =============================================
-- 5. TABLA PRODUCCION DIARIA (Registros)
-- =============================================
CREATE TABLE ProduccionDiaria (
    Id BIGINT PRIMARY KEY IDENTITY(1,1),
    Fecha DATE NOT NULL,
    UsuarioId INT NOT NULL,
    MaquinaId INT NOT NULL,
    
    -- Tiempos
    HoraInicio TIME(0),
    HoraFin TIME(0),
    HorasOperativas DECIMAL(10,2) DEFAULT 0,
    
    -- Producción
    RendimientoFinal DECIMAL(10,2) DEFAULT 0,
    Cambios INT DEFAULT 0,
    TiempoPuestaPunto DECIMAL(10,2) DEFAULT 0,
    TirosDiarios INT DEFAULT 0,
    
    -- Cálculos Productivos
    TotalHorasProductivas DECIMAL(10,2) DEFAULT 0,
    PromedioHoraProductiva DECIMAL(10,2) DEFAULT 0,
    
    -- Económicos
    ValorTiroSnapshot DECIMAL(10,2) DEFAULT 0,
    ValorAPagar DECIMAL(10,2) DEFAULT 0,
    
    -- Auxiliares
    HorasMantenimiento DECIMAL(10,2) DEFAULT 0,
    HorasDescanso DECIMAL(10,2) DEFAULT 0,
    HorasOtrosAux DECIMAL(10,2) DEFAULT 0,
    TotalHorasAuxiliares DECIMAL(10,2) DEFAULT 0,
    
    -- Tiempos Muertos
    TiempoFaltaTrabajo DECIMAL(10,2) DEFAULT 0,
    TiempoReparacion DECIMAL(10,2) DEFAULT 0,
    TiempoOtroMuerto DECIMAL(10,2) DEFAULT 0,
    TotalTiemposMuertos DECIMAL(10,2) DEFAULT 0,
    
    -- TOTAL GLOBAL
    TotalHoras DECIMAL(10,2) DEFAULT 0,
    
    -- Extras
    ReferenciaOP NVARCHAR(50),
    Novedades NVARCHAR(MAX),
    Desperdicio DECIMAL(10,2) DEFAULT 0,
    DiaLaborado INT DEFAULT 1,
    
    CONSTRAINT FK_Produccion_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Produccion_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id)
);

-- =============================================
-- 6. TABLA TIEMPO PROCESOS (Cronómetro)
-- =============================================
CREATE TABLE TiempoProcesos (
    Id BIGINT PRIMARY KEY IDENTITY(1,1),
    Fecha DATETIME2 NOT NULL,
    HoraInicio DATETIME2 NOT NULL,
    HoraFin DATETIME2 NOT NULL,
    Duracion BIGINT NOT NULL,
    UsuarioId INT NOT NULL,
    MaquinaId INT NOT NULL,
    OrdenProduccionId INT NULL,
    ActividadId INT NOT NULL,
    Tiros INT NOT NULL DEFAULT 0,
    Desperdicio INT NOT NULL DEFAULT 0,
    Observaciones NVARCHAR(MAX) NULL,
    
    CONSTRAINT FK_TiempoProcesos_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_TiempoProcesos_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id),
    CONSTRAINT FK_TiempoProcesos_Orden FOREIGN KEY (OrdenProduccionId) REFERENCES OrdenesProduccion(Id),
    CONSTRAINT FK_TiempoProcesos_Actividad FOREIGN KEY (ActividadId) REFERENCES Actividades(Id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IX_Produccion_Fecha ON ProduccionDiaria(Fecha);
CREATE INDEX IX_Produccion_Usuario ON ProduccionDiaria(UsuarioId);
CREATE INDEX IX_Produccion_Maquina ON ProduccionDiaria(MaquinaId);
CREATE INDEX IX_TiempoProcesos_Actividad ON TiempoProcesos(ActividadId);
CREATE INDEX IX_TiempoProcesos_Usuario ON TiempoProcesos(UsuarioId);

-- =============================================
-- DATOS INICIALES - OPERARIOS REALES
-- =============================================
INSERT INTO Usuarios (Nombre, Estado) VALUES 
('Blandon Moreno Jose Lizandro', 1),
('Cruz Pinto Alberto', 1),
('Enrique Muñoz Hector Hilde', 1),
('Escobar Cardona John Fredy', 1),
('Martinez Osorno Karen Lizeth', 1),
('Millan Salazar Magaly', 1),
('Moreno Mendez Angel Julio', 1),
('Moreno Urrea Marlene', 1),
('Motta Talaga Leidy Jhoanna', 1),
('Obando Higuita Jose Luis', 1),
('Ramirez Romero Andres Mauricio', 1),
('Sarmiento Rincon Yhan Otoniel', 1),
('Velez Arana Robert De Jesus', 1),
('Perdomo Rincon Gustavo Adolfo', 1),
('Moriano Chiguas Yurde Arley', 1),
('Bedoya Maria Fernanda', 1),
('Morales Grueso Claudia Patricia', 1),
('Gomez Ruiz William Hernan', 1),
('Rodriguez Castaño Maria Alejandra', 1),
('Rojas Collazos Joan Mauricio', 1),
('Riascos Castillo Andres Felipe', 1),
('Roldan Barona Erik Esteban', 1),
('Renteria Mejia Nestor Alfonso', 1),
('Mina Sinisterra Jhon Jairo', 1),
('Valencia Mirquez Nicol', 1),
('Uran Quintero Yohao Alexander', 1),
('Preciado Rivas Johan Alexander', 1),
('Jose Fernando Ruiz', 1);

-- =============================================
-- DATOS INICIALES - MÁQUINAS REALES
-- =============================================
INSERT INTO Maquinas (Nombre, MetaRendimiento, MetaDesperdicio, ValorPorTiro, TirosReferencia, SemaforoMin, SemaforoNormal, SemaforoMax, Activa) VALUES
('CONVERTIDORA 1A', 15000, 0.25, 5, 1250, 0, 0, 0, 1),
('CONVERTIDORA 1B', 15000, 0.25, 5, 1250, 0, 0, 0, 1),
('Guillotina 2A polar132', 30000, 0.25, 2, 1250, 0, 0, 0, 1),
('Guillotina 2B org- Perfecta 107', 30000, 0.25, 2, 1250, 0, 0, 0, 1),
('3 Sord Z', 15000, 0.25, 5, 1250, 0, 0, 0, 1),
('4 Sord Z', 15000, 0.25, 5, 2000, 0, 0, 0, 1),
('5 Sord Z', 15000, 0.25, 5, 1250, 0, 0, 0, 1),
('6 SpeedMaster', 15000, 0.25, 5, 3000, 0, 0, 0, 1),
('7 SpeedMaster', 22500, 0.25, 5, 3000, 0, 0, 0, 1),
('8A Troqueladora de Papel', 7500, 0.25, 10, 1000, 0, 0, 0, 1),
('8B Troqueladora de Papel', 7500, 0.25, 10, 1000, 0, 0, 0, 1),
('8C Estampadora', 6000, 0.25, 12, 1500, 0, 0, 0, 1),
('9 Troqueladora Rollo', 15000, 0.25, 5, 1250, 0, 0, 0, 1),
('10A Colaminadora Carton', 7500, 0.07, 10, 500, 0, 0, 0, 1),
('10B Colaminadora Carton', 6000, 0.03, 12, 400, 0, 0, 0, 1),
('11 Laminadora BOPP', 7500, 0.25, 10, 1000, 0, 0, 0, 1),
('16 Barnizadora UV', 7500, 0.25, 10, 1250, 0, 0, 0, 1),
('13A Corrugadora FLTE', 2250, 0.25, 40, 2000, 0, 0, 0, 1),
('13b Corrugadora FLTB', 2250, 0.25, 35, 1250, 0, 0, 0, 1),
('14 Pegadora de Cajas', 75000, 0.07, 1, 40000, 0, 0, 0, 1),
('15 Troqueladora Kirby', 1500, 0.25, 40, 1250, 0, 0, 0, 1),
('12 Maquina de Cordon', 2100, 0.25, 10, 2000, 0, 0, 0, 1),
('12 Cortadora de Manijas', 9000, 0.25, 5, 2000, 0, 0, 0, 1);

-- =============================================
-- DATOS INICIALES - ACTIVIDADES
-- =============================================
INSERT INTO Actividades (Codigo, Nombre, EsProductiva, Orden, Observaciones) VALUES
('01', 'Puesta a Punto', 0, 1, 'Preparación inicial de la máquina'),
('02', 'Producción', 1, 2, 'Tiempo productivo de operación'),
('03', 'Reparación', 0, 3, 'Reparación de fallas o averías'),
('04', 'Descanso', 0, 4, 'Tiempo de descanso programado'),
('08', 'Otro Tiempo Muerto', 0, 5, 'Falta de Material, Imprevistos'),
('10', 'Mantenimiento y Aseo', 0, 6, 'Mantenimiento preventivo'),
('13', 'Falta de Trabajo', 0, 7, 'Sin órdenes asignadas'),
('14', 'Otros tiempos', 0, 8, 'Calibración, cambios, reunion');

-- =============================================
-- DATOS INICIALES - ORDENES PRODUCCION
-- =============================================
INSERT INTO OrdenesProduccion (Numero, Descripcion, Estado) VALUES
('OP-2024-001', 'Producción General', 'EnProceso');

-- =============================================
-- TABLA TiempoProcesos - SE DEJA VACÍA
-- =============================================
-- (No se insertan datos, el cronómetro los llenará)

-- =============================================
-- CONFIRMACIÓN
-- =============================================
PRINT '¡Tablas creadas correctamente en la nube!';
PRINT 'Usuarios: 28';
PRINT 'Máquinas: 23';
PRINT 'Actividades: 8';
PRINT 'OrdenesProduccion: 1';
PRINT 'TiempoProcesos: vacía (se llena desde el cronómetro)';
