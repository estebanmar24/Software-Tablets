using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Data;

public static class DbInitializer
{
    public static void Initialize(AppDbContext context)
    {
        context.Database.EnsureCreated();

        // TALLERES EXTERNOS
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""TalleresExternos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS ""EncuestasCalidadTalleres"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TallerId"" INTEGER NOT NULL REFERENCES ""TalleresExternos""(""Id"") ON DELETE RESTRICT,
                    ""HoraLlegada"" TEXT NOT NULL,
                    ""HoraSalida"" TEXT NOT NULL,
                    ""OrdenProduccion"" TEXT NOT NULL,
                    ""NumeroRemision"" TEXT NOT NULL,
                    ""CantidadProducir"" DECIMAL(18,2) NOT NULL,
                    ""CantidadEvaluada"" DECIMAL(18,2) NOT NULL,
                    ""EstadoProceso"" TEXT NOT NULL,
                    ""UsuarioId"" INTEGER NOT NULL REFERENCES ""Usuarios""(""Id"") ON DELETE RESTRICT,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            ");
            Console.WriteLine("[DB INIT] Taller tables checked/created.");

            // ALTER TABLE to add missing columns if any
            var sqlAlterEncuestas = @"
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='EncuestasCalidadTalleres' AND column_name='TieneMuestra') THEN
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""TieneMuestra"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""TipoProducto"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""ConoceFormaEmpaque"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""TieneRemision"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""TieneInsumosCompletos"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""VariacionTono"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoVariacionTono"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""QuebradoArrugado"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoQuebradoArrugado"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""EsquinaDefectuosa"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoEsquinaDefectuosa"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""PresenciaPestanas"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoPresenciaPestanas"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""DesgasteImpresion"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoDesgasteImpresion"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""Manchas"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoManchas"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""ReservaPega"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoReservaPega"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""GrafadoRoto"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoGrafadoRoto"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""NovedadBPM"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoNovedadBPM"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""UsaCofia"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""FotoUsaCofia"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""InsumosPendientes"" BOOLEAN NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""TipoInsumosPendientes"" TEXT;
                        ALTER TABLE ""EncuestasCalidadTalleres"" ADD COLUMN ""Observaciones"" TEXT;
                    END IF;
                END $$;
            ";
            context.Database.ExecuteSqlRaw(sqlAlterEncuestas);

