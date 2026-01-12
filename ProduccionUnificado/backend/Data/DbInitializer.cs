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

        // CALIFICACIONES MENSUALES (para historial de calificaciones de planta)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.CalificacionesMensuales', 'U') IS NULL
                BEGIN
                    CREATE TABLE [CalificacionesMensuales] (
                        [Id] int NOT NULL IDENTITY,
                        [Mes] int NOT NULL,
                        [Anio] int NOT NULL,
                        [CalificacionTotal] decimal(10, 2) NOT NULL DEFAULT 0,
                        [FechaCalculo] datetime NOT NULL DEFAULT GETDATE(),
                        [Notas] nvarchar(500) NULL,
                        [DesgloseMaquinas] nvarchar(max) NULL,
                        CONSTRAINT [PK_CalificacionesMensuales] PRIMARY KEY ([Id]),
                        CONSTRAINT [UQ_CalificacionesMensuales_MesAnio] UNIQUE ([Mes], [Anio])
                    );
                    CREATE INDEX [IX_CalificacionesMensuales_Anio] ON [CalificacionesMensuales] ([Anio] DESC, [Mes] DESC);
                    PRINT 'Tabla CalificacionesMensuales creada.';
                END
            ");
            Console.WriteLine("[DB INIT] CalificacionesMensuales checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] CalificacionesMensuales: {ex.Message}"); }

        // ENCUESTAS DE CALIDAD
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.EncuestasCalidad', 'U') IS NULL
                BEGIN
                    CREATE TABLE [EncuestasCalidad] (
                        [Id] int NOT NULL IDENTITY,
                        [OperarioId] int NOT NULL,
                        [AuxiliarId] int NULL,
                        [OrdenProduccion] nvarchar(50) NOT NULL,
                        [CantidadProducir] decimal(18, 2) NOT NULL,
                        [MaquinaId] int NOT NULL,
                        [Proceso] nvarchar(100) NOT NULL,
                        [CantidadEvaluada] decimal(18, 2) NOT NULL,
                        [EstadoProceso] nvarchar(50) NOT NULL,
                        [TieneFichaTecnica] bit NOT NULL,
                        [CorrectoRegistroFormatos] bit NOT NULL,
                        [AprobacionArranque] bit NOT NULL,
                        [Observacion] nvarchar(max) NULL,
                        [FechaCreacion] datetime2 NOT NULL DEFAULT GETDATE(),
                        [CreadoPor] nvarchar(100) NULL,
                        CONSTRAINT [PK_EncuestasCalidad] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_EncuestasCalidad_Operario] FOREIGN KEY ([OperarioId]) REFERENCES [Usuarios]([Id]),
                        CONSTRAINT [FK_EncuestasCalidad_Auxiliar] FOREIGN KEY ([AuxiliarId]) REFERENCES [Usuarios]([Id]),
                        CONSTRAINT [FK_EncuestasCalidad_Maquina] FOREIGN KEY ([MaquinaId]) REFERENCES [Maquinas]([Id])
                    );
                    CREATE INDEX [IX_EncuestasCalidad_FechaCreacion] ON [EncuestasCalidad] ([FechaCreacion] DESC);
                    PRINT 'Tabla EncuestasCalidad creada.';
                END
            ");
            Console.WriteLine("[DB INIT] EncuestasCalidad checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] EncuestasCalidad: {ex.Message}"); }

        // ENCUESTA NOVEDADES
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.EncuestaNovedades', 'U') IS NULL
                BEGIN
                    CREATE TABLE [EncuestaNovedades] (
                        [Id] int NOT NULL IDENTITY,
                        [EncuestaId] int NOT NULL,
                        [TipoNovedad] nvarchar(100) NOT NULL,
                        [FotoPath] nvarchar(500) NULL,
                        [Descripcion] nvarchar(max) NULL,
                        [CantidadDefectuosa] int NOT NULL DEFAULT 0,
                        CONSTRAINT [PK_EncuestaNovedades] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_EncuestaNovedades_Encuesta] FOREIGN KEY ([EncuestaId]) REFERENCES [EncuestasCalidad]([Id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_EncuestaNovedades_EncuestaId] ON [EncuestaNovedades] ([EncuestaId]);
                    PRINT 'Tabla EncuestaNovedades creada.';
                END
                ELSE
                BEGIN
                    -- Agregar columna si no existe
                    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EncuestaNovedades' AND COLUMN_NAME = 'CantidadDefectuosa')
                    BEGIN
                        ALTER TABLE [EncuestaNovedades] ADD [CantidadDefectuosa] int NOT NULL DEFAULT 0;
                        PRINT 'Columna CantidadDefectuosa agregada.';
                    END
                END
            ");
            Console.WriteLine("[DB INIT] EncuestaNovedades checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] EncuestaNovedades: {ex.Message}"); }

        // ADMIN USUARIOS (Auth Profesional)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.AdminUsuarios', 'U') IS NULL
                BEGIN
                    CREATE TABLE [AdminUsuarios] (
                        [Id] int NOT NULL IDENTITY,
                        [Username] nvarchar(100) NOT NULL,
                        [PasswordHash] nvarchar(max) NOT NULL,
                        [Role] nvarchar(50) NOT NULL,
                        [NombreMostrar] nvarchar(200) NOT NULL,
                        CONSTRAINT [PK_AdminUsuarios] PRIMARY KEY ([Id]),
                        CONSTRAINT [UQ_AdminUsuarios_Username] UNIQUE ([Username])
                    );
                    PRINT 'Tabla AdminUsuarios creada.';
                END
            ");
            Console.WriteLine("[DB INIT] AdminUsuarios checked/created.");

            // Seeding users logic managed by EF Core directly to use BCrypt easily
            // Seeding users logic managed by EF Core directly to use BCrypt easily
            // 1. Ensure initial seeding if empty
            if (!context.AdminUsuarios.Any())
            {
                var users = new List<TiempoProcesos.API.Models.AdminUsuario>
                {
                    new() { Username = "admin", Role = "admin", NombreMostrar = "Administrador Master", PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123") },
                    new() { Username = "produccion", Role = "produccion", NombreMostrar = "Gerente Producción", PasswordHash = BCrypt.Net.BCrypt.HashPassword("prod2025") },
                    new() { Username = "sst", Role = "sst", NombreMostrar = "Seguridad y Salud", PasswordHash = BCrypt.Net.BCrypt.HashPassword("sst2025") },
                    new() { Username = "gh", Role = "gh", NombreMostrar = "Gestión Humana", PasswordHash = BCrypt.Net.BCrypt.HashPassword("gh2025") },
                    new() { Username = "talleres", Role = "talleres", NombreMostrar = "Talleres y Despacho", PasswordHash = BCrypt.Net.BCrypt.HashPassword("taller2025") },
                    new() { Username = "presupuesto", Role = "presupuesto", NombreMostrar = "Presupuesto General", PasswordHash = BCrypt.Net.BCrypt.HashPassword("presup2025") },
                    new() { Username = "calidad", Role = "calidad", NombreMostrar = "Control Calidad", PasswordHash = BCrypt.Net.BCrypt.HashPassword("calidad123") },
                    new() { Username = "develop", Role = "develop", NombreMostrar = "Desarrollador", PasswordHash = BCrypt.Net.BCrypt.HashPassword("@L3ph2026") }
                };

                context.AdminUsuarios.AddRange(users);
                context.SaveChanges();
                Console.WriteLine("[DB INIT] Admin Users Seeded.");
            }
            else 
            {
                // 2. Ensure 'develop' exists specifically (upsert)
                var devUser = context.AdminUsuarios.FirstOrDefault(u => u.Username == "develop");
                if (devUser == null)
                {
                    context.AdminUsuarios.Add(new TiempoProcesos.API.Models.AdminUsuario 
                    { 
                        Username = "develop", 
                        Role = "develop", 
                        NombreMostrar = "Desarrollador", 
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("@L3ph2026") 
                    });
                    Console.WriteLine("[DB INIT] Develop User Added.");
                }
                else 
                {
                    devUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("@L3ph2026");
                    devUser.Role = "develop"; // Ensure role is correct
                    Console.WriteLine("[DB INIT] Develop User Updated.");
                }
                context.SaveChanges();
            }
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] AdminUsuarios: {ex.Message}"); }

        // GH TABLES (Gestión Humana) - Create tables with PostgreSQL DDL, then seed with EF Core
        try
        {
            // First, create the tables if they don't exist (PostgreSQL syntax)
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""GH_Rubros"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                
                CREATE TABLE IF NOT EXISTS ""GH_TiposServicio"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""GH_Rubros""(""Id""),
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""PresupuestoMensual"" DECIMAL(18,2) NOT NULL DEFAULT 0,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                
                CREATE TABLE IF NOT EXISTS ""GH_Proveedores"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TipoServicioId"" INTEGER NOT NULL REFERENCES ""GH_TiposServicio""(""Id""),
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""Telefono"" VARCHAR(20),
                    ""Correo"" VARCHAR(100),
                    ""Direccion"" VARCHAR(300),
                    ""NIT"" VARCHAR(20),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                
                CREATE TABLE IF NOT EXISTS ""GH_Cotizaciones"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER NOT NULL REFERENCES ""GH_Proveedores""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""PrecioCotizado"" DECIMAL(18,2) NOT NULL,
                    ""FechaCotizacion"" TIMESTAMP NOT NULL,
                    ""Descripcion"" VARCHAR(500),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                
                CREATE TABLE IF NOT EXISTS ""GH_GastosMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""GH_Rubros""(""Id""),
                    ""TipoServicioId"" INTEGER NOT NULL REFERENCES ""GH_TiposServicio""(""Id""),
                    ""ProveedorId"" INTEGER NOT NULL REFERENCES ""GH_Proveedores""(""Id""),
                    ""CotizacionId"" INTEGER REFERENCES ""GH_Cotizaciones""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""NumeroFactura"" VARCHAR(100),
                    ""Precio"" DECIMAL(18,2) NOT NULL,
                    ""FechaCompra"" TIMESTAMP NOT NULL,
                    ""Nota"" TEXT,
                    ""ArchivoFactura"" TEXT,
                    ""ArchivoFacturaNombre"" VARCHAR(500)
                );
                
                CREATE TABLE IF NOT EXISTS ""GH_PresupuestosMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TipoServicioId"" INTEGER NOT NULL REFERENCES ""GH_TiposServicio""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL CHECK (""Mes"" >= 1 AND ""Mes"" <= 12),
                    ""Presupuesto"" DECIMAL(18,2) NOT NULL DEFAULT 0
                );
                
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_GH_PresupuestosMensuales_Unique"" 
                ON ""GH_PresupuestosMensuales"" (""TipoServicioId"", ""Anio"", ""Mes"");
                
                CREATE TABLE IF NOT EXISTS ""SST_Cotizaciones"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER NOT NULL,
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""PrecioCotizado"" DECIMAL(18,2) NOT NULL,
                    ""FechaCotizacion"" TIMESTAMP NOT NULL,
                    ""Descripcion"" VARCHAR(500),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
            ");
            Console.WriteLine("[DB INIT] GH & SST Tables created/verified (PostgreSQL).");
            
            // Now seed the data if tables are empty
            if (!context.GH_Rubros.Any())
            {
                var rubros = new List<TiempoProcesos.API.Models.GH_Rubro>
                {
                    new() { Nombre = "Compradores de Desperdicio", Activo = true },
                    new() { Nombre = "Servicios Publicos", Activo = true },
                    new() { Nombre = "Seguridad", Activo = true },
                    new() { Nombre = "GPS", Activo = true },
                    new() { Nombre = "Cafeteria", Activo = true },
                    new() { Nombre = "Papeleria", Activo = true },
                    new() { Nombre = "Mantenimiento", Activo = true },
                    new() { Nombre = "Dotacion", Activo = true },
                    new() { Nombre = "Aseo", Activo = true },
                    new() { Nombre = "Cable", Activo = true },
                    new() { Nombre = "Telefonia", Activo = true },
                    new() { Nombre = "Ayuda Emocional", Activo = true }
                };
                context.GH_Rubros.AddRange(rubros);
                context.SaveChanges();
                Console.WriteLine("[DB INIT] GH_Rubros seeded with 12 items.");

                // Now seed TiposServicio using the created Rubros
                var rubroDict = context.GH_Rubros.ToDictionary(r => r.Nombre, r => r.Id);
                var tiposServicio = new List<TiempoProcesos.API.Models.GH_TipoServicio>
                {
                    new() { RubroId = rubroDict["Compradores de Desperdicio"], Nombre = "Desperdicio", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Servicios Publicos"], Nombre = "Agua", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Servicios Publicos"], Nombre = "Luz", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Servicios Publicos"], Nombre = "Alcantarillado", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Servicios Publicos"], Nombre = "Aseo Municipal", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Seguridad"], Nombre = "Vigilancia", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["GPS"], Nombre = "GPS Vehiculos", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Cafeteria"], Nombre = "Insumos Cafeteria", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Papeleria"], Nombre = "Insumos Oficina", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Papeleria"], Nombre = "Impresoras", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Mantenimiento"], Nombre = "Aire Acondicionado", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Mantenimiento"], Nombre = "Plomeria", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Mantenimiento"], Nombre = "Redes", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Mantenimiento"], Nombre = "Arreglos Varios", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Dotacion"], Nombre = "Uniforme", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Aseo"], Nombre = "Insumos Aseo", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Cable"], Nombre = "Internet 1", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Cable"], Nombre = "Internet 2", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Telefonia"], Nombre = "Telefonia Fija", PresupuestoMensual = 0, Activo = true },
                    new() { RubroId = rubroDict["Ayuda Emocional"], Nombre = "Insumos Michi", PresupuestoMensual = 0, Activo = true }
                };
                context.GH_TiposServicio.AddRange(tiposServicio);
                context.SaveChanges();
                Console.WriteLine("[DB INIT] GH_TiposServicio seeded with 20 items.");
            }
            else
            {
                Console.WriteLine("[DB INIT] GH_Rubros already has data, skipping seed.");
            }
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] GH Tables: {ex.Message}"); }

        // PRODUCCION (Control de Gastos)
        try
        {
            // 1. Add Salario column to Usuarios if missing
            Console.WriteLine("[DB DEBUG] About to add Salario column...");
            try {
                context.Database.ExecuteSqlRaw(@"ALTER TABLE ""Usuarios"" ADD ""Salario"" DECIMAL(18,2) NOT NULL DEFAULT 0;");
                Console.WriteLine("[DB INIT] Salario column added.");
            } catch (Exception ex) { Console.WriteLine($"[DB INFO] Salario add skipped: {ex.Message}"); }

            // 2. Create Tables
            // 2. Create Tables - SPLIT for Debugging
            Console.WriteLine("[DB DEBUG] About to create Produccion_Rubros...");
            try {
                context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""Produccion_Rubros"" (
                        ""Id"" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""Nombre"" VARCHAR(200) NOT NULL,
                        ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                    );
                ");
                Console.WriteLine("[DB INIT] Produccion_Rubros created.");
            } catch (Exception ex) { Console.WriteLine($"[DB ERROR] Rubros: {ex.Message}"); }

            Console.WriteLine("[DB DEBUG] About to create Produccion_Proveedores...");
            try {
                context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""Produccion_Proveedores"" (
                        ""Id"" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""Nombre"" VARCHAR(200) NOT NULL,
                        ""Nit"" VARCHAR(50),
                        ""Telefono"" VARCHAR(50),
                        ""RubroId"" INTEGER NULL,
                        ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                    );
                ");
                Console.WriteLine("[DB INIT] Produccion_Proveedores created.");
                // Add RubroId column if it doesn't exist (for existing installations)
                context.Database.ExecuteSqlRaw(@"
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                       WHERE table_name='Produccion_Proveedores' AND column_name='RubroId') THEN
                            ALTER TABLE ""Produccion_Proveedores"" ADD COLUMN ""RubroId"" INTEGER NULL;
                        END IF;
                    END $$;
                ");
                Console.WriteLine("[DB INIT] RubroId column ensured in Produccion_Proveedores.");
            } catch (Exception ex) { Console.WriteLine($"[DB ERROR] Proveedores: {ex.Message}"); }

            Console.WriteLine("[DB DEBUG] About to create Produccion_TiposHora...");
            try {
                context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""Produccion_TiposHora"" (
                        ""Id"" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""Nombre"" VARCHAR(100) NOT NULL,
                        ""Porcentaje"" DECIMAL(18,2) NOT NULL,
                        ""Factor"" DECIMAL(18,4) NOT NULL,
                        ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                    );
                ");
                Console.WriteLine("[DB INIT] Produccion_TiposHora created.");
            } catch (Exception ex) { Console.WriteLine($"[DB ERROR] TiposHora: {ex.Message}"); }

            Console.WriteLine("[DB DEBUG] About to create Produccion_Gastos...");
            try {
                context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""Produccion_Gastos"" (
                        ""Id"" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""RubroId"" INTEGER NOT NULL REFERENCES ""Produccion_Rubros""(""Id""),
                        ""ProveedorId"" INTEGER REFERENCES ""Produccion_Proveedores""(""Id""),
                        ""UsuarioId"" INTEGER REFERENCES ""Usuarios""(""Id""),
                        ""MaquinaId"" INTEGER REFERENCES ""Maquinas""(""Id""),
                        ""TipoHoraId"" INTEGER REFERENCES ""Produccion_TiposHora""(""Id""),
                        ""Anio"" INTEGER NOT NULL,
                        ""Mes"" INTEGER NOT NULL,
                        ""Precio"" DECIMAL(18,2) NOT NULL,
                        ""Fecha"" TIMESTAMP NOT NULL,
                        ""Nota"" TEXT,
                        ""CantidadHoras"" DECIMAL(18,2)
                    );
                ");
                Console.WriteLine("[DB INIT] Produccion_Gastos created.");
            } catch (Exception ex) { Console.WriteLine($"[DB ERROR] Gastos: {ex.Message}"); }

            Console.WriteLine("[DB DEBUG] About to create Produccion_PresupuestosMensuales...");
            try {
                context.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""Produccion_PresupuestosMensuales"" (
                        ""Id"" INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""RubroId"" INTEGER NOT NULL REFERENCES ""Produccion_Rubros""(""Id""),
                        ""Anio"" INTEGER NOT NULL,
                        ""Mes"" INTEGER NOT NULL,
                        ""Presupuesto"" DECIMAL(18,2) NOT NULL,
                        UNIQUE(""RubroId"", ""Anio"", ""Mes"")
                    );
                ");
                Console.WriteLine("[DB INIT] Produccion_PresupuestosMensuales created.");
            } catch (Exception ex) { Console.WriteLine($"[DB ERROR] PresupuestosMensuales: {ex.Message}"); }

            // 3. Seed Production Rubros
            if (!context.Produccion_Rubros.Any())
            {
                var rubros = new List<TiempoProcesos.API.Models.Produccion_Rubro>
                {
                    new() { Nombre = "Horas Extras" },
                    new() { Nombre = "Mantenimiento" },
                    new() { Nombre = "Repuesto" },
                    new() { Nombre = "Refrigerios" }
                };
                context.Produccion_Rubros.AddRange(rubros);
                context.SaveChanges();
            }

            // 4. Seed Production TiposHora (User Defaults)
            if (!context.Produccion_TiposHora.Any())
            {
                var tipos = new List<TiempoProcesos.API.Models.Produccion_TipoHora>
                {
                    new() { Nombre = "Extra Diurna", Porcentaje = 25, Factor = 1.25m },
                    new() { Nombre = "Extra Nocturna", Porcentaje = 75, Factor = 1.75m },
                    new() { Nombre = "Dominical Diurna", Porcentaje = 75, Factor = 1.75m },
                    new() { Nombre = "Dominical Nocturna", Porcentaje = 110, Factor = 2.10m }
                };
                context.Produccion_TiposHora.AddRange(tipos);
                context.SaveChanges();
            }
            
            // 5. Update Salaries for Specific Users (Data provided by user)
            // "Jose Lizandro Blandon Moreno" -> 1.423.500
            // Since user list is long and identical salary, update logic:
            // Find users by fuzzy name or bulk update all active operators? 
            // Better: Update ALL active users to this base salary if 0, as asked "relation the operator with their salary".
            // User provided a list of names with the SAME salary 1.423.500 for ALL.
            // I will set this as default for existing users if currently 0.
            context.Database.ExecuteSqlRaw(@"
                UPDATE ""Usuarios"" SET ""Salario"" = 1423500 WHERE ""Salario"" = 0 AND ""Estado"" = true;
            ");
            Console.WriteLine("[DB INIT] Salaries updated.");

        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] Produccion Tables: {ex.Message}"); }
    }
}
