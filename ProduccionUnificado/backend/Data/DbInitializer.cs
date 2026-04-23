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
