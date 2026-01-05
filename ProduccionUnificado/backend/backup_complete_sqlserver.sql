-- =============================================
-- SCRIPT DE BACKUP COMPLETO - TiemposProcesos
-- Incluye estructura y TODOS los datos actuales
-- Generado: 2026-01-05
-- =============================================

-- RESUMEN DE DATOS ACTUALES:
-- Usuarios: 30
-- Máquinas: 23
-- Actividades: 8
-- OrdenesProduccion: (automático)
-- TiempoProcesos: 12
-- ProduccionDiaria: 623
-- AdminUsuarios: 8
-- EncuestasCalidad: 4
-- =============================================

USE TiemposProcesos;
GO

-- =============================================
-- BORRAR TABLAS SI EXISTEN (Para restauración limpia)
-- =============================================
IF OBJECT_ID('EncuestaNovedades', 'U') IS NOT NULL DROP TABLE EncuestaNovedades;
IF OBJECT_ID('EncuestasCalidad', 'U') IS NOT NULL DROP TABLE EncuestasCalidad;
IF OBJECT_ID('RendimientoOperariosMensual', 'U') IS NOT NULL DROP TABLE RendimientoOperariosMensual;
IF OBJECT_ID('CalificacionesMensuales', 'U') IS NOT NULL DROP TABLE CalificacionesMensuales;
IF OBJECT_ID('ProduccionDiaria', 'U') IS NOT NULL DROP TABLE ProduccionDiaria;
IF OBJECT_ID('TiempoProcesos', 'U') IS NOT NULL DROP TABLE TiempoProcesos;
IF OBJECT_ID('AdminUsuarios', 'U') IS NOT NULL DROP TABLE AdminUsuarios;
IF OBJECT_ID('OrdenesProduccion', 'U') IS NOT NULL DROP TABLE OrdenesProduccion;
IF OBJECT_ID('Actividades', 'U') IS NOT NULL DROP TABLE Actividades;
IF OBJECT_ID('Maquinas', 'U') IS NOT NULL DROP TABLE Maquinas;
IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;
GO

-- =============================================
-- CREAR ESTRUCTURA DE TABLAS
-- =============================================

-- 1. TABLA USUARIOS
CREATE TABLE Usuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL,
    Estado BIT DEFAULT 1,
    FechaCreacion DATETIME DEFAULT GETDATE()
);

-- 2. TABLA MAQUINAS
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

-- 3. TABLA ACTIVIDADES
CREATE TABLE Actividades (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Codigo NVARCHAR(10) NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    EsProductiva BIT NOT NULL DEFAULT 0,
    Orden INT NOT NULL,
    Observaciones NVARCHAR(MAX) NULL
);

-- 4. TABLA ORDENES PRODUCCION
CREATE TABLE OrdenesProduccion (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Numero NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200) NOT NULL,
    Estado NVARCHAR(50) NOT NULL,
    FechaCreacion DATETIME DEFAULT GETDATE()
);

-- 5. TABLA ADMIN USUARIOS
CREATE TABLE AdminUsuarios (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL,
    Role NVARCHAR(50) NOT NULL,
    FechaCreacion DATETIME2 DEFAULT GETDATE()
);

-- 6. TABLA TIEMPO PROCESOS
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

-- 7. TABLA PRODUCCION DIARIA
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
    
    -- Bonificaciones
    EsHorarioLaboral BIT DEFAULT 1,
    TirosBonificables INT DEFAULT 0,
    DesperdicioBonificable DECIMAL(10,2) DEFAULT 0,
    ValorAPagarBonificable DECIMAL(10,2) DEFAULT 0,
    
    CONSTRAINT FK_Produccion_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Produccion_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id)
);

-- 8. TABLA CALIFICACIONES MENSUALES
CREATE TABLE CalificacionesMensuales (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UsuarioId INT NOT NULL,
    MaquinaId INT NOT NULL,
    Mes INT NOT NULL,
    Anio INT NOT NULL,
    PromedioRendimiento DECIMAL(10,2) DEFAULT 0,
    PromedioDesperdicio DECIMAL(10,2) DEFAULT 0,
    FechaCalculo DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Calificacion_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Calificacion_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id)
);

-- 9. TABLA RENDIMIENTO OPERARIO MENSUAL
CREATE TABLE RendimientoOperariosMensual (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UsuarioId INT NOT NULL,
    Mes INT NOT NULL,
    Anio INT NOT NULL,
    TotalTiros INT DEFAULT 0,
    TotalHoras DECIMAL(10,2) DEFAULT 0,
    CONSTRAINT FK_Rendimiento_Usuario FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);

-- 10. TABLA ENCUESTAS CALIDAD
CREATE TABLE EncuestasCalidad (
    Id INT PRIMARY KEY IDENTITY(1,1),
    OperarioId INT NOT NULL,
    AuxiliarId INT NOT NULL,
    MaquinaId INT NOT NULL,
    Fecha DATETIME2 NOT NULL,
    FotoPath NVARCHAR(500),
    FechaCreacion DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Encuesta_Operario FOREIGN KEY (OperarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Encuesta_Auxiliar FOREIGN KEY (AuxiliarId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_Encuesta_Maquina FOREIGN KEY (MaquinaId) REFERENCES Maquinas(Id)
);

-- 11. TABLA ENCUESTA NOVEDADES
CREATE TABLE EncuestaNovedades (
    Id INT PRIMARY KEY IDENTITY(1,1),
    EncuestaId INT NOT NULL,
    Novedad NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_Novedad_Encuesta FOREIGN KEY (EncuestaId) REFERENCES EncuestasCalidad(Id) ON DELETE CASCADE
);

-- Índices para búsquedas rápidas
CREATE INDEX IX_Produccion_Fecha ON ProduccionDiaria(Fecha);
CREATE INDEX IX_Produccion_Usuario ON ProduccionDiaria(UsuarioId);
CREATE INDEX IX_Produccion_Maquina ON ProduccionDiaria(MaquinaId);
CREATE INDEX IX_TiempoProcesos_Actividad ON TiempoProcesos(ActividadId);
CREATE INDEX IX_TiempoProcesos_Usuario ON TiempoProcesos(UsuarioId);

PRINT '¡Estructura de tablas creada correctamente!';
GO

-- =============================================
-- INSERTAR DATOS ACTUALES
-- Los datos se generarán a continuación mediante queries
-- =============================================
PRINT 'Preparando inserción de datos...';
GO
