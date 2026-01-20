-- =============================================
-- SCRIPT COMPLETO DE INSTALACIÓN DE BASE DE DATOS
-- Sistema de Producción y Bonificaciones - Aleph Impresores
-- Fecha: 2025-12-22
-- Este script incluye TODOS los cambios y nuevas tablas
-- =============================================

-- =============================================
-- BORRAR TABLAS SI EXISTEN (Para empezar limpio)
-- Orden inverso por dependencias de FK
-- =============================================
IF OBJECT_ID('RendimientoOperariosMensual', 'U') IS NOT NULL DROP TABLE RendimientoOperariosMensual;
IF OBJECT_ID('CalificacionesMensuales', 'U') IS NOT NULL DROP TABLE CalificacionesMensuales;
IF OBJECT_ID('TiempoProcesos', 'U') IS NOT NULL DROP TABLE TiempoProcesos;
IF OBJECT_ID('ProduccionDiaria', 'U') IS NOT NULL DROP TABLE ProduccionDiaria;
IF OBJECT_ID('OrdenesProduccion', 'U') IS NOT NULL DROP TABLE OrdenesProduccion;
IF OBJECT_ID('Actividades', 'U') IS NOT NULL DROP TABLE Actividades;
IF OBJECT_ID('Maquinas', 'U') IS NOT NULL DROP TABLE Maquinas;
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;
GO

-- =============================================
-- 1. TABLA USUARIOS (Operarios)
-- =============================================
CREATE TABLE Usuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL,
    Estado BIT DEFAULT 1,
    FechaCreacion DATETIME DEFAULT GETDATE()
);
GO

-- =============================================
-- 2. TABLA MAQUINAS (Parámetros)
-- NOTA: Importancia es DECIMAL para distribución equitativa
-- Meta100Porciento es la meta al 100%, MetaRendimiento es 75%
-- =============================================
CREATE TABLE Maquinas (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL UNIQUE,
    MetaRendimiento INT NOT NULL,
    Meta100Porciento INT NOT NULL DEFAULT 0,
    MetaDesperdicio DECIMAL(5,4) NOT NULL,
    ValorPorTiro DECIMAL(10,2) NOT NULL,
    TirosReferencia INT NOT NULL,
    SemaforoMin INT NOT NULL DEFAULT 0,
    SemaforoNormal INT NOT NULL DEFAULT 0,
    SemaforoMax INT NOT NULL DEFAULT 0,
    Activa BIT DEFAULT 1,
    Importancia DECIMAL(5,2) NOT NULL DEFAULT 0
);
GO

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
GO

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
GO

-- =============================================
-- 5. TABLA PRODUCCION DIARIA (Registros)
-- Incluye campos para bonificación por horario laboral
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
    
    -- Campos para validación de horario laboral (bonificación)
    EsHorarioLaboral BIT DEFAULT 1,
    TirosBonificables INT DEFAULT 0,
    DesperdicioBonificable DECIMAL(10,2) DEFAULT 0,
    ValorAPagarBonificable DECIMAL(10,2) DEFAULT 0,
    
    CONSTRAINT FK_Produccion_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Produccion_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id)
);
GO

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
GO

-- =============================================
-- 7. TABLA CALIFICACIONES MENSUALES (Planta)
-- Para guardar la calificación total de la planta por mes
-- =============================================
CREATE TABLE CalificacionesMensuales (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Mes INT NOT NULL,
    Anio INT NOT NULL,
    CalificacionTotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    DesgloseMaquinas NVARCHAR(MAX) NULL,
    Notas NVARCHAR(MAX) NULL,
    FechaCalculo DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_CalificacionMensual_MesAnio UNIQUE (Mes, Anio)
);
GO

-- =============================================
-- 8. TABLA RENDIMIENTO OPERARIOS MENSUAL
-- Para historial de rendimiento por operario
-- =============================================
CREATE TABLE RendimientoOperariosMensual (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UsuarioId INT NOT NULL,
    Mes INT NOT NULL,
    Anio INT NOT NULL,
    RendimientoPromedio DECIMAL(10, 2) NOT NULL DEFAULT 0,
    TotalTiros INT NOT NULL DEFAULT 0,
    TotalMaquinas INT NOT NULL DEFAULT 0,
    FechaCalculo DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_RendimientoOperariosMensual_UsuarioMesAnio UNIQUE (UsuarioId, Mes, Anio),
    CONSTRAINT FK_RendimientoOperariosMensual_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);
GO

-- =============================================
-- ÍNDICES para búsquedas rápidas
-- =============================================
CREATE INDEX IX_Produccion_Fecha ON ProduccionDiaria(Fecha);
CREATE INDEX IX_Produccion_Usuario ON ProduccionDiaria(UsuarioId);
CREATE INDEX IX_Produccion_Maquina ON ProduccionDiaria(MaquinaId);
CREATE INDEX IX_TiempoProcesos_Actividad ON TiempoProcesos(ActividadId);
CREATE INDEX IX_TiempoProcesos_Usuario ON TiempoProcesos(UsuarioId);
CREATE INDEX IX_CalificacionesMensuales_MesAnio ON CalificacionesMensuales(Anio DESC, Mes DESC);
CREATE INDEX IX_RendimientoOperariosMensual_Usuario ON RendimientoOperariosMensual(UsuarioId, Anio DESC, Mes DESC);
GO

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
GO

