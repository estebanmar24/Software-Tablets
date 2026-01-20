-- Crear tablas para el módulo de Mantenimiento de Equipos
-- Ejecutar en PostgreSQL

-- Tabla de Equipos
CREATE TABLE IF NOT EXISTS "Equipos" (
    "Id" SERIAL PRIMARY KEY,
    "Nombre" VARCHAR(50) NOT NULL,
    "Folio" VARCHAR(100),
    
    -- Datos del Cliente/Usuario
    "Area" VARCHAR(100),
    "UsuarioAsignado" VARCHAR(100),
    "CorreoUsuario" VARCHAR(100),
    "ContrasenaEquipo" VARCHAR(100),
    "Ubicacion" VARCHAR(200),
    "Estado" VARCHAR(50) NOT NULL DEFAULT 'Disponible',
    
    -- PC
    "PcMarca" VARCHAR(50),
    "PcModelo" VARCHAR(100),
    "PcSerie" VARCHAR(100),
    "PcInventario" VARCHAR(50),
    "PcCondicionesFisicas" VARCHAR(100),
    "PcEnciende" BOOLEAN DEFAULT TRUE,
    "PcTieneDiscoFlexible" BOOLEAN DEFAULT FALSE,
    "PcTieneCdDvd" BOOLEAN DEFAULT FALSE,
    "PcBotonesCompletos" BOOLEAN DEFAULT TRUE,
    "Procesador" VARCHAR(100),
    "MemoriaRam" VARCHAR(50),
    "DiscoDuro" VARCHAR(50),
    
    -- Monitor
    "MonitorMarca" VARCHAR(50),
    "MonitorModelo" VARCHAR(100),
    "MonitorSerie" VARCHAR(100),
    "MonitorCondicionesFisicas" VARCHAR(100),
    "MonitorEnciende" BOOLEAN DEFAULT TRUE,
    "MonitorColoresCorrectos" BOOLEAN DEFAULT TRUE,
    "MonitorBotonesCompletos" BOOLEAN DEFAULT TRUE,
    
    -- Teclado
    "TecladoMarca" VARCHAR(50),
    "TecladoModelo" VARCHAR(100),
    "TecladoSerie" VARCHAR(100),
    "TecladoCondicionesFisicas" VARCHAR(100),
    "TecladoFuncionaCorrectamente" BOOLEAN DEFAULT TRUE,
    "TecladoBotonesCompletos" BOOLEAN DEFAULT TRUE,
    "TecladoSeReemplazo" BOOLEAN DEFAULT FALSE,
    
    -- Mouse
    "MouseMarca" VARCHAR(50),
    "MouseModelo" VARCHAR(100),
    "MouseSerie" VARCHAR(100),
    "MouseCondicionesFisicas" VARCHAR(100),
    "MouseFuncionaCorrectamente" BOOLEAN DEFAULT TRUE,
    "MouseBotonesCompletos" BOOLEAN DEFAULT TRUE,
    
    -- Otros dispositivos
    "ImpresoraMarca" VARCHAR(50),
    "ImpresoraModelo" VARCHAR(100),
    "ImpresoraSerie" VARCHAR(100),
    "EscanerMarca" VARCHAR(50),
    "EscanerModelo" VARCHAR(100),
    "EscanerSerie" VARCHAR(100),
    "OtrosDispositivos" VARCHAR(500),
    
    -- Software
    "SistemaOperativo" VARCHAR(100),
    "VersionOffice" VARCHAR(100),
    "OtroSoftware" VARCHAR(500),
    
    -- Fechas
    "UltimoMantenimiento" TIMESTAMP WITH TIME ZONE,
    "ProximoMantenimiento" TIMESTAMP WITH TIME ZONE,
    "FechaCreacion" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "FechaActualizacion" TIMESTAMP WITH TIME ZONE
);

-- Tabla de Historial de Mantenimientos
CREATE TABLE IF NOT EXISTS "HistorialMantenimientos" (
    "Id" SERIAL PRIMARY KEY,
    "EquipoId" INT NOT NULL REFERENCES "Equipos"("Id") ON DELETE CASCADE,
    "Tipo" VARCHAR(50) NOT NULL DEFAULT 'Preventivo',
    "TrabajoRealizado" VARCHAR(1000),
    "Tecnico" VARCHAR(100),
    "Costo" DECIMAL(10, 2) DEFAULT 0,
    "Fecha" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "ProximoProgramado" TIMESTAMP WITH TIME ZONE,
    "Observaciones" VARCHAR(500)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS "IX_Equipos_Estado" ON "Equipos"("Estado");
CREATE INDEX IF NOT EXISTS "IX_Equipos_Area" ON "Equipos"("Area");
CREATE INDEX IF NOT EXISTS "IX_Equipos_ProximoMantenimiento" ON "Equipos"("ProximoMantenimiento");
CREATE INDEX IF NOT EXISTS "IX_HistorialMantenimientos_EquipoId" ON "HistorialMantenimientos"("EquipoId");
CREATE INDEX IF NOT EXISTS "IX_HistorialMantenimientos_Fecha" ON "HistorialMantenimientos"("Fecha");

-- Datos de ejemplo (opcional)
-- INSERT INTO "Equipos" ("Nombre", "Area", "Ubicacion", "Estado", "PcMarca", "PcModelo", "SistemaOperativo")
-- VALUES ('PC-001', 'Contabilidad', 'Piso 1, Oficina 101', 'Asignado', 'Dell', 'OptiPlex 7090', 'Windows 10');