            // Seeding Talleres (ASCII Cleaned names)
            if (!context.TalleresExternos.Any())
            {
                var talleresInitial = new List<string> {
                    "ANDREA HERNANDEZ", "ELIZABETH MOSQUERA", "JANETH OSORNO", "JANID RENGIFO",
                    "LILIANA ALQUEDAN", "LILIANA NIETO", "LILIANA REYES", "LILIBETH PIEDRAHITA",
                    "LUZ IRMA MORENO", "MARIA ELSY ROBAYO", "MARIELA QUINTERO", "MEIDY PENA",
                    "NATHALIA SALAMANKA", "OSCAR ZAPATA", "STHER POLANCO", "CARMEN QUINONEZ",
                    "YURANI RIOS ROBAYO", "ZENAIDA CASTILLO", "CONSUELO BENITEZ", "MAGALI",
                    "ANA OROZCO", "ELEONORA MIRQUEZ", "LUZ MARINA", "PATRICIA PINEDA",
                    "WILLIAM MUNERA", "CLAUDIA PATRICIA MORALES", "MABEL GIRONZA"
                };

                foreach (var nombre in talleresInitial)
                {
                    context.TalleresExternos.Add(new TallerExterno { Nombre = nombre });
                }
                context.SaveChanges();
            }
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] TalleresExternos: {ex.Message}"); }

        // HOJA DE VIDA MAQUINAS
        try
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""HojasVidaMaquinas"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""NumeroInventario"" TEXT,
                    ""Marca"" TEXT,
                    ""Serie"" TEXT,
                    ""Modelo"" TEXT,
                    ""Color"" TEXT,
                    ""FechaCompra"" TIMESTAMP,
                    ""VidaUtil"" TEXT,
                    ""FotoUrl"" TEXT,
                    ""EppsYRiesgos"" TEXT,
                    ""Senalizacion"" TEXT,
                    ""RiesgosAsociados"" TEXT,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""FechaRegistro"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""CodigoFormato"" TEXT NOT NULL DEFAULT 'FO-GM-001',
                    ""VersionFormato"" TEXT NOT NULL DEFAULT '0'
                );

                CREATE TABLE IF NOT EXISTS ""MantenimientosHojaVida"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""HojaVidaId"" INTEGER NOT NULL REFERENCES ""HojasVidaMaquinas""(""Id"") ON DELETE CASCADE,
                    ""TipoMantenimiento"" TEXT NOT NULL,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""EjecutadoPor"" TEXT,
                    ""Observacion"" TEXT,
                    ""Consecutivo"" INTEGER NOT NULL DEFAULT 0,
                    ""FechaRegistro"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS ""HojaVidaFotos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""HojaVidaId"" INTEGER NOT NULL REFERENCES ""HojasVidaMaquinas""(""Id"") ON DELETE CASCADE,
                    ""Url"" TEXT NOT NULL,
                    ""FechaRegistro"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS ""Cronogramas_Actividades"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Operacion"" TEXT NOT NULL,
                    ""Categoria"" TEXT DEFAULT 'General',
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );

                CREATE TABLE IF NOT EXISTS ""Cronogramas_Registros"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""HojaVidaId"" INTEGER NOT NULL REFERENCES ""HojasVidaMaquinas""(""Id"") ON DELETE CASCADE,
                    ""ActividadId"" INTEGER NOT NULL REFERENCES ""Cronogramas_Actividades""(""Id"") ON DELETE CASCADE,
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""Estado"" INTEGER NOT NULL DEFAULT 0,
                    ""Nota"" TEXT
                );
            ");
            Console.WriteLine("[DB INIT] Hoja de Vida and Cronograma tables checked/created.");
            
            // PRODUCCION & TALLERES MANAGEMENT (GASTOS)
            // PRODUCCION & TALLERES MANAGEMENT (GASTOS)
            context.Database.ExecuteSqlRaw(@"
                -- TALLERES TABLES
                CREATE TABLE IF NOT EXISTS ""Talleres_Rubros"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS ""Talleres_Proveedores"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""NitCedula"" TEXT NOT NULL DEFAULT '',
                    ""Telefono"" TEXT,
                    ""PrecioCotizado"" DECIMAL(18,2),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""RubroId"" INTEGER REFERENCES ""Talleres_Rubros""(""Id"")
                );
                -- Garantizar columnas en Talleres_Proveedores si ya existe
                ALTER TABLE ""Talleres_Proveedores"" ADD COLUMN IF NOT EXISTS ""NitCedula"" TEXT DEFAULT '';
                ALTER TABLE ""Talleres_Proveedores"" ADD COLUMN IF NOT EXISTS ""PrecioCotizado"" DECIMAL(18,2);

                CREATE TABLE IF NOT EXISTS ""Talleres_Gastos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER REFERENCES ""Talleres_Proveedores""(""Id""),
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Talleres_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""NumeroFactura"" TEXT,
                    ""Precio"" DECIMAL(18,2) NOT NULL,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""Observaciones"" TEXT,
                    ""FacturaPdfUrl"" TEXT,
                    ""PersonalId"" INTEGER,
                    ""TipoHoraId"" INTEGER,
                    ""TipoRecargoId"" INTEGER,
                    ""CantidadHoras"" DECIMAL(18,2),
                    ""NumeroOP"" TEXT,
                    ""EsPendiente"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""EsSolicitudCredito"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""FechaModificacion"" TIMESTAMP,
                    ""CreadoPorId"" INTEGER
                );
                -- Garantizar columnas en Talleres_Gastos si ya existe
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""PersonalId"" INTEGER;
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""TipoHoraId"" INTEGER;
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""TipoRecargoId"" INTEGER;
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""CantidadHoras"" DECIMAL(18,2);
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""NumeroOP"" TEXT;
                ALTER TABLE ""Talleres_Gastos"" ADD COLUMN IF NOT EXISTS ""EsSolicitudCredito"" BOOLEAN DEFAULT FALSE;

                CREATE TABLE IF NOT EXISTS ""Talleres_PresupuestosMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Talleres_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""Presupuesto"" DECIMAL(18,2) NOT NULL
                );

                -- PRODUCCION TABLES
                CREATE TABLE IF NOT EXISTS ""Produccion_Rubros"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS ""Produccion_Proveedores"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Nit"" TEXT,
                    ""Telefono"" TEXT,
                    ""RubroId"" INTEGER REFERENCES ""Produccion_Rubros""(""Id""),
                    ""PrecioCotizado"" DECIMAL(18,2),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                -- Garantizar columnas en Produccion_Proveedores
                ALTER TABLE ""Produccion_Proveedores"" ADD COLUMN IF NOT EXISTS ""Telefono"" TEXT;
                ALTER TABLE ""Produccion_Proveedores"" ADD COLUMN IF NOT EXISTS ""RubroId"" INTEGER REFERENCES ""Produccion_Rubros""(""Id"");
                ALTER TABLE ""Produccion_Proveedores"" ADD COLUMN IF NOT EXISTS ""PrecioCotizado"" DECIMAL(18,2);

                CREATE TABLE IF NOT EXISTS ""Produccion_TiposHora"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Porcentaje"" DECIMAL(18,2) NOT NULL,
                    ""Factor"" DECIMAL(18,4) NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS ""Produccion_TiposRecargo"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Porcentaje"" DECIMAL(18,2) NOT NULL,
                    ""Factor"" DECIMAL(18,4) NOT NULL,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                CREATE TABLE IF NOT EXISTS ""Produccion_Productos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Nombre"" TEXT NOT NULL,
                    ""Referencia"" TEXT,
                    ""Descripcion"" TEXT,
                    ""RubroId"" INTEGER REFERENCES ""Produccion_Rubros""(""Id""),
                    ""Medida"" TEXT,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                -- Garantizar columnas en Produccion_Productos
                ALTER TABLE ""Produccion_Productos"" ADD COLUMN IF NOT EXISTS ""Referencia"" TEXT;
                ALTER TABLE ""Produccion_Productos"" ADD COLUMN IF NOT EXISTS ""Descripcion"" TEXT;
                ALTER TABLE ""Produccion_Productos"" ADD COLUMN IF NOT EXISTS ""Medida"" TEXT;

                CREATE TABLE IF NOT EXISTS ""Produccion_Gastos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Produccion_Rubros""(""Id""),
                    ""ProveedorId"" INTEGER REFERENCES ""Produccion_Proveedores""(""Id""),
                    ""UsuarioId"" INTEGER,
                    ""MaquinaId"" INTEGER,
                    ""TipoHoraId"" INTEGER REFERENCES ""Produccion_TiposHora""(""Id""),
                    ""TipoRecargoId"" INTEGER REFERENCES ""Produccion_TiposRecargo""(""Id""),
                    ""Precio"" DECIMAL(18,2) NOT NULL,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""Nota"" TEXT,
                    ""CantidadHoras"" DECIMAL(18,2),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""NumeroFactura"" TEXT,
                    ""FacturaPdfUrl"" TEXT,
                    ""NumeroOP"" TEXT,
                    ""EsPendiente"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""EsSolicitudCredito"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""FechaModificacion"" TIMESTAMP,
                    ""CreadoPorId"" INTEGER
                );
                -- Garantizar columnas en Produccion_Gastos
                ALTER TABLE ""Produccion_Gastos"" ADD COLUMN IF NOT EXISTS ""EsSolicitudCredito"" BOOLEAN DEFAULT FALSE;
                ALTER TABLE ""Produccion_Gastos"" ADD COLUMN IF NOT EXISTS ""NumeroOP"" TEXT;

                CREATE TABLE IF NOT EXISTS ""Produccion_PresupuestosMensuales"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Produccion_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""Presupuesto"" DECIMAL(18,2) NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""Produccion_Cotizaciones"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER NOT NULL REFERENCES ""Produccion_Proveedores""(""Id""),
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Produccion_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""PrecioCotizado"" DECIMAL(18,2) NOT NULL,
                    ""FechaCotizacion"" TIMESTAMP NOT NULL,
                    ""Descripcion"" TEXT,
                    ""ProductoId"" INTEGER REFERENCES ""Produccion_Productos""(""Id""),
                    ""Cantidad"" DECIMAL(18,2),
                    ""ValorUnitario"" DECIMAL(18,2),
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );
                -- Garantizar columnas en Produccion_Cotizaciones
                ALTER TABLE ""Produccion_Cotizaciones"" ADD COLUMN IF NOT EXISTS ""ProductoId"" INTEGER REFERENCES ""Produccion_Productos""(""Id"");
                ALTER TABLE ""Produccion_Cotizaciones"" ADD COLUMN IF NOT EXISTS ""Cantidad"" DECIMAL(18,2);
                ALTER TABLE ""Produccion_Cotizaciones"" ADD COLUMN IF NOT EXISTS ""ValorUnitario"" DECIMAL(18,2);

                CREATE TABLE IF NOT EXISTS ""Talleres_Cotizaciones"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ProveedorId"" INTEGER NOT NULL REFERENCES ""Talleres_Proveedores""(""Id""),
                    ""RubroId"" INTEGER NOT NULL REFERENCES ""Talleres_Rubros""(""Id""),
                    ""Anio"" INTEGER NOT NULL,
                    ""Mes"" INTEGER NOT NULL,
                    ""PrecioCotizado"" DECIMAL(18,2) NOT NULL,
                    ""FechaCotizacion"" TIMESTAMP NOT NULL,
                    ""Descripcion"" TEXT,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE
                );

                -- Asegurar que existen Rubros base en Produccion_Rubros
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Recargo') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Recargo', true); END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Insumos') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Insumos', true); END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Mantenimiento') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Mantenimiento', true); END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Repuesto') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Repuesto', true); END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Salarios') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Salarios', true); END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""Produccion_Rubros"" WHERE ""Nombre"" = 'Horas Extras') THEN INSERT INTO ""Produccion_Rubros"" (""Nombre"", ""Activo"") VALUES ('Horas Extras', true); END IF;
                END $$;
            ");

            // Seed Produccion_TiposHora if empty
            if (!context.Produccion_TiposHora.Any())
            {
                context.Produccion_TiposHora.AddRange(new List<Produccion_TipoHora>
                {
                    new Produccion_TipoHora { Nombre = "Extra Diurna", Porcentaje = 25, Factor = 1.25m, Activo = true },
                    new Produccion_TipoHora { Nombre = "Extra Nocturna", Porcentaje = 75, Factor = 1.75m, Activo = true },
                    new Produccion_TipoHora { Nombre = "Dominical Diurna", Porcentaje = 100, Factor = 2.00m, Activo = true },
                    new Produccion_TipoHora { Nombre = "Dominical Nocturna", Porcentaje = 150, Factor = 2.50m, Activo = true }
                });
                context.SaveChanges();
            }

            // Seed Produccion_TiposRecargo if empty
            if (!context.Produccion_TiposRecargo.Any())
            {
                context.Produccion_TiposRecargo.AddRange(new List<Produccion_TipoRecargo>
                {
                    new Produccion_TipoRecargo { Nombre = "Recargo Nocturno", Porcentaje = 35, Factor = 0.35m, Activo = true },
                    new Produccion_TipoRecargo { Nombre = "Recargo Dominical/Festivo", Porcentaje = 75, Factor = 0.75m, Activo = true },
                    new Produccion_TipoRecargo { Nombre = "Recargo Nocturno Dominical", Porcentaje = 110, Factor = 1.10m, Activo = true }
                });
                context.SaveChanges();
            }

            // Asegurar columnas consecutivas
            context.Database.ExecuteSqlRaw(@"
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='MantenimientosHojaVida' AND column_name='Consecutivo') THEN
                        ALTER TABLE ""MantenimientosHojaVida"" ADD COLUMN ""Consecutivo"" INTEGER NOT NULL DEFAULT 0;
                    END IF;
                    -- Si existe tabla Tickets
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='Tickets') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Tickets' AND column_name='Consecutivo') THEN
                            ALTER TABLE ""Tickets"" ADD COLUMN ""Consecutivo"" INTEGER NOT NULL DEFAULT 0;
                        END IF;
                    END IF;
                END $$;
            ");
        }
        catch (Exception ex) { Console.WriteLine($"[DB ERROR] Tables Init: {ex.Message}"); }
    }
}
