using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;

namespace TiempoProcesos.API.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext context)
    {
        Log("Starting initialization...");
        try 
        {
            context.Database.EnsureCreated();
            Log("EnsureCreated passed.");
        }
        catch (Exception ex)
        {
            Log($"EnsureCreated Warning: {ex.Message}");
        }

        CreateTables(context);
        Log("Initialization finished.");
    }

    private static void Log(string message)
    {
        try { File.AppendAllText("startup_log.txt", $"{DateTime.Now}: {message}\n"); } catch {}
        Console.WriteLine($"[DB INIT] {message}");
    }

    private static void CreateTables(AppDbContext context)
    {
        // USUARIOS
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
                BEGIN
                    CREATE TABLE [Usuarios] (
                        [Id] int NOT NULL IDENTITY,
                        [Nombre] nvarchar(max) NOT NULL,
                        [Estado] bit NOT NULL DEFAULT 1,
                        [FechaCreacion] datetime2 NOT NULL DEFAULT GETDATE(),
                        CONSTRAINT [PK_Usuarios] PRIMARY KEY ([Id])
                    );
                    INSERT INTO [Usuarios] ([Nombre], [Estado]) VALUES 
                    ('Blandon Moreno Jose Lizandro', 1), ('Cruz Pinto Alberto', 1), ('Enrique Muñoz Hector Hilde', 1), ('Escobar Cardona John Fredy', 1),
                    ('Martinez Osorno Karen Lizeth', 1), ('Millan Salazar Magaly', 1), ('Moreno Mendez Angel Julio', 1), ('Moreno Urrea Marlene', 1),
                    ('Motta Talaga Leidy Jhoanna', 1), ('Obando Higuita Jose Luis', 1), ('Ramirez Romero Andres Mauricio', 1), ('Sarmiento Rincon Yhan Otoniel', 1),
                    ('Velez Arana Robert De Jesus', 1), ('Perdomo Rincon Gustavo Adolfo', 1), ('Moriano Chiguas Yurde Arley', 1), ('Bedoya Maria Fernanda', 1),
                    ('Morales Grueso Claudia Patricia', 1), ('Gomez Ruiz William Hernan', 1), ('Rodriguez Castaño Maria Alejandra', 1), ('Rojas Collazos Joan Mauricio', 1),
                    ('Riascos Castillo Andres Felipe', 1), ('Roldan Barona Erik Esteban', 1), ('Renteria Mejia Nestor Alfonso', 1), ('Mina Sinisterra Jhon Jairo', 1),
                    ('Valencia Mirquez Nicol', 1), ('Uran Quintero Yohao Alexander', 1), ('Preciado Rivas Johan Alexander', 1), ('Jose Fernando Ruiz', 1);
                    PRINT 'Tabla Usuarios creada.';
                END
            ");
            Console.WriteLine("[DB INIT] Usuarios checked/created.");
        }
        catch (Exception ex) { Log($"Usuarios Error: {ex.Message}"); }

        // MAQUINAS
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.Maquinas', 'U') IS NULL
                BEGIN
                    CREATE TABLE [Maquinas] (
                        [Id] int NOT NULL IDENTITY,
                        [Nombre] nvarchar(max) NOT NULL,
                        [MetaRendimiento] int NOT NULL DEFAULT 0,
                        [MetaDesperdicio] decimal(5,4) NOT NULL DEFAULT 0,
                        [ValorPorTiro] decimal(10,2) NOT NULL DEFAULT 0,
                        [TirosReferencia] int NOT NULL DEFAULT 0,
                        [SemaforoMin] int NOT NULL DEFAULT 0,
                        [SemaforoNormal] int NOT NULL DEFAULT 0,
                        [SemaforoMax] int NOT NULL DEFAULT 0,
                        [Activa] bit DEFAULT 1,
                        CONSTRAINT [PK_Maquinas] PRIMARY KEY ([Id])
                    );
                    PRINT 'Tabla Maquinas creada.';
                END

                IF NOT EXISTS (SELECT 1 FROM [Maquinas])
                BEGIN
                    INSERT INTO [Maquinas] (Nombre, MetaRendimiento, MetaDesperdicio, ValorPorTiro, TirosReferencia, SemaforoMin, SemaforoNormal, SemaforoMax, Activa) VALUES
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
                    PRINT 'Datos de Maquinas insertados.';
                END
            ");
            Console.WriteLine("[DB INIT] Maquinas checked/created.");
        }
        catch (Exception ex) { Log($"Maquinas Error: {ex.Message}"); }

        // ACTIVIDADES
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.Actividades', 'U') IS NULL
                BEGIN
                    CREATE TABLE [Actividades] (
                        [Id] int NOT NULL IDENTITY,
                        [Codigo] nvarchar(max) NOT NULL,
                        [Nombre] nvarchar(max) NOT NULL,
                        [EsProductiva] bit NOT NULL,
                        [Orden] int NOT NULL,
                        [Observaciones] nvarchar(max) NULL,
                        CONSTRAINT [PK_Actividades] PRIMARY KEY ([Id])
                    );
                    PRINT 'Tabla Actividades creada.';
                END

                IF NOT EXISTS (SELECT 1 FROM [Actividades])
                BEGIN
                    INSERT INTO [Actividades] ([Codigo], [Nombre], [EsProductiva], [Orden], [Observaciones]) VALUES
                    ('01', 'Puesta a Punto', 0, 1, 'Preparación inicial de la máquina'),
                    ('02', 'Producción', 1, 2, 'Tiempo productivo de operación'),
                    ('03', 'Reparación', 0, 3, 'Reparación de fallas o averías'),
                    ('04', 'Descanso', 0, 4, 'Tiempo de descanso programado'),
                    ('08', 'Otro Tiempo Muerto', 0, 5, 'Falta de Material, Imprevistos'),
                    ('10', 'Mantenimiento y Aseo', 0, 6, 'Mantenimiento preventivo'),
                    ('13', 'Falta de Trabajo', 0, 7, 'Sin órdenes asignadas'),
                    ('14', 'Otros tiempos', 0, 8, 'Calibración, cambios, reunion');
                    PRINT 'Datos Actividades insertados.';
                END
            ");
            Console.WriteLine("[DB INIT] Actividades checked/created.");
        }
        catch (Exception ex) { Log($"Actividades Error: {ex.Message}"); }

        // ORDENES
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.OrdenesProduccion', 'U') IS NULL
                BEGIN
                    CREATE TABLE [OrdenesProduccion] (
                        [Id] int NOT NULL IDENTITY,
                        [Numero] nvarchar(max) NOT NULL,
                        [Descripcion] nvarchar(max) NOT NULL,
                        [Estado] nvarchar(max) NOT NULL,
                        [FechaCreacion] datetime2 NOT NULL,
                        CONSTRAINT [PK_OrdenesProduccion] PRIMARY KEY ([Id])
                    );
                    INSERT INTO [OrdenesProduccion] ([Numero], [Descripcion], [Estado], [FechaCreacion]) VALUES
                    ('OP-2024-001', 'Producción General', 'EnProceso', GETDATE());
                    PRINT 'Tabla OrdenesProduccion creada.';
                END
            ");
            Console.WriteLine("[DB INIT] OrdenesProduccion checked/created.");
        }
        catch (Exception ex) { Log($"OrdenesProduccion Error: {ex.Message}"); }

        // TIEMPO PROCESOS
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.TiempoProcesos', 'U') IS NULL
                BEGIN
                    CREATE TABLE [TiempoProcesos] (
                        [Id] bigint NOT NULL IDENTITY,
                        [Fecha] datetime2 NOT NULL,
                        [HoraInicio] time NOT NULL,
                        [HoraFin] time NOT NULL,
                        [Duracion] time NOT NULL,
                        [UsuarioId] int NOT NULL,
                        [MaquinaId] int NOT NULL,
                        [OrdenProduccionId] int NULL,
                        [ActividadId] int NOT NULL,
                        [Tiros] int NOT NULL,
                        [Desperdicio] int NOT NULL,
                        [Observaciones] nvarchar(max) NULL,
                        CONSTRAINT [PK_TiempoProcesos] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_TiempoProcesos_Actividades_ActividadId] FOREIGN KEY ([ActividadId]) REFERENCES [Actividades] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_TiempoProcesos_Maquinas_MaquinaId] FOREIGN KEY ([MaquinaId]) REFERENCES [Maquinas] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_TiempoProcesos_OrdenesProduccion_OrdenProduccionId] FOREIGN KEY ([OrdenProduccionId]) REFERENCES [OrdenesProduccion] ([Id]),
                        CONSTRAINT [FK_TiempoProcesos_Usuarios_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_TiempoProcesos_ActividadId] ON [TiempoProcesos] ([ActividadId]);
                    CREATE INDEX [IX_TiempoProcesos_UsuarioId] ON [TiempoProcesos] ([UsuarioId]);
                    PRINT 'Tabla TiempoProcesos creada.';
                END
            ");
            Console.WriteLine("[DB INIT] TiempoProcesos checked/created.");
        }
        catch (Exception ex) { Log($"TiempoProcesos Error: {ex.Message}"); }
        
        // PRODUCCION DIARIA (Verificación de existencia)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.ProduccionDiaria', 'U') IS NULL
                BEGIN
                     -- Create if missing (unexpected as script ran, but safe to add)
                    CREATE TABLE [ProduccionDiaria] (
                        [Id] bigint NOT NULL IDENTITY,
                        [Fecha] date NOT NULL,
                        [UsuarioId] int NOT NULL,
                        [MaquinaId] int NOT NULL,
                        [HoraInicio] time NULL,
                        [HoraFin] time NULL,
                        [HorasOperativas] decimal(10, 2) NOT NULL,
                        [RendimientoFinal] decimal(10, 2) NOT NULL,
                        [Cambios] int NOT NULL,
                        [TiempoPuestaPunto] decimal(10, 2) NOT NULL,
                        [TirosDiarios] int NOT NULL,
                        [TotalHorasProductivas] decimal(10, 2) NOT NULL,
                        [PromedioHoraProductiva] decimal(10, 2) NOT NULL,
                        [ValorTiroSnapshot] decimal(10, 2) NOT NULL,
                        [ValorAPagar] decimal(10, 2) NOT NULL,
                        [HorasMantenimiento] decimal(10, 2) NOT NULL,
                        [HorasDescanso] decimal(10, 2) NOT NULL,
                        [HorasOtrosAux] decimal(10, 2) NOT NULL,
                        [TotalHorasAuxiliares] decimal(10, 2) NOT NULL,
                        [TiempoFaltaTrabajo] decimal(10, 2) NOT NULL,
                        [TiempoReparacion] decimal(10, 2) NOT NULL,
                        [TiempoOtroMuerto] decimal(10, 2) NOT NULL,
                        [TotalTiemposMuertos] decimal(10, 2) NOT NULL,
                        [TotalHoras] decimal(10, 2) NOT NULL,
                        [ReferenciaOP] nvarchar(50) NULL,
                        [Novedades] nvarchar(max) NULL,
                        [Desperdicio] decimal(10, 2) NOT NULL,
                        [DiaLaborado] int NOT NULL,
                        [EsHorarioLaboral] bit NOT NULL DEFAULT 1,
                        [TirosBonificables] int NOT NULL DEFAULT 0,
                        [DesperdicioBonificable] decimal(10, 2) NOT NULL DEFAULT 0,
                        [ValorAPagarBonificable] decimal(10, 2) NOT NULL DEFAULT 0,
                        CONSTRAINT [PK_ProduccionDiaria] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_ProduccionDiaria_Maquinas_MaquinaId] FOREIGN KEY ([MaquinaId]) REFERENCES [Maquinas] ([Id]) ON DELETE CASCADE,
                        CONSTRAINT [FK_ProduccionDiaria_Usuarios_UsuarioId] FOREIGN KEY ([UsuarioId]) REFERENCES [Usuarios] ([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_ProduccionDiaria_MaquinaId] ON [ProduccionDiaria] ([MaquinaId]);
                    CREATE INDEX [IX_ProduccionDiaria_UsuarioId] ON [ProduccionDiaria] ([UsuarioId]);
                    PRINT 'Tabla ProduccionDiaria creada/verificada.';
                END

                -- Add missing columns if table exists but columns don't
                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ProduccionDiaria' AND COLUMN_NAME = 'EsHorarioLaboral')
                BEGIN
                    ALTER TABLE [ProduccionDiaria] ADD [EsHorarioLaboral] bit NOT NULL DEFAULT 1;
                    PRINT 'Columna EsHorarioLaboral agregada.';
                END

                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ProduccionDiaria' AND COLUMN_NAME = 'TirosBonificables')
                BEGIN
                    ALTER TABLE [ProduccionDiaria] ADD [TirosBonificables] int NOT NULL DEFAULT 0;
                    PRINT 'Columna TirosBonificables agregada.';
                END

                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ProduccionDiaria' AND COLUMN_NAME = 'DesperdicioBonificable')
                BEGIN
                    ALTER TABLE [ProduccionDiaria] ADD [DesperdicioBonificable] decimal(10, 2) NOT NULL DEFAULT 0;
                    PRINT 'Columna DesperdicioBonificable agregada.';
                END

                IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ProduccionDiaria' AND COLUMN_NAME = 'ValorAPagarBonificable')
                BEGIN
                    ALTER TABLE [ProduccionDiaria] ADD [ValorAPagarBonificable] decimal(10, 2) NOT NULL DEFAULT 0;
                    PRINT 'Columna ValorAPagarBonificable agregada.';
                END
            ");
            Console.WriteLine("[DB INIT] ProduccionDiaria checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] ProduccionDiaria: {ex.Message}"); }
    }
}
