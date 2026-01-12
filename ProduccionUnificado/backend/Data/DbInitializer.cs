using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;

namespace TiempoProcesos.API.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext context)
    {
        try
        {
            Console.WriteLine("[DB INIT] Starting initialization...");
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
        catch (Exception ex)
        {
            Log($"[CRITICAL DB ERROR] Initialization failed completely: {ex.Message}");
        }
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
                CREATE TABLE IF NOT EXISTS ""Usuarios"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Estado"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""Salario"" DECIMAL(18,2) NOT NULL DEFAULT 0
                );
                
                INSERT INTO ""Usuarios"" (""Nombre"", ""Estado"") 
                SELECT * FROM (VALUES 
                    ('Blandon Moreno Jose Lizandro', CAST(1 AS BOOLEAN)), ('Cruz Pinto Alberto', CAST(1 AS BOOLEAN)), ('Enrique Muñoz Hector Hilde', CAST(1 AS BOOLEAN)), ('Escobar Cardona John Fredy', CAST(1 AS BOOLEAN)),
                    ('Martinez Osorno Karen Lizeth', CAST(1 AS BOOLEAN)), ('Millan Salazar Magaly', CAST(1 AS BOOLEAN)), ('Moreno Mendez Angel Julio', CAST(1 AS BOOLEAN)), ('Moreno Urrea Marlene', CAST(1 AS BOOLEAN)),
                    ('Motta Talaga Leidy Jhoanna', CAST(1 AS BOOLEAN)), ('Obando Higuita Jose Luis', CAST(1 AS BOOLEAN)), ('Ramirez Romero Andres Mauricio', CAST(1 AS BOOLEAN)), ('Sarmiento Rincon Yhan Otoniel', CAST(1 AS BOOLEAN)),
                    ('Velez Arana Robert De Jesus', CAST(1 AS BOOLEAN)), ('Perdomo Rincon Gustavo Adolfo', CAST(1 AS BOOLEAN)), ('Moriano Chiguas Yurde Arley', CAST(1 AS BOOLEAN)), ('Bedoya Maria Fernanda', CAST(1 AS BOOLEAN)),
                    ('Morales Grueso Claudia Patricia', CAST(1 AS BOOLEAN)), ('Gomez Ruiz William Hernan', CAST(1 AS BOOLEAN)), ('Rodriguez Castaño Maria Alejandra', CAST(1 AS BOOLEAN)), ('Rojas Collazos Joan Mauricio', CAST(1 AS BOOLEAN)),
                    ('Riascos Castillo Andres Felipe', CAST(1 AS BOOLEAN)), ('Roldan Barona Erik Esteban', CAST(1 AS BOOLEAN)), ('Renteria Mejia Nestor Alfonso', CAST(1 AS BOOLEAN)), ('Mina Sinisterra Jhon Jairo', CAST(1 AS BOOLEAN)),
                    ('Valencia Mirquez Nicol', CAST(1 AS BOOLEAN)), ('Uran Quintero Yohao Alexander', CAST(1 AS BOOLEAN)), ('Preciado Rivas Johan Alexander', CAST(1 AS BOOLEAN)), ('Jose Fernando Ruiz', CAST(1 AS BOOLEAN))
                ) AS v(""Nombre"", ""Estado"")
                WHERE NOT EXISTS (SELECT 1 FROM ""Usuarios"");
            ");
            Console.WriteLine("[DB INIT] Usuarios checked/created.");
        }
        catch (Exception ex) { Log($"Usuarios Error: {ex.Message}"); }

        // MAQUINAS
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Maquinas"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""MetaRendimiento"" INTEGER NOT NULL DEFAULT 0,
                    ""MetaDesperdicio"" DECIMAL(5,4) NOT NULL DEFAULT 0,
                    ""ValorPorTiro"" DECIMAL(10,2) NOT NULL DEFAULT 0,
                    ""TirosReferencia"" INTEGER NOT NULL DEFAULT 0,
                    ""SemaforoMin"" INTEGER NOT NULL DEFAULT 0,
                    ""SemaforoNormal"" INTEGER NOT NULL DEFAULT 0,
                    ""SemaforoMax"" INTEGER NOT NULL DEFAULT 0,
                    ""Activa"" BOOLEAN DEFAULT TRUE
                );

                INSERT INTO ""Maquinas"" (""Nombre"", ""MetaRendimiento"", ""MetaDesperdicio"", ""ValorPorTiro"", ""TirosReferencia"", ""SemaforoMin"", ""SemaforoNormal"", ""SemaforoMax"", ""Activa"")
                SELECT * FROM (VALUES
                    ('CONVERTIDORA 1A', 15000, 0.25, 5, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('CONVERTIDORA 1B', 15000, 0.25, 5, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('Guillotina 2A polar132', 30000, 0.25, 2, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('Guillotina 2B org- Perfecta 107', 30000, 0.25, 2, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('3 Sord Z', 15000, 0.25, 5, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('4 Sord Z', 15000, 0.25, 5, 2000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('5 Sord Z', 15000, 0.25, 5, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('6 SpeedMaster', 15000, 0.25, 5, 3000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('7 SpeedMaster', 22500, 0.25, 5, 3000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('8A Troqueladora de Papel', 7500, 0.25, 10, 1000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('8B Troqueladora de Papel', 7500, 0.25, 10, 1000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('8C Estampadora', 6000, 0.25, 12, 1500, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('9 Troqueladora Rollo', 15000, 0.25, 5, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('10A Colaminadora Carton', 7500, 0.07, 10, 500, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('10B Colaminadora Carton', 6000, 0.03, 12, 400, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('11 Laminadora BOPP', 7500, 0.25, 10, 1000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('16 Barnizadora UV', 7500, 0.25, 10, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('13A Corrugadora FLTE', 2250, 0.25, 40, 2000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('13b Corrugadora FLTB', 2250, 0.25, 35, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('14 Pegadora de Cajas', 75000, 0.07, 1, 40000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('15 Troqueladora Kirby', 1500, 0.25, 40, 1250, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('12 Maquina de Cordon', 2100, 0.25, 10, 2000, 0, 0, 0, CAST(1 AS BOOLEAN)),
                    ('12 Cortadora de Manijas', 9000, 0.25, 5, 2000, 0, 0, 0, CAST(1 AS BOOLEAN))
                ) AS v(""Nombre"", ""MetaRendimiento"", ""MetaDesperdicio"", ""ValorPorTiro"", ""TirosReferencia"", ""SemaforoMin"", ""SemaforoNormal"", ""SemaforoMax"", ""Activa"")
                WHERE NOT EXISTS (SELECT 1 FROM ""Maquinas"");
            ");
            Console.WriteLine("[DB INIT] Maquinas checked/created.");
        }
        catch (Exception ex) { Log($"Maquinas Error: {ex.Message}"); }

        // ACTIVIDADES
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Actividades"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Codigo"" TEXT NOT NULL,
                    ""Nombre"" TEXT NOT NULL,
                    ""EsProductiva"" BOOLEAN NOT NULL,
                    ""Orden"" INTEGER NOT NULL,
                    ""Observaciones"" TEXT NULL
                );

                INSERT INTO ""Actividades"" (""Codigo"", ""Nombre"", ""EsProductiva"", ""Orden"", ""Observaciones"")
                SELECT * FROM (VALUES
                    ('01', 'Puesta a Punto', CAST(0 AS BOOLEAN), 1, 'Preparación inicial de la máquina'),
                    ('02', 'Producción', CAST(1 AS BOOLEAN), 2, 'Tiempo productivo de operación'),
                    ('03', 'Reparación', CAST(0 AS BOOLEAN), 3, 'Reparación de fallas o averías'),
                    ('04', 'Descanso', CAST(0 AS BOOLEAN), 4, 'Tiempo de descanso programado'),
                    ('08', 'Otro Tiempo Muerto', CAST(0 AS BOOLEAN), 5, 'Falta de Material, Imprevistos'),
                    ('10', 'Mantenimiento y Aseo', CAST(0 AS BOOLEAN), 6, 'Mantenimiento preventivo'),
                    ('13', 'Falta de Trabajo', CAST(0 AS BOOLEAN), 7, 'Sin órdenes asignadas'),
                    ('14', 'Otros tiempos', CAST(0 AS BOOLEAN), 8, 'Calibración, cambios, reunion')
                ) AS v(""Codigo"", ""Nombre"", ""EsProductiva"", ""Orden"", ""Observaciones"")
                WHERE NOT EXISTS (SELECT 1 FROM ""Actividades"");
            ");
            Console.WriteLine("[DB INIT] Actividades checked/created.");
        }
        catch (Exception ex) { Log($"Actividades Error: {ex.Message}"); }

        // ORDENES
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""OrdenesProduccion"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Numero"" TEXT NOT NULL,
                    ""Descripcion"" TEXT NOT NULL,
                    ""Estado"" TEXT NOT NULL,
                    ""FechaCreacion"" TIMESTAMP NOT NULL
                );

                INSERT INTO ""OrdenesProduccion"" (""Numero"", ""Descripcion"", ""Estado"", ""FechaCreacion"")
                SELECT 'OP-2024-001', 'Producción General', 'EnProceso', CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM ""OrdenesProduccion"");
            ");
            Console.WriteLine("[DB INIT] OrdenesProduccion checked/created.");
        }
        catch (Exception ex) { Log($"OrdenesProduccion Error: {ex.Message}"); }

        // TIEMPO PROCESOS
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""TiempoProcesos"" (
                    ""Id"" BIGSERIAL PRIMARY KEY,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""HoraInicio"" TIME NOT NULL,
                    ""HoraFin"" TIME NOT NULL,
                    ""Duracion"" TIME NOT NULL,
                    ""UsuarioId"" INTEGER NOT NULL,
                    ""MaquinaId"" INTEGER NOT NULL,
                    ""OrdenProduccionId"" INTEGER NULL,
                    ""ActividadId"" INTEGER NOT NULL,
                    ""Tiros"" INTEGER NOT NULL,
                    ""Desperdicio"" INTEGER NOT NULL,
                    ""Observaciones"" TEXT NULL,
                    CONSTRAINT ""FK_TiempoProcesos_Actividades_ActividadId"" FOREIGN KEY (""ActividadId"") REFERENCES ""Actividades"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TiempoProcesos_Maquinas_MaquinaId"" FOREIGN KEY (""MaquinaId"") REFERENCES ""Maquinas"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TiempoProcesos_OrdenesProduccion_OrdenProduccionId"" FOREIGN KEY (""OrdenProduccionId"") REFERENCES ""OrdenesProduccion"" (""Id""),
                    CONSTRAINT ""FK_TiempoProcesos_Usuarios_UsuarioId"" FOREIGN KEY (""UsuarioId"") REFERENCES ""Usuarios"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_TiempoProcesos_ActividadId"" ON ""TiempoProcesos"" (""ActividadId"");
                CREATE INDEX IF NOT EXISTS ""IX_TiempoProcesos_UsuarioId"" ON ""TiempoProcesos"" (""UsuarioId"");
            ");
            Console.WriteLine("[DB INIT] TiempoProcesos checked/created.");
        }
        catch (Exception ex) { Log($"TiempoProcesos Error: {ex.Message}"); }
        
        // PRODUCCION DIARIA (Verificación de existencia)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""ProduccionDiaria"" (
                    ""Id"" BIGSERIAL PRIMARY KEY,
                    ""Fecha"" DATE NOT NULL,
                    ""UsuarioId"" INTEGER NOT NULL,
                    ""MaquinaId"" INTEGER NOT NULL,
                    ""HoraInicio"" TIME NULL,
                    ""HoraFin"" TIME NULL,
                    ""HorasOperativas"" DECIMAL(10, 2) NOT NULL,
                    ""RendimientoFinal"" DECIMAL(10, 2) NOT NULL,
                    ""Cambios"" INTEGER NOT NULL,
                    ""TiempoPuestaPunto"" DECIMAL(10, 2) NOT NULL,
                    ""TirosDiarios"" INTEGER NOT NULL,
                    ""TotalHorasProductivas"" DECIMAL(10, 2) NOT NULL,
                    ""PromedioHoraProductiva"" DECIMAL(10, 2) NOT NULL,
                    ""ValorTiroSnapshot"" DECIMAL(10, 2) NOT NULL,
                    ""ValorAPagar"" DECIMAL(10, 2) NOT NULL,
                    ""HorasMantenimiento"" DECIMAL(10, 2) NOT NULL,
                    ""HorasDescanso"" DECIMAL(10, 2) NOT NULL,
                    ""HorasOtrosAux"" DECIMAL(10, 2) NOT NULL,
                    ""TotalHorasAuxiliares"" DECIMAL(10, 2) NOT NULL,
                    ""TiempoFaltaTrabajo"" DECIMAL(10, 2) NOT NULL,
                    ""TiempoReparacion"" DECIMAL(10, 2) NOT NULL,
                    ""TiempoOtroMuerto"" DECIMAL(10, 2) NOT NULL,
                    ""TotalTiemposMuertos"" DECIMAL(10, 2) NOT NULL,
                    ""TotalHoras"" DECIMAL(10, 2) NOT NULL,
                    ""ReferenciaOP"" VARCHAR(50) NULL,
                    ""Novedades"" TEXT NULL,
                    ""Desperdicio"" DECIMAL(10, 2) NOT NULL,
                    ""DiaLaborado"" INTEGER NOT NULL,
                    ""EsHorarioLaboral"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""TirosBonificables"" INTEGER NOT NULL DEFAULT 0,
                    ""DesperdicioBonificable"" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    ""ValorAPagarBonificable"" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    CONSTRAINT ""FK_ProduccionDiaria_Maquinas_MaquinaId"" FOREIGN KEY (""MaquinaId"") REFERENCES ""Maquinas"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_ProduccionDiaria_Usuarios_UsuarioId"" FOREIGN KEY (""UsuarioId"") REFERENCES ""Usuarios"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_ProduccionDiaria_MaquinaId"" ON ""ProduccionDiaria"" (""MaquinaId"");
                CREATE INDEX IF NOT EXISTS ""IX_ProduccionDiaria_UsuarioId"" ON ""ProduccionDiaria"" (""UsuarioId"");

                -- Add missing columns using IF NOT EXISTS
                ALTER TABLE ""ProduccionDiaria"" ADD COLUMN IF NOT EXISTS ""EsHorarioLaboral"" BOOLEAN NOT NULL DEFAULT TRUE;
                ALTER TABLE ""ProduccionDiaria"" ADD COLUMN IF NOT EXISTS ""TirosBonificables"" INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE ""ProduccionDiaria"" ADD COLUMN IF NOT EXISTS ""DesperdicioBonificable"" DECIMAL(10, 2) NOT NULL DEFAULT 0;
                ALTER TABLE ""ProduccionDiaria"" ADD COLUMN IF NOT EXISTS ""ValorAPagarBonificable"" DECIMAL(10, 2) NOT NULL DEFAULT 0;
            ");
            Console.WriteLine("[DB INIT] ProduccionDiaria checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] ProduccionDiaria: {ex.Message}"); }

        // CALIFICACIONES MENSUALES (para historial de calificaciones de planta)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""CalificacionesMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Mes"" INTEGER NOT NULL,
                    ""Anio"" INTEGER NOT NULL,
                    ""CalificacionTotal"" DECIMAL(10, 2) NOT NULL DEFAULT 0,
                    ""FechaCalculo"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""Notas"" VARCHAR(500) NULL,
                    ""DesgloseMaquinas"" TEXT NULL,
                    CONSTRAINT ""UQ_CalificacionesMensuales_MesAnio"" UNIQUE (""Mes"", ""Anio"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_CalificacionesMensuales_Anio"" ON ""CalificacionesMensuales"" (""Anio"" DESC, ""Mes"" DESC);
            ");
            Console.WriteLine("[DB INIT] CalificacionesMensuales checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] CalificacionesMensuales: {ex.Message}"); }

        // ENCUESTAS DE CALIDAD
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""EncuestasCalidad"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""OperarioId"" INTEGER NOT NULL,
                    ""AuxiliarId"" INTEGER NULL,
                    ""OrdenProduccion"" VARCHAR(50) NOT NULL,
                    ""CantidadProducir"" DECIMAL(18, 2) NOT NULL,
                    ""MaquinaId"" INTEGER NOT NULL,
                    ""Proceso"" VARCHAR(100) NOT NULL,
                    ""CantidadEvaluada"" DECIMAL(18, 2) NOT NULL,
                    ""EstadoProceso"" VARCHAR(50) NOT NULL,
                    ""TieneFichaTecnica"" BOOLEAN NOT NULL,
                    ""CorrectoRegistroFormatos"" BOOLEAN NOT NULL,
                    ""AprobacionArranque"" BOOLEAN NOT NULL,
                    ""Observacion"" TEXT NULL,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CreadoPor"" VARCHAR(100) NULL,
                    CONSTRAINT ""FK_EncuestasCalidad_Operario"" FOREIGN KEY (""OperarioId"") REFERENCES ""Usuarios""(""Id""),
                    CONSTRAINT ""FK_EncuestasCalidad_Auxiliar"" FOREIGN KEY (""AuxiliarId"") REFERENCES ""Usuarios""(""Id""),
                    CONSTRAINT ""FK_EncuestasCalidad_Maquina"" FOREIGN KEY (""MaquinaId"") REFERENCES ""Maquinas""(""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_EncuestasCalidad_FechaCreacion"" ON ""EncuestasCalidad"" (""FechaCreacion"" DESC);
            ");
            Console.WriteLine("[DB INIT] EncuestasCalidad checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] EncuestasCalidad: {ex.Message}"); }

        // ENCUESTA NOVEDADES
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""EncuestaNovedades"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""EncuestaId"" INTEGER NOT NULL,
                    ""TipoNovedad"" VARCHAR(100) NOT NULL,
                    ""FotoPath"" VARCHAR(500) NULL,
                    ""Descripcion"" TEXT NULL,
                    ""CantidadDefectuosa"" INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT ""FK_EncuestaNovedades_Encuesta"" FOREIGN KEY (""EncuestaId"") REFERENCES ""EncuestasCalidad""(""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_EncuestaNovedades_EncuestaId"" ON ""EncuestaNovedades"" (""EncuestaId"");

                -- Add missing columns
                ALTER TABLE ""EncuestaNovedades"" ADD COLUMN IF NOT EXISTS ""CantidadDefectuosa"" INTEGER NOT NULL DEFAULT 0;
            ");
            Console.WriteLine("[DB INIT] EncuestaNovedades checked/created.");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] EncuestaNovedades: {ex.Message}"); }

        // ADMIN USUARIOS (Auth Profesional)
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""AdminUsuarios"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Username"" VARCHAR(100) NOT NULL,
                    ""PasswordHash"" TEXT NOT NULL,
                    ""Role"" VARCHAR(50) NOT NULL,
                    ""NombreMostrar"" VARCHAR(200) NOT NULL,
                    CONSTRAINT ""UQ_AdminUsuarios_Username"" UNIQUE (""Username"")
                );
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

        // TALLERES Y DESPACHOS
        try
        {
            Console.WriteLine("[DB DEBUG] Creating Talleres tables...");
            
            // Talleres_Rubros
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Talleres_Rubros"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
            ");
            Console.WriteLine("[DB INIT] Talleres_Rubros created.");

            // Talleres_Proveedores
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Talleres_Proveedores"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""NitCedula"" VARCHAR(50) NOT NULL,
                    ""Telefono"" VARCHAR(50) NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
            ");
            Console.WriteLine("[DB INIT] Talleres_Proveedores created.");

            // Talleres_Gastos
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Talleres_Gastos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER NOT NULL REFERENCES ""Talleres_Proveedores""(""Id""),
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Talleres_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""NumeroFactura"" VARCHAR(100) NOT NULL,
                    ""Precio"" DECIMAL(18,2) NOT NULL,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""Observaciones"" VARCHAR(500) NULL
                );
            ");
            Console.WriteLine("[DB INIT] Talleres_Gastos created.");

            // Talleres_PresupuestosMensuales
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Talleres_PresupuestosMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Talleres_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""Presupuesto"" DECIMAL(18,2) NOT NULL,
                    UNIQUE(""RubroId"", ""Anio"", ""Mes"")
                );
            ");
            Console.WriteLine("[DB INIT] Talleres_PresupuestosMensuales created.");

            // Seed default rubros
            if (!context.Talleres_Rubros.Any())
            {
                var rubros = new List<TiempoProcesos.API.Models.Talleres_Rubro>
                {
                    new() { Nombre = "Transporte hacia talleres" },
                    new() { Nombre = "Transporte al aeropuerto" },
                    new() { Nombre = "Transporte adicional" },
                    new() { Nombre = "Acompañamiento" },
                    new() { Nombre = "Transporte por temas de calidad" },
                    new() { Nombre = "Estibas plásticas para despacho" }
                };
                context.Talleres_Rubros.AddRange(rubros);
                context.SaveChanges();
                Console.WriteLine("[DB INIT] Talleres_Rubros seeded with 6 default rubros.");
            }
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] Talleres Tables: {ex.Message}"); }
    }
}