-- =============================================
-- DATOS INICIALES - MÁQUINAS REALES (23 máquinas)
-- Meta100Porciento = Meta al 100%, MetaRendimiento = 75% de esa meta
-- Importancia se distribuye equitativamente (4.35% cada una)
-- =============================================
INSERT INTO Maquinas (Nombre, MetaRendimiento, Meta100Porciento, MetaDesperdicio, ValorPorTiro, TirosReferencia, SemaforoMin, SemaforoNormal, SemaforoMax, Activa, Importancia) VALUES
('1A CONVERTIDORA', 15000, 20000, 0.025, 5, 1250, 0, 0, 0, 1, 4.30),
('1B CONVERTIDORA', 15000, 20000, 0.025, 5, 1250, 0, 0, 0, 1, 4.35),
('2A Guillotina polar132', 30000, 40000, 0.025, 2, 1250, 0, 0, 0, 1, 4.35),
('2B Guillotina org- Perfecta 107', 30000, 40000, 0.025, 2, 1250, 0, 0, 0, 1, 4.35),
('3 Sord Z', 11250, 15000, 0.025, 5, 1250, 0, 0, 0, 1, 4.35),
('4 Sord Z', 11250, 15000, 0.025, 5, 2000, 0, 0, 0, 1, 4.35),
('5 Sord Z', 11250, 15000, 0.025, 5, 1250, 0, 0, 0, 1, 4.35),
('6 SpeedMaster', 11250, 15000, 0.025, 5, 3000, 0, 0, 0, 1, 4.35),
('7 SpeedMaster', 16875, 22500, 0.025, 5, 3000, 0, 0, 0, 1, 4.35),
('8A Troqueladora de Papel', 5625, 7500, 0.025, 10, 1000, 0, 0, 0, 1, 4.35),
('8B Troqueladora de Papel', 5625, 7500, 0.025, 10, 1000, 0, 0, 0, 1, 4.35),
('8C Estampadora', 4500, 6000, 0.025, 12, 1500, 0, 0, 0, 1, 4.35),
('9 Troqueladora Rollo', 11250, 15000, 0.025, 5, 1250, 0, 0, 0, 1, 4.35),
('10A Colaminadora Carton', 7500, 10000, 0.025, 10, 500, 0, 0, 0, 1, 4.35),
('10B Colaminadora Carton', 4500, 6000, 0.03, 12, 400, 0, 0, 0, 1, 4.35),
('11 Laminadora BOPP', 5625, 7500, 0.025, 10, 1000, 0, 0, 0, 1, 4.35),
('12 Maquina de Cordon', 1575, 2100, 0.025, 10, 2000, 0, 0, 0, 1, 4.35),
('12 Cortadora de Manijas', 6750, 9000, 0.025, 5, 2000, 0, 0, 0, 1, 4.35),
('13A Corrugadora FLTE', 1688, 2250, 0.025, 40, 2000, 0, 0, 0, 1, 4.35),
('13b Corrugadora FLTB', 1688, 2250, 0.025, 35, 1250, 0, 0, 0, 1, 4.35),
('14 Pegadora de Cajas', 56250, 75000, 0.07, 1, 40000, 0, 0, 0, 1, 4.35),
('15 Troqueladora Kirby', 1125, 1500, 0.025, 40, 1250, 0, 0, 0, 1, 4.35),
('16 Barnizadora UV', 5625, 7500, 0.025, 10, 1250, 0, 0, 0, 1, 4.35);
GO

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
GO

-- =============================================
-- DATOS INICIALES - ORDENES PRODUCCION
-- =============================================
INSERT INTO OrdenesProduccion (Numero, Descripcion, Estado) VALUES
('OP-2024-001', 'Producción General', 'EnProceso');
GO

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================
PRINT '============================================='
PRINT 'INSTALACIÓN COMPLETADA EXITOSAMENTE'
PRINT '============================================='
PRINT 'Tablas creadas:'
PRINT '  - Usuarios (28 operarios)'
PRINT '  - Maquinas (23 máquinas con importancia distribuida)'
PRINT '  - Actividades (8 tipos)'
PRINT '  - OrdenesProduccion (1 orden inicial)'
PRINT '  - ProduccionDiaria (vacía - se llena desde app)'
PRINT '  - TiempoProcesos (vacía - se llena desde cronómetro)'
PRINT '  - CalificacionesMensuales (vacía - se calcula automáticamente)'
PRINT '  - RendimientoOperariosMensual (vacía - se calcula automáticamente)'
PRINT ''
PRINT 'Total Importancia: 100% (distribuida equitativamente)'
PRINT '============================================='

-- Verificar que la importancia suma 100%
SELECT 
    COUNT(*) AS TotalMaquinasActivas,
    SUM(Importancia) AS TotalImportancia
FROM Maquinas 
WHERE Activa = 1;
GO
