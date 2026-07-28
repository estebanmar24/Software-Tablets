using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Data;

/// <summary>
/// Parches idempotentes al arranque. Cada sentencia en su propio try/catch para que
/// un fallo en otra migración manual no impida crear PrecioBase/PrecioIva (causa típica de HTTP 500 en /gastos).
/// </summary>
public static class StartupSchemaPatches
{
    public static void ApplyCriticalGastosColumns(AppDbContext context)
    {
        var sqls = new (string Label, string Sql)[]
        {
            ("Produccion_Gastos.EsEfectivo", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("Talleres_Gastos.EsEfectivo", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("Planeacion_Gastos.EsEfectivo", "ALTER TABLE \"Planeacion_Gastos\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("Mantenimiento_Gastos.EsEfectivo", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("Diseno_Gastos.EsEfectivo", "ALTER TABLE \"Diseno_Gastos\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("SST_GastosMensuales.EsEfectivo", "ALTER TABLE \"SST_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),
            ("GH_GastosMensuales.EsEfectivo", "ALTER TABLE \"GH_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"EsEfectivo\" boolean NOT NULL DEFAULT false;"),

            ("Produccion_Gastos.Estado", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("Talleres_Gastos.Estado", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("Planeacion_Gastos.Estado", "ALTER TABLE \"Planeacion_Gastos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("Mantenimiento_Gastos.Estado", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("Diseno_Gastos.Estado", "ALTER TABLE \"Diseno_Gastos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("GH_GastosMensuales.Estado", "ALTER TABLE \"GH_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),
            ("SST_GastosMensuales.Estado", "ALTER TABLE \"SST_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(50) NOT NULL DEFAULT 'Montado';"),

            ("Produccion_Gastos.PrecioBase", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("Produccion_Gastos.PrecioIva", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("Produccion_Gastos.HoraInicio", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraInicio\" character varying(8) NULL;"),
            ("Produccion_Gastos.HoraFin", "ALTER TABLE \"Produccion_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraFin\" character varying(8) NULL;"),
            ("Talleres_Gastos.PrecioBase", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("Talleres_Gastos.PrecioIva", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("Talleres_Gastos.HoraInicio", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraInicio\" character varying(8) NULL;"),
            ("Talleres_Gastos.HoraFin", "ALTER TABLE \"Talleres_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraFin\" character varying(8) NULL;"),
            ("Mantenimiento_Gastos.PrecioBase", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("Mantenimiento_Gastos.PrecioIva", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("Mantenimiento_Gastos.FechaEntregaFactura", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"FechaEntregaFactura\" timestamp without time zone NULL;"),
            ("Mantenimiento_Gastos.FechaVencimientoFactura", "ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"FechaVencimientoFactura\" timestamp without time zone NULL;"),
            ("Mantenimiento_Productos.TipoProducto", "ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"TipoProducto\" character varying(100) NULL;"),
            ("Mantenimiento_Productos.Stock", "ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"stock\" numeric(18,2) NOT NULL DEFAULT 0;"),
            ("Planeacion_Gastos.PrecioBase", "ALTER TABLE \"Planeacion_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("Planeacion_Gastos.PrecioIva", "ALTER TABLE \"Planeacion_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("Diseno_Gastos.PrecioBase", "ALTER TABLE \"Diseno_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("Diseno_Gastos.PrecioIva", "ALTER TABLE \"Diseno_Gastos\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("GH_GastosMensuales.PrecioBase", "ALTER TABLE \"GH_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("GH_GastosMensuales.PrecioIva", "ALTER TABLE \"GH_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
            ("SST_GastosMensuales.PrecioBase", "ALTER TABLE \"SST_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"PrecioBase\" numeric(18,2) NULL;"),
            ("SST_GastosMensuales.PrecioIva", "ALTER TABLE \"SST_GastosMensuales\" ADD COLUMN IF NOT EXISTS \"PrecioIva\" numeric(18,2) NULL;"),
        };

        Console.WriteLine("[STARTUP] Parches criticos de columnas de gastos (EsEfectivo, Estado, PrecioBase, PrecioIva)...");
        foreach (var (label, sql) in sqls)
        {
            try
            {
                context.Database.ExecuteSqlRaw(sql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] {label}: {ex.Message}");
            }
        }
        Console.WriteLine("[STARTUP] Parches críticos de gastos finalizados.");
    }

    public static void ApplyProveedorRubrosTables(AppDbContext context)
    {
        var tables = new[]
        {
            ("Produccion_ProveedorRubros", "Produccion_Proveedores", "Produccion_Rubros"),
            ("Talleres_ProveedorRubros", "Talleres_Proveedores", "Talleres_Rubros"),
            ("Planeacion_ProveedorRubros", "Planeacion_Proveedores", "Planeacion_Rubros"),
            ("Diseno_ProveedorRubros", "Diseno_Proveedores", "Diseno_Rubros"),
            ("Mantenimiento_ProveedorRubros", "Mantenimiento_Proveedores", "Mantenimiento_Rubros"),
        };

        Console.WriteLine("[STARTUP] Tablas ProveedorRubros (N:M)...");
        foreach (var (junction, proveedores, rubros) in tables)
        {
            try
            {
                context.Database.ExecuteSqlRaw($@"
CREATE TABLE IF NOT EXISTS ""{junction}"" (
    ""ProveedorId"" integer NOT NULL,
    ""RubroId"" integer NOT NULL,
    PRIMARY KEY (""ProveedorId"", ""RubroId""),
    CONSTRAINT ""FK_{junction}_Proveedor"" FOREIGN KEY (""ProveedorId"") REFERENCES ""{proveedores}"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_{junction}_Rubro"" FOREIGN KEY (""RubroId"") REFERENCES ""{rubros}"" (""Id"") ON DELETE RESTRICT
);");

                context.Database.ExecuteSqlRaw($@"
INSERT INTO ""{junction}"" (""ProveedorId"", ""RubroId"")
SELECT ""Id"", ""RubroId"" FROM ""{proveedores}""
WHERE ""RubroId"" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ""{junction}"" j
    WHERE j.""ProveedorId"" = ""{proveedores}"".""Id"" AND j.""RubroId"" = ""{proveedores}"".""RubroId""
  );");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] {junction}: {ex.Message}");
            }
        }
        Console.WriteLine("[STARTUP] Tablas ProveedorRubros listas.");
    }

    public static void ApplyConsolidadoNCColumns(AppDbContext context)
    {
        var sqls = new (string Label, string Sql)[]
        {
            ("EncuestasCalidadProduccion.Alcance", @"ALTER TABLE ""EncuestasCalidadProduccion"" ADD COLUMN IF NOT EXISTS ""Alcance"" text NULL;"),
            ("EncuestasCalidadProduccion.TipoReclamacion", @"ALTER TABLE ""EncuestasCalidadProduccion"" ADD COLUMN IF NOT EXISTS ""TipoReclamacion"" text NULL;"),
            ("ConsolidadosNC.Alcance", @"ALTER TABLE ""ConsolidadosNC"" ADD COLUMN IF NOT EXISTS ""Alcance"" text NULL;"),
            ("CalidadNC_TiposReclamacion", @"
CREATE TABLE IF NOT EXISTS ""CalidadNC_TiposReclamacion"" (
    ""Id"" serial PRIMARY KEY,
    ""Nombre"" character varying(120) NOT NULL,
    ""Activo"" boolean NOT NULL DEFAULT true
);"),
            ("CalidadNC_TiposReclamacion seed", @"
INSERT INTO ""CalidadNC_TiposReclamacion"" (""Nombre"", ""Activo"")
SELECT v.""Nombre"", true FROM (VALUES
    ('Queja'), ('Reclamo'), ('Devolución'), ('Otro')
) AS v(""Nombre"")
WHERE NOT EXISTS (
    SELECT 1 FROM ""CalidadNC_TiposReclamacion"" t WHERE LOWER(TRIM(t.""Nombre"")) = LOWER(TRIM(v.""Nombre""))
);"),
            ("ConsolidadosNC migrate Alcance", @"
UPDATE ""ConsolidadosNC""
SET ""Alcance"" = CASE
    WHEN UPPER(TRIM(COALESCE(""TipoReclamacion"", ''))) IN ('INTERNO', 'INTERNA', 'ALCANCE INTERNO') THEN 'Alcance interno'
    WHEN UPPER(TRIM(COALESCE(""TipoReclamacion"", ''))) IN ('EXTERNO', 'EXTERNA', 'ALCANCE EXTERNO') THEN 'Alcance externo'
    WHEN COALESCE(""Alcance"", '') = '' AND COALESCE(""TipoReclamacion"", '') <> '' THEN ""TipoReclamacion""
    ELSE ""Alcance""
END
WHERE COALESCE(""Alcance"", '') = ''
  AND COALESCE(""TipoReclamacion"", '') <> '';"),
            ("ConsolidadosNC clear legacy TipoReclamacion", @"
UPDATE ""ConsolidadosNC""
SET ""TipoReclamacion"" = NULL
WHERE UPPER(TRIM(COALESCE(""TipoReclamacion"", ''))) IN (
    'INTERNO', 'INTERNA', 'EXTERNO', 'EXTERNA',
    'ALCANCE INTERNO', 'ALCANCE EXTERNO', 'ALCANCE INTERNA', 'ALCANCE EXTERNA'
);"),
            ("ConsolidadosNC dedupe by encuesta", @"
DELETE FROM ""ConsolidadosNC"" a
USING ""ConsolidadosNC"" b
WHERE a.""EncuestaProduccionId"" = b.""EncuestaProduccionId""
  AND a.""Id"" < b.""Id"";"),
        };

        Console.WriteLine("[STARTUP] Parches Consolidado NC (Alcance, tipos reclamación)...");
        foreach (var (label, sql) in sqls)
        {
            try
            {
                context.Database.ExecuteSqlRaw(sql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] {label}: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Turno sábado 6:00–10:00 (código 5) para captura de tiempos en tablets.
    /// </summary>
    public static void ApplyHorarioSabado6a10(AppDbContext context)
    {
        const string sql = @"
INSERT INTO ""Horarios"" (""Codigo"", ""Nombre"", ""InicioSemana"", ""FinSemana"", ""InicioSabado"", ""FinSabado"", ""Activo"")
SELECT '5', '6am - 10am (sábado)', '06:00:00'::interval, '10:00:00'::interval, '06:00:00'::interval, '10:00:00'::interval, TRUE
WHERE NOT EXISTS (SELECT 1 FROM ""Horarios"" WHERE ""Codigo"" = '5');";

        try
        {
            context.Database.ExecuteSqlRaw(sql);
            Console.WriteLine("[STARTUP] Horario sábado 6am-10am (código 5) verificado.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Horario sábado 6am-10am: {ex.Message}");
        }
    }

    /// <summary>
    /// Turno tarde 13:00–21:00 (código 6) para captura de tiempos en tablets.
    /// </summary>
    public static void ApplyHorario1pm9pm(AppDbContext context)
    {
        const string sql = @"
INSERT INTO ""Horarios"" (""Codigo"", ""Nombre"", ""InicioSemana"", ""FinSemana"", ""InicioSabado"", ""FinSabado"", ""Activo"")
SELECT '6', '1pm - 9pm', '13:00:00'::interval, '21:00:00'::interval, '08:00:00'::interval, '12:00:00'::interval, TRUE
WHERE NOT EXISTS (SELECT 1 FROM ""Horarios"" WHERE ""Codigo"" = '6');";

        try
        {
            context.Database.ExecuteSqlRaw(sql);
            Console.WriteLine("[STARTUP] Horario 1pm-9pm (código 6) verificado.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Horario 1pm-9pm: {ex.Message}");
        }
    }

    public static void ApplyCatalogoOrdenProduccionTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Catalogo_OrdenProduccion"" (
    ""Id"" SERIAL PRIMARY KEY,
    ""Numero"" character varying(32) NOT NULL,
    ""Cliente"" character varying(300) NULL,
    ""Referencia"" character varying(500) NULL,
    ""CantidadPlanificada"" numeric(18,2) NOT NULL DEFAULT 0,
    ""Mes"" integer NOT NULL,
    ""Anio"" integer NOT NULL,
    ""Fuente"" character varying(20) NOT NULL DEFAULT 'Excel',
    ""FechaActualizacion"" timestamp without time zone NOT NULL DEFAULT NOW()
);";

        const string createIndex = @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_CatalogoOP_Numero_Mes_Anio""
    ON ""Catalogo_OrdenProduccion"" (""Numero"", ""Mes"", ""Anio"");";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            context.Database.ExecuteSqlRaw(createIndex);
            Console.WriteLine("[STARTUP] Tabla Catalogo_OrdenProduccion verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Catalogo_OrdenProduccion: {ex.Message}");
        }
    }

    public static void ApplyAdjuntoDocumentoExtraccionTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Adjunto_DocumentoExtraccion"" (
    ""Id"" SERIAL PRIMARY KEY,
    ""Numero"" character varying(32) NOT NULL,
    ""Tipo"" character varying(16) NOT NULL,
    ""ArchivoNombre"" character varying(260) NOT NULL,
    ""RutaRelativa"" character varying(500) NULL,
    ""Metodo"" character varying(32) NOT NULL DEFAULT 'PdfText',
    ""TextoCompleto"" text NOT NULL DEFAULT '',
    ""DatosJson"" text NOT NULL DEFAULT '{}',
    ""HashArchivo"" character varying(64) NULL,
    ""FechaExtraccion"" timestamp without time zone NOT NULL DEFAULT NOW(),
    ""ErrorExtraccion"" text NULL
);";

        const string createIndex = @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AdjuntoExtraccion_Numero_Tipo_Archivo""
    ON ""Adjunto_DocumentoExtraccion"" (""Numero"", ""Tipo"", ""ArchivoNombre"");";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            context.Database.ExecuteSqlRaw(createIndex);
            Console.WriteLine("[STARTUP] Tabla Adjunto_DocumentoExtraccion verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Adjunto_DocumentoExtraccion: {ex.Message}");
        }
    }

    public static void ApplyMantenimientoConsumosExtraColumns(AppDbContext context)
    {
        var sqls = new (string Label, string Sql)[]
        {
            ("Mantenimiento_Consumos.TipoMantenimiento", "ALTER TABLE \"Mantenimiento_Consumos\" ADD COLUMN IF NOT EXISTS \"tipomantenimiento\" character varying(100) NULL;"),
            ("Mantenimiento_Consumos.BitacoraId", "ALTER TABLE \"Mantenimiento_Consumos\" ADD COLUMN IF NOT EXISTS \"BitacoraId\" integer NULL;"),
            ("Mantenimiento_Consumos.ActividadesIds", "ALTER TABLE \"Mantenimiento_Consumos\" ADD COLUMN IF NOT EXISTS \"ActividadesIds\" text NULL;"),
            ("Mantenimiento_Consumos.HojaVidaId", "ALTER TABLE \"Mantenimiento_Consumos\" ADD COLUMN IF NOT EXISTS \"HojaVidaId\" integer NULL;"),
            ("Mantenimiento_Consumos.MantenimientoHojaVidaId", "ALTER TABLE \"Mantenimiento_Consumos\" ADD COLUMN IF NOT EXISTS \"MantenimientoHojaVidaId\" integer NULL;"),
        };
        foreach (var (label, sql) in sqls)
        {
            try { context.Database.ExecuteSqlRaw(sql); }
            catch (Exception ex) { Console.WriteLine($"[DB FIX] {label}: {ex.Message}"); }
        }
    }

    public static void ApplyMantenimientoAjustesInventarioTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Mantenimiento_AjustesInventario"" (
    ""Id"" serial PRIMARY KEY,
    ""productoid"" integer NOT NULL,
    ""Tipo"" character varying(20) NOT NULL DEFAULT 'ENTRADA',
    ""cantidad"" numeric(18,2) NOT NULL DEFAULT 0,
    ""Razon"" character varying(500) NOT NULL,
    ""Fecha"" timestamp without time zone NOT NULL,
    ""Activo"" boolean NOT NULL DEFAULT true,
    CONSTRAINT ""FK_Mantenimiento_Ajustes_Producto"" FOREIGN KEY (""productoid"") REFERENCES ""Mantenimiento_Productos"" (""Id"") ON DELETE RESTRICT
);";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            Console.WriteLine("[STARTUP] Tabla Mantenimiento_AjustesInventario verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Mantenimiento_AjustesInventario: {ex.Message}");
        }
    }

    /// <summary>Corrige gastos guardados sin Anio/Mes (no aparecían en listados ni contabilidad).</summary>
    public static void BackfillGastosAnioMesDesdeFecha(AppDbContext context)
    {
        var tables = new (string Table, string DateCol)[]
        {
            ("Planeacion_Gastos", "Fecha"),
            ("Produccion_Gastos", "Fecha"),
            ("Talleres_Gastos", "Fecha"),
            ("Diseno_Gastos", "Fecha"),
            ("Mantenimiento_Gastos", "Fecha"),
            ("GH_GastosMensuales", "FechaCompra"),
            ("SST_GastosMensuales", "FechaCompra"),
            ("Contabilidad_Gastos", "Fecha"),
        };

        Console.WriteLine("[STARTUP] Backfill Anio/Mes en gastos desde fecha...");
        foreach (var (table, dateCol) in tables)
        {
            var sql = $@"
UPDATE ""{table}""
SET ""Anio"" = EXTRACT(YEAR FROM ""{dateCol}"")::int,
    ""Mes"" = EXTRACT(MONTH FROM ""{dateCol}"")::int
WHERE ""Mes"" IS DISTINCT FROM EXTRACT(MONTH FROM ""{dateCol}"")::int
   OR ""Anio"" IS DISTINCT FROM EXTRACT(YEAR FROM ""{dateCol}"")::int
   OR ""Anio"" IS NULL OR ""Anio"" <= 0 OR ""Mes"" IS NULL OR ""Mes"" < 1 OR ""Mes"" > 12;";
            try
            {
                var n = context.Database.ExecuteSqlRaw(sql);
                if (n > 0) Console.WriteLine($"[STARTUP] {table}: {n} filas actualizadas (Anio/Mes).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] Backfill {table}: {ex.Message}");
            }
        }
    }

    public static void ApplyRegistroDesperdicioRegistradoPorColumn(AppDbContext context)
    {
        const string sql = @"ALTER TABLE ""RegistrosDesperdicio"" ADD COLUMN IF NOT EXISTS ""RegistradoPor"" character varying(120) NULL;";
        try
        {
            context.Database.ExecuteSqlRaw(sql);
            Console.WriteLine("[STARTUP] Columna RegistrosDesperdicio.RegistradoPor verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] RegistrosDesperdicio.RegistradoPor: {ex.Message}");
        }
    }

    public static void ApplyAlmacenTables(AppDbContext context)
    {
        var sqls = new (string Label, string Sql)[]
        {
            ("Almacen_Productos", @"
CREATE TABLE IF NOT EXISTS ""Almacen_Productos"" (
    ""Id"" serial PRIMARY KEY,
    ""Nombre"" character varying(200) NOT NULL,
    ""TipoRequisicionId"" character varying(50) NOT NULL,
    ""UnidadSugerida"" character varying(30) NULL,
    ""Activo"" boolean NOT NULL DEFAULT true
);"),
            ("Almacen_Productos.Descripcion", @"
ALTER TABLE ""Almacen_Productos"" ADD COLUMN IF NOT EXISTS ""Descripcion"" character varying(500) NULL;"),
            ("Almacen_Productos.CostoEstandar", @"
ALTER TABLE ""Almacen_Productos"" ADD COLUMN IF NOT EXISTS ""CostoEstandar"" numeric(18,2) NULL;"),
            ("Almacen_Proveedores", @"
CREATE TABLE IF NOT EXISTS ""Almacen_Proveedores"" (
    ""Id"" serial PRIMARY KEY,
    ""Nombre"" character varying(200) NOT NULL,
    ""Nit"" character varying(50) NOT NULL DEFAULT '',
    ""Telefono"" character varying(50) NOT NULL DEFAULT '',
    ""Activo"" boolean NOT NULL DEFAULT true
);"),
            ("Almacen_Proveedores.Correo", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""Correo"" character varying(200) NULL;"),
            ("Almacen_Proveedores.TelefonoTrabajo", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""TelefonoTrabajo"" character varying(50) NULL;"),
            ("Almacen_Proveedores.TelefonoMovil", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""TelefonoMovil"" character varying(50) NULL;"),
            ("Almacen_Proveedores.Direccion", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""Direccion"" character varying(500) NULL;"),
            ("Almacen_Proveedores.Categoria", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""Categoria"" character varying(50) NULL;"),
            ("Almacen_Proveedores.ResponsableIva", @"
ALTER TABLE ""Almacen_Proveedores"" ADD COLUMN IF NOT EXISTS ""ResponsableIva"" boolean NOT NULL DEFAULT false;"),
            ("Almacen_Requisiciones", @"
CREATE TABLE IF NOT EXISTS ""Almacen_Requisiciones"" (
    ""Id"" serial PRIMARY KEY,
    ""Codigo"" character varying(20) NOT NULL,
    ""TipoRequisicionId"" character varying(50) NOT NULL,
    ""FechaSolicitud"" timestamp without time zone NOT NULL,
    ""OrdenProduccionNumero"" character varying(50) NOT NULL,
    ""CatalogoOpId"" integer NULL,
    ""Cliente"" character varying(300) NOT NULL DEFAULT '',
    ""Referencia"" character varying(500) NOT NULL DEFAULT '',
    ""ProductoId"" integer NULL,
    ""ProductoNombre"" character varying(200) NOT NULL,
    ""Cantidad"" numeric(18,2) NOT NULL DEFAULT 0,
    ""Unidad"" character varying(30) NOT NULL,
    ""FechaRequerida"" timestamp without time zone NOT NULL,
    ""Observacion"" text NULL,
    ""Estado"" character varying(20) NOT NULL DEFAULT 'Pendiente',
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT ""FK_Almacen_Requisiciones_Producto"" FOREIGN KEY (""ProductoId"") REFERENCES ""Almacen_Productos"" (""Id"") ON DELETE SET NULL,
    CONSTRAINT ""FK_Almacen_Requisiciones_CatalogoOP"" FOREIGN KEY (""CatalogoOpId"") REFERENCES ""Catalogo_OrdenProduccion"" (""Id"") ON DELETE SET NULL
);"),
            ("Almacen_Requisiciones.Codigo unique", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_Requisiciones_Codigo"" ON ""Almacen_Requisiciones"" (""Codigo"");"),
            ("Almacen_Pedidos", @"
CREATE TABLE IF NOT EXISTS ""Almacen_Pedidos"" (
    ""Id"" serial PRIMARY KEY,
    ""RequisicionId"" integer NOT NULL,
    ""FechaPedido"" timestamp without time zone NOT NULL,
    ""FechaEntregaEstimada"" timestamp without time zone NULL,
    CONSTRAINT ""FK_Almacen_Pedidos_Requisicion"" FOREIGN KEY (""RequisicionId"") REFERENCES ""Almacen_Requisiciones"" (""Id"") ON DELETE CASCADE
);"),
            ("Almacen_Pedidos.RequisicionId unique", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_Pedidos_RequisicionId"" ON ""Almacen_Pedidos"" (""RequisicionId"");"),
            ("Almacen_Pedidos.PrecioUnitario", @"
ALTER TABLE ""Almacen_Pedidos"" ADD COLUMN IF NOT EXISTS ""PrecioUnitario"" numeric(18,2) NULL;"),
            ("Almacen_PedidoProveedores.PrecioUnitario", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""PrecioUnitario"" numeric(18,2) NULL;"),
            ("Almacen_PedidoProveedores.PrecioEspecial", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""PrecioEspecial"" boolean NOT NULL DEFAULT false;"),
            ("Almacen_PedidoProveedores.ComentarioPrecioEspecial", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""ComentarioPrecioEspecial"" character varying(500) NULL;"),
            ("Almacen_PedidoProveedores.NumeroOrdenCompra", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""NumeroOrdenCompra"" integer NULL;"),
            ("Almacen_PedidoProveedores.Pagado", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""Pagado"" boolean NOT NULL DEFAULT false;"),
            ("Almacen_PedidoProveedores.FormaPago", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""FormaPago"" character varying(20) NULL;"),
            ("Almacen_Requisiciones.CreadoPorId", @"
ALTER TABLE ""Almacen_Requisiciones"" ADD COLUMN IF NOT EXISTS ""CreadoPorId"" integer NULL;"),
            ("Almacen_Requisiciones.CreadoPorNombre", @"
ALTER TABLE ""Almacen_Requisiciones"" ADD COLUMN IF NOT EXISTS ""CreadoPorNombre"" character varying(200) NULL;"),
            ("Almacen_Requisiciones.RecordatorioPedidoEnviado", @"
ALTER TABLE ""Almacen_Requisiciones"" ADD COLUMN IF NOT EXISTS ""RecordatorioPedidoEnviado"" boolean NOT NULL DEFAULT false;"),
            ("Almacen_Pedidos.ProcesadoPorId", @"
ALTER TABLE ""Almacen_Pedidos"" ADD COLUMN IF NOT EXISTS ""ProcesadoPorId"" integer NULL;"),
            ("Almacen_Pedidos.ProcesadoPorNombre", @"
ALTER TABLE ""Almacen_Pedidos"" ADD COLUMN IF NOT EXISTS ""ProcesadoPorNombre"" character varying(200) NULL;"),
            ("Almacen_RecepcionLineas.RegistradoPorNombre", @"
ALTER TABLE ""Almacen_RecepcionLineas"" ADD COLUMN IF NOT EXISTS ""RegistradoPorNombre"" character varying(200) NULL;"),
            ("Almacen_PedidoProveedores.NumeroOrdenCompra unique", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_PedidoProveedores_NumeroOrdenCompra""
ON ""Almacen_PedidoProveedores"" (""NumeroOrdenCompra"") WHERE ""NumeroOrdenCompra"" IS NOT NULL;"),
            ("Almacen_PedidoProveedores.NumeroOrdenCompra backfill", @"
DO $$
DECLARE r RECORD;
DECLARE n INT;
BEGIN
  SELECT COALESCE(MAX(""NumeroOrdenCompra""), 0) INTO n FROM ""Almacen_PedidoProveedores"";
  FOR r IN
    SELECT pp.""Id""
    FROM ""Almacen_PedidoProveedores"" pp
    INNER JOIN ""Almacen_Pedidos"" ped ON ped.""Id"" = pp.""PedidoId""
    WHERE pp.""NumeroOrdenCompra"" IS NULL
    ORDER BY ped.""FechaPedido"", pp.""Id""
  LOOP
    n := n + 1;
    UPDATE ""Almacen_PedidoProveedores"" SET ""NumeroOrdenCompra"" = n WHERE ""Id"" = r.""Id"";
  END LOOP;
END $$;"),
            ("Almacen_PedidoProveedores", @"
CREATE TABLE IF NOT EXISTS ""Almacen_PedidoProveedores"" (
    ""Id"" serial PRIMARY KEY,
    ""PedidoId"" integer NOT NULL,
    ""ProveedorCatalogoId"" integer NULL,
    ""Nombre"" character varying(200) NOT NULL,
    ""Nit"" character varying(50) NULL,
    ""Telefono"" character varying(50) NULL,
    ""Cantidad"" numeric(18,2) NOT NULL DEFAULT 0,
    ""FechaEntregaEstimada"" timestamp without time zone NULL,
    ""Recibido"" boolean NOT NULL DEFAULT false,
    CONSTRAINT ""FK_Almacen_PedidoProveedores_Pedido"" FOREIGN KEY (""PedidoId"") REFERENCES ""Almacen_Pedidos"" (""Id"") ON DELETE CASCADE
);"),
            ("Almacen_RecepcionLineas", @"
CREATE TABLE IF NOT EXISTS ""Almacen_RecepcionLineas"" (
    ""Id"" serial PRIMARY KEY,
    ""RequisicionId"" integer NOT NULL,
    ""PedidoProveedorId"" integer NOT NULL,
    ""NombreProveedor"" character varying(200) NOT NULL,
    ""CodigoUsuario"" character varying(100) NOT NULL,
    ""FechaLlegada"" timestamp without time zone NOT NULL,
    ""CalidadEsperada"" boolean NOT NULL DEFAULT true,
    ""MotivoCalidadNo"" text NULL,
    ""FacturaEntregada"" boolean NOT NULL DEFAULT false,
    ""MotivoFacturaNo"" text NULL,
    ""CantidadRecibida"" numeric(18,2) NOT NULL DEFAULT 0,
    ""CantidadPedidaEnMomento"" numeric(18,2) NOT NULL DEFAULT 0,
    ""PedidoCompleto"" boolean NOT NULL DEFAULT false,
    ""MotivoCantidadParcial"" text NULL,
    ""NuevaFechaEntrega"" timestamp without time zone NULL,
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT ""FK_Almacen_RecepcionLineas_Requisicion"" FOREIGN KEY (""RequisicionId"") REFERENCES ""Almacen_Requisiciones"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_Almacen_RecepcionLineas_PedidoProveedor"" FOREIGN KEY (""PedidoProveedorId"") REFERENCES ""Almacen_PedidoProveedores"" (""Id"") ON DELETE RESTRICT
);"),
            ("Almacen_RecepcionLineas dedupe", @"
DELETE FROM ""Almacen_RecepcionLineas"" a
USING ""Almacen_RecepcionLineas"" b
WHERE a.""Id"" > b.""Id""
  AND a.""RequisicionId"" = b.""RequisicionId""
  AND a.""PedidoProveedorId"" = b.""PedidoProveedorId""
  AND LOWER(TRIM(a.""CodigoUsuario"")) = LOWER(TRIM(b.""CodigoUsuario""));"),
            ("Almacen_RecepcionLineas unique codigo", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_RecepcionLineas_Requisicion_Prov_Codigo""
ON ""Almacen_RecepcionLineas"" (""RequisicionId"", ""PedidoProveedorId"", LOWER(TRIM(""CodigoUsuario"")));"),
            ("Almacen_Productos seed", @"
INSERT INTO ""Almacen_Productos"" (""Nombre"", ""TipoRequisicionId"", ""UnidadSugerida"", ""Activo"")
SELECT v.""Nombre"", v.""TipoRequisicionId"", v.""UnidadSugerida"", true FROM (VALUES
    ('Alcohol propanol', 'consumo_diario', 'litros'),
    ('Solvente limpieza', 'consumo_diario', 'litros'),
    ('Cuchilla guillotina', 'consumo_diario', 'unidades'),
    ('Caja corrugada 40x30', 'cajas_empaque', 'unidades'),
    ('Film stretch', 'cajas_empaque', 'metros'),
    ('Cartulina SBS 300g', 'cajas_empaque', 'kg'),
    ('Goma 370', 'gomas_adhesivos', 'kg'),
    ('Pegante hot melt', 'gomas_adhesivos', 'kg'),
    ('Cinta enmascarar', 'gomas_adhesivos', 'rollos'),
    ('Tinta Pantone 186 C', 'pantone', 'kg'),
    ('Tinta Pantone 287 C', 'pantone', 'kg'),
    ('Tinta offset negra', 'pantone', 'litros')
) AS v(""Nombre"", ""TipoRequisicionId"", ""UnidadSugerida"")
WHERE NOT EXISTS (
    SELECT 1 FROM ""Almacen_Productos"" p WHERE LOWER(TRIM(p.""Nombre"")) = LOWER(TRIM(v.""Nombre""))
);"),
            ("Almacen_OrdenesCompra", @"
CREATE TABLE IF NOT EXISTS ""Almacen_OrdenesCompra"" (
    ""Id"" serial PRIMARY KEY,
    ""NumeroOrdenCompra"" integer NOT NULL,
    ""ProveedorCatalogoId"" integer NULL,
    ""NombreProveedor"" character varying(200) NOT NULL,
    ""Nit"" character varying(50) NULL,
    ""Telefono"" character varying(50) NULL,
    ""FechaPedido"" timestamp without time zone NOT NULL,
    ""FechaEntregaEstimada"" timestamp without time zone NULL,
    ""Estado"" character varying(20) NOT NULL DEFAULT 'Emitida',
    ""Pagado"" boolean NOT NULL DEFAULT false,
    ""FormaPago"" character varying(20) NULL,
    ""ProcesadoPorId"" integer NULL,
    ""ProcesadoPorNombre"" character varying(200) NULL,
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT NOW()
);"),
            ("Almacen_OrdenesCompra.NumeroOrdenCompra unique", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_OrdenesCompra_NumeroOrdenCompra""
ON ""Almacen_OrdenesCompra"" (""NumeroOrdenCompra"");"),
            ("Almacen_OrdenCompraLineas", @"
CREATE TABLE IF NOT EXISTS ""Almacen_OrdenCompraLineas"" (
    ""Id"" serial PRIMARY KEY,
    ""OrdenCompraId"" integer NOT NULL,
    ""PedidoProveedorId"" integer NOT NULL,
    ""RequisicionId"" integer NOT NULL,
    ""Orden"" integer NOT NULL DEFAULT 0,
    CONSTRAINT ""FK_Almacen_OrdenCompraLineas_OrdenCompra"" FOREIGN KEY (""OrdenCompraId"") REFERENCES ""Almacen_OrdenesCompra"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_Almacen_OrdenCompraLineas_PedidoProveedor"" FOREIGN KEY (""PedidoProveedorId"") REFERENCES ""Almacen_PedidoProveedores"" (""Id"") ON DELETE RESTRICT,
    CONSTRAINT ""FK_Almacen_OrdenCompraLineas_Requisicion"" FOREIGN KEY (""RequisicionId"") REFERENCES ""Almacen_Requisiciones"" (""Id"") ON DELETE RESTRICT
);"),
            ("Almacen_OrdenCompraLineas.PedidoProveedorId unique", @"
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Almacen_OrdenCompraLineas_PedidoProveedorId""
ON ""Almacen_OrdenCompraLineas"" (""PedidoProveedorId"");"),
            ("Almacen_PedidoProveedores.OrdenCompraId", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""OrdenCompraId"" integer NULL;"),
            ("Almacen_PedidoProveedores drop NumeroOrdenCompra unique", @"
DROP INDEX IF EXISTS ""IX_Almacen_PedidoProveedores_NumeroOrdenCompra"";"),
            ("Almacen_OrdenesCompra migrate legacy", @"
DO $$
DECLARE r RECORD;
DECLARE oc_id INT;
DECLARE n INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ""Almacen_OrdenesCompra"" LIMIT 1) THEN
    SELECT COALESCE(MAX(""NumeroOrdenCompra""), 0) INTO n FROM ""Almacen_PedidoProveedores"";
    FOR r IN
      SELECT pp.""Id"" AS pp_id, pp.""NumeroOrdenCompra"" AS num_oc, pp.""ProveedorCatalogoId"", pp.""Nombre"", pp.""Nit"", pp.""Telefono"",
             pp.""FechaEntregaEstimada"", ped.""FechaPedido"", ped.""ProcesadoPorId"", ped.""ProcesadoPorNombre"", ped.""RequisicionId""
      FROM ""Almacen_PedidoProveedores"" pp
      INNER JOIN ""Almacen_Pedidos"" ped ON ped.""Id"" = pp.""PedidoId""
      WHERE pp.""NumeroOrdenCompra"" IS NOT NULL AND pp.""OrdenCompraId"" IS NULL
      ORDER BY pp.""NumeroOrdenCompra"", pp.""Id""
    LOOP
      SELECT ""Id"" INTO oc_id FROM ""Almacen_OrdenesCompra"" WHERE ""NumeroOrdenCompra"" = r.num_oc LIMIT 1;
      IF oc_id IS NULL THEN
        INSERT INTO ""Almacen_OrdenesCompra"" (
          ""NumeroOrdenCompra"", ""ProveedorCatalogoId"", ""NombreProveedor"", ""Nit"", ""Telefono"",
          ""FechaPedido"", ""FechaEntregaEstimada"", ""Estado"", ""Pagado"", ""ProcesadoPorId"", ""ProcesadoPorNombre""
        ) VALUES (
          r.num_oc, r.""ProveedorCatalogoId"", r.""Nombre"", r.""Nit"", r.""Telefono"",
          r.""FechaPedido"", r.""FechaEntregaEstimada"", 'Emitida', false, r.""ProcesadoPorId"", r.""ProcesadoPorNombre""
        ) RETURNING ""Id"" INTO oc_id;
      END IF;
      UPDATE ""Almacen_PedidoProveedores"" SET ""OrdenCompraId"" = oc_id WHERE ""Id"" = r.pp_id;
      IF NOT EXISTS (SELECT 1 FROM ""Almacen_OrdenCompraLineas"" WHERE ""PedidoProveedorId"" = r.pp_id) THEN
        INSERT INTO ""Almacen_OrdenCompraLineas"" (""OrdenCompraId"", ""PedidoProveedorId"", ""RequisicionId"", ""Orden"")
        VALUES (oc_id, r.pp_id, r.""RequisicionId"", r.num_oc);
      END IF;
    END LOOP;
  END IF;
END $$;"),
            ("Almacen_PedidoProveedores.ProformaUrl", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""ProformaUrl"" character varying(500) NULL;"),
            ("Almacen_PedidoProveedores.ProformaNombre", @"
ALTER TABLE ""Almacen_PedidoProveedores"" ADD COLUMN IF NOT EXISTS ""ProformaNombre"" character varying(260) NULL;"),
            ("Almacen_RequisicionComentarios", @"
CREATE TABLE IF NOT EXISTS ""Almacen_RequisicionComentarios"" (
    ""Id"" serial PRIMARY KEY,
    ""RequisicionId"" integer NOT NULL,
    ""ParentId"" integer NULL,
    ""Texto"" text NOT NULL,
    ""UsuarioId"" integer NULL,
    ""UsuarioNombre"" character varying(200) NULL,
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    CONSTRAINT ""FK_Almacen_RequisicionComentarios_Requisicion"" FOREIGN KEY (""RequisicionId"") REFERENCES ""Almacen_Requisiciones"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_Almacen_RequisicionComentarios_Parent"" FOREIGN KEY (""ParentId"") REFERENCES ""Almacen_RequisicionComentarios"" (""Id"") ON DELETE CASCADE
);"),
        };

        Console.WriteLine("[STARTUP] Tablas Almacén (productos, proveedores, requisiciones, pedidos, recepciones)...");
        foreach (var (label, sql) in sqls)
        {
            try { context.Database.ExecuteSqlRaw(sql); }
            catch (Exception ex) { Console.WriteLine($"[DB FIX] {label}: {ex.Message}"); }
        }
        Console.WriteLine("[STARTUP] Tablas Almacén listas.");
    }

    public static void ApplyGastoAutorizacionTable(AppDbContext context)
    {
        const string sql = @"
CREATE TABLE IF NOT EXISTS ""Gasto_AutorizacionSolicitudes"" (
    ""Id"" serial PRIMARY KEY,
    ""Modulo"" character varying(30) NOT NULL,
    ""ProveedorId"" integer NULL,
    ""ProveedorNombre"" character varying(200) NULL,
    ""FechaAproximada"" timestamp without time zone NOT NULL,
    ""Cantidad"" numeric(18,2) NOT NULL,
    ""Razon"" text NOT NULL,
    ""EsSolicitudCredito"" boolean NOT NULL DEFAULT false,
    ""EsEfectivo"" boolean NOT NULL DEFAULT false,
    ""EstadoAutorizacion"" character varying(20) NOT NULL DEFAULT 'Pendiente',
    ""SolicitadoPorId"" integer NULL,
    ""SolicitadoPorNombre"" character varying(200) NULL,
    ""AutorizadoPorId"" integer NULL,
    ""AutorizadoPorNombre"" character varying(200) NULL,
    ""FechaSolicitud"" timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    ""FechaResolucion"" timestamp without time zone NULL,
    ""MotivoRechazo"" text NULL,
    ""GastoId"" integer NULL,
    ""Anio"" integer NOT NULL,
    ""Mes"" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS ""IX_Gasto_AutorizacionSolicitudes_Modulo_Anio_Mes""
ON ""Gasto_AutorizacionSolicitudes"" (""Modulo"", ""Anio"", ""Mes"");
CREATE INDEX IF NOT EXISTS ""IX_Gasto_AutorizacionSolicitudes_Estado""
ON ""Gasto_AutorizacionSolicitudes"" (""EstadoAutorizacion"");";

        Console.WriteLine("[STARTUP] Tabla Gasto_AutorizacionSolicitudes...");
        try { context.Database.ExecuteSqlRaw(sql); }
        catch (Exception ex) { Console.WriteLine($"[DB FIX] Gasto_AutorizacionSolicitudes: {ex.Message}"); }

        const string alterRubro = @"
ALTER TABLE ""Gasto_AutorizacionSolicitudes"" ADD COLUMN IF NOT EXISTS ""RubroId"" integer NULL;
ALTER TABLE ""Gasto_AutorizacionSolicitudes"" ADD COLUMN IF NOT EXISTS ""RubroNombre"" character varying(200) NULL;";
        try { context.Database.ExecuteSqlRaw(alterRubro); }
        catch (Exception ex) { Console.WriteLine($"[DB FIX] Gasto_AutorizacionSolicitudes Rubro: {ex.Message}"); }

        const string comentariosSql = @"
CREATE TABLE IF NOT EXISTS ""Gasto_AutorizacionComentarios"" (
    ""Id"" serial PRIMARY KEY,
    ""SolicitudId"" integer NOT NULL,
    ""ParentId"" integer NULL,
    ""Texto"" text NOT NULL,
    ""UsuarioId"" integer NULL,
    ""UsuarioNombre"" character varying(200) NULL,
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    CONSTRAINT ""FK_Gasto_AutorizacionComentarios_Solicitud"" FOREIGN KEY (""SolicitudId"") REFERENCES ""Gasto_AutorizacionSolicitudes"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_Gasto_AutorizacionComentarios_Parent"" FOREIGN KEY (""ParentId"") REFERENCES ""Gasto_AutorizacionComentarios"" (""Id"") ON DELETE CASCADE
);";
        try { context.Database.ExecuteSqlRaw(comentariosSql); }
        catch (Exception ex) { Console.WriteLine($"[DB FIX] Gasto_AutorizacionComentarios: {ex.Message}"); }
    }

    public static void ApplyMantenimientoConsumosTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Mantenimiento_Consumos"" (
    ""Id"" serial PRIMARY KEY,
    ""productoid"" integer NOT NULL,
    ""cantidad"" numeric(18,2) NOT NULL DEFAULT 0,
    ""Fecha"" timestamp without time zone NOT NULL,
    ""MaquinaId"" integer NULL,
    ""tipomantenimiento"" character varying(100) NULL,
    ""BitacoraId"" integer NULL,
    ""ActividadesIds"" text NULL,
    ""Responsable"" character varying(200) NULL,
    ""Nota"" text NULL,
    ""Activo"" boolean NOT NULL DEFAULT true,
    ""Anio"" integer NOT NULL DEFAULT 0,
    ""Mes"" integer NOT NULL DEFAULT 0,
    CONSTRAINT ""FK_Mantenimiento_Consumos_Producto"" FOREIGN KEY (""productoid"") REFERENCES ""Mantenimiento_Productos"" (""Id"") ON DELETE RESTRICT,
    CONSTRAINT ""FK_Mantenimiento_Consumos_Maquina"" FOREIGN KEY (""MaquinaId"") REFERENCES ""Maquinas"" (""Id"") ON DELETE SET NULL
);";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            Console.WriteLine("[STARTUP] Tabla Mantenimiento_Consumos verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Mantenimiento_Consumos: {ex.Message}");
        }
    }

    public static void ApplyMantenimientoTrazabilidadTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Mantenimiento_Trazabilidad"" (
    ""Id"" serial PRIMARY KEY,
    ""Modulo"" character varying(50) NOT NULL,
    ""Entidad"" character varying(80) NOT NULL,
    ""Accion"" character varying(50) NOT NULL,
    ""EntidadId"" integer NULL,
    ""Descripcion"" character varying(500) NOT NULL,
    ""DetalleJson"" text NULL,
    ""UsuarioId"" integer NULL,
    ""UsuarioNombre"" character varying(150) NULL,
    ""Fecha"" timestamp without time zone NOT NULL,
    ""EsHistorico"" boolean NOT NULL DEFAULT false,
    CONSTRAINT ""FK_Mantenimiento_Trazabilidad_Usuario"" FOREIGN KEY (""UsuarioId"") REFERENCES ""AdminUsuarios"" (""Id"") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ""IX_Mantenimiento_Trazabilidad_Fecha"" ON ""Mantenimiento_Trazabilidad"" (""Fecha"" DESC);
CREATE INDEX IF NOT EXISTS ""IX_Mantenimiento_Trazabilidad_Modulo"" ON ""Mantenimiento_Trazabilidad"" (""Modulo"");";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            Console.WriteLine("[STARTUP] Tabla Mantenimiento_Trazabilidad verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Mantenimiento_Trazabilidad: {ex.Message}");
        }
    }

    public static void ApplyBitacoraMantenimientoDiariaTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""Bitacora_MantenimientoDiaria"" (
    ""Id"" serial PRIMARY KEY,
    ""Fecha"" date NOT NULL,
    ""HoraInicio"" character varying(8) NOT NULL DEFAULT '08:00:00',
    ""HoraFin"" character varying(8) NOT NULL DEFAULT '17:00:00',
    ""Actividad"" character varying(200) NOT NULL DEFAULT '',
    ""Descripcion"" text NOT NULL,
    ""RegistradoPor"" character varying(150) NOT NULL DEFAULT '',
    ""FechaRegistro"" timestamp without time zone NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ""IX_Bitacora_MantenimientoDiaria_Fecha"" ON ""Bitacora_MantenimientoDiaria"" (""Fecha"" DESC);";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            Console.WriteLine("[STARTUP] Tabla Bitacora_MantenimientoDiaria verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Bitacora_MantenimientoDiaria: {ex.Message}");
        }
    }

    /// <summary>
    /// Jornada ordinaria OT configurable por día (vigente desde 2026-07-15).
    /// </summary>
    public static void ApplyParametrosJornadaOtTable(AppDbContext context)
    {
        const string createTable = @"
CREATE TABLE IF NOT EXISTS ""ParametrosJornadaOt"" (
    ""Id"" serial PRIMARY KEY,
    ""VigenteDesde"" date NOT NULL,
    ""DiaSemana"" integer NOT NULL,
    ""HoraInicio"" interval NULL,
    ""HoraFin"" interval NULL,
    ""DescuentaComida"" boolean NOT NULL DEFAULT false,
    ""MinutosComida"" integer NOT NULL DEFAULT 0,
    ""Activo"" boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ""IX_ParametrosJornadaOt_Vigente_Dia""
    ON ""ParametrosJornadaOt"" (""VigenteDesde"", ""DiaSemana"");";

        try
        {
            context.Database.ExecuteSqlRaw(createTable);
            // Permitir varios horarios (bloques) por el mismo día
            context.Database.ExecuteSqlRaw(@"
DROP INDEX IF EXISTS ""IX_ParametrosJornadaOt_Vigente_Dia"";
CREATE INDEX IF NOT EXISTS ""IX_ParametrosJornadaOt_Vigente_Dia""
    ON ""ParametrosJornadaOt"" (""VigenteDesde"", ""DiaSemana"");");
            Console.WriteLine("[STARTUP] Tabla ParametrosJornadaOt verificada.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] ParametrosJornadaOt create: {ex.Message}");
            return;
        }

        // Seed jornada reducida Colombia 2026-07-15 (idempotente)
        // DiaSemana: 0=Dom … 6=Sáb
        try
        {
            var exists = context.ParametrosJornadaOt.Any(p => p.VigenteDesde == new DateTime(2026, 7, 15));
            if (!exists)
            {
                var vigente = new DateTime(2026, 7, 15);
                var seed = new List<ParametrosJornadaOt>
                {
                    new() { VigenteDesde = vigente, DiaSemana = 0, HoraInicio = null, HoraFin = null, DescuentaComida = false, MinutosComida = 0, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 1, HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(12, 0, 0), DescuentaComida = false, MinutosComida = 0, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 2, HoraInicio = new TimeSpan(7, 0, 0), HoraFin = new TimeSpan(15, 30, 0), DescuentaComida = true, MinutosComida = 30, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 3, HoraInicio = new TimeSpan(7, 0, 0), HoraFin = new TimeSpan(15, 30, 0), DescuentaComida = true, MinutosComida = 30, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 4, HoraInicio = new TimeSpan(7, 0, 0), HoraFin = new TimeSpan(15, 30, 0), DescuentaComida = true, MinutosComida = 30, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 5, HoraInicio = new TimeSpan(7, 0, 0), HoraFin = new TimeSpan(15, 30, 0), DescuentaComida = true, MinutosComida = 30, Activo = true },
                    new() { VigenteDesde = vigente, DiaSemana = 6, HoraInicio = new TimeSpan(7, 0, 0), HoraFin = new TimeSpan(13, 0, 0), DescuentaComida = false, MinutosComida = 0, Activo = true },
                };
                context.ParametrosJornadaOt.AddRange(seed);
                context.SaveChanges();
                Console.WriteLine("[STARTUP] Seed ParametrosJornadaOt 2026-07-15 insertado.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] ParametrosJornadaOt seed: {ex.Message}");
        }
    }

    /// <summary>
    /// Sincroniza catálogo Gantt con procesos de planta y máquinas asociadas (UI filtra por código).
    /// </summary>
    public static void ApplyProcesosGanttCatalog(AppDbContext context)
    {
        var desired = new[]
        {
            "Conversion", "Corrugacion", "Corte", "Impresion", "Acabado",
            "Colaminado", "Troquelado", "Despique", "Pegadora", "Terminado Manual"
        };
        var desiredSet = new HashSet<string>(desired, StringComparer.OrdinalIgnoreCase);

        try
        {
            var existing = context.ProcesosGantt.ToList();
            for (var i = 0; i < desired.Length; i++)
            {
                var nombre = desired[i];
                var row = existing.FirstOrDefault(p =>
                    string.Equals(p.Nombre, nombre, StringComparison.OrdinalIgnoreCase));
                if (row == null)
                {
                    context.ProcesosGantt.Add(new ProcesoGantt
                    {
                        Nombre = nombre,
                        Orden = i,
                        Activo = true
                    });
                }
                else
                {
                    row.Activo = true;
                    row.Orden = i;
                    if (!string.Equals(row.Nombre, nombre, StringComparison.Ordinal))
                        row.Nombre = nombre;
                }
            }

            foreach (var row in existing)
            {
                if (!desiredSet.Contains(row.Nombre))
                    row.Activo = false;
            }

            context.SaveChanges();
            Console.WriteLine("[STARTUP] ProcesosGantt catálogo sincronizado.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] ProcesosGantt catalog: {ex.Message}");
        }
    }

    private static readonly HashSet<string> MaquinasCalculoManual = new(StringComparer.OrdinalIgnoreCase)
    {
        "Conversion", "Corrugacion", "Corte", "Impresion", "Acabado",
        "Colaminado", "Troquelado", "Despique", "Pegadora", "Terminado Manual",
        "MANUAL / TERMINADOS",
    };

    private static Maquina CrearMaquinaDesperdicioProceso(string nombre) => new()
    {
        Nombre = nombre,
        MetaRendimiento = 0,
        MetaDesperdicio = 0,
        ValorPorTiro = 0,
        TirosReferencia = 0,
        SemaforoMin = 0,
        SemaforoNormal = 0,
        SemaforoMax = 0,
        Importancia = 0,
        Meta100Porciento = 0,
        Activo = true,
        Tarifa = 0,
        HorasAlistamiento = 1.00m,
        HorasLavada = 0.50m,
    };

    /// <summary>
    /// Máquinas virtuales de proceso Gantt para roster y planeación (una por proceso del Gantt).
    /// </summary>
    public static void EnsureMaquinasDesperdicioProcesos(AppDbContext context)
    {
        var nombres = new[]
        {
            "Conversion", "Corrugacion", "Corte", "Impresion", "Acabado",
            "Colaminado", "Troquelado", "Despique", "Pegadora", "Terminado Manual"
        };
        try
        {
            var existentes = context.Maquinas
                .AsEnumerable()
                .Select(m => m.Nombre?.Trim() ?? "")
                .Where(n => n.Length > 0)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var agregadas = 0;
            foreach (var nombre in nombres)
            {
                if (existentes.Contains(nombre)) continue;
                context.Maquinas.Add(CrearMaquinaDesperdicioProceso(nombre));
                agregadas++;
            }

            if (agregadas > 0)
            {
                context.SaveChanges();
                Console.WriteLine($"[STARTUP] Máquinas virtuales Gantt creadas: {agregadas}.");
            }
            else
            {
                Console.WriteLine("[STARTUP] Máquinas virtuales Gantt ya existen.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Máquinas desperdicio: {ex.Message}");
        }
    }

    /// <summary>
    /// Despique / Terminado Manual / MANUAL no llevan meta de cálculo: solo fechas manuales en el planeador.
    /// </summary>
    public static void EnsureMaquinasCalculoManualSinEstandar(AppDbContext context)
    {
        try
        {
            var maquinas = context.Maquinas
                .Where(m => m.Activo && m.Nombre != null)
                .AsEnumerable()
                .Where(m => MaquinasCalculoManual.Contains(m.Nombre.Trim()))
                .ToList();

            var updated = 0;
            foreach (var maquina in maquinas)
            {
                var changed = false;
                if (maquina.Meta100Porciento != 0)
                {
                    maquina.Meta100Porciento = 0;
                    changed = true;
                }
                if (maquina.MetaRendimiento != 0)
                {
                    maquina.MetaRendimiento = 0;
                    changed = true;
                }
                if (maquina.HorasAlistamiento <= 0)
                {
                    maquina.HorasAlistamiento = 1.00m;
                    changed = true;
                }
                if (maquina.HorasLavada <= 0)
                {
                    maquina.HorasLavada = 0.50m;
                    changed = true;
                }
                if (changed) updated++;
            }

            if (updated > 0)
            {
                context.SaveChanges();
                Console.WriteLine($"[STARTUP] Máquinas cálculo manual sin meta: {updated} actualizada(s).");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DB FIX] Máquinas cálculo manual: {ex.Message}");
        }
    }

    /// <summary>
    /// Columnas del informe semanal de calidad (observaciones/estado editables por novedad).
    /// </summary>
    public static void ApplyEncuestaNovedadInformeColumns(AppDbContext context)
    {
        var patches = new (string Label, string Sql)[]
        {
            ("EncuestaNovedades.InformeObservaciones",
                "ALTER TABLE \"EncuestaNovedades\" ADD COLUMN IF NOT EXISTS \"InformeObservaciones\" text NULL;"),
            ("EncuestaNovedades.InformeEstado",
                "ALTER TABLE \"EncuestaNovedades\" ADD COLUMN IF NOT EXISTS \"InformeEstado\" character varying(40) NULL;"),
        };

        foreach (var (label, sql) in patches)
        {
            try
            {
                context.Database.ExecuteSqlRaw(sql);
                Console.WriteLine($"[STARTUP] {label} verificada.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] {label}: {ex.Message}");
            }
        }
    }
    /// <summary>
    /// Roster semanal, config de turnos por máquina, novedades de personal y EstadoOperativo.
    /// </summary>
    public static void ApplyRosterDisponibilidadTables(AppDbContext context)
    {
        var patches = new (string Label, string Sql)[]
        {
            ("Maquinas.EstadoOperativo",
                @"ALTER TABLE ""Maquinas"" ADD COLUMN IF NOT EXISTS ""EstadoOperativo"" character varying(32) NOT NULL DEFAULT 'Operativa';"),
            ("MaquinaTurnoConfig",
                @"CREATE TABLE IF NOT EXISTS ""MaquinaTurnoConfig"" (
    ""Id"" serial PRIMARY KEY,
    ""MaquinaId"" integer NOT NULL,
    ""HorarioId"" integer NOT NULL,
    ""Activo"" boolean NOT NULL DEFAULT true,
    ""RequiereOperario"" boolean NOT NULL DEFAULT true,
    ""AuxiliaresRequeridos"" integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_MaquinaTurnoConfig_Maquina_Horario""
    ON ""MaquinaTurnoConfig"" (""MaquinaId"", ""HorarioId"");"),
            ("RosterAsignaciones",
                @"CREATE TABLE IF NOT EXISTS ""RosterAsignaciones"" (
    ""Id"" serial PRIMARY KEY,
    ""Anio"" integer NOT NULL,
    ""SemanaIso"" integer NOT NULL,
    ""FechaDia"" date NOT NULL,
    ""MaquinaId"" integer NOT NULL,
    ""HorarioId"" integer NOT NULL,
    ""UsuarioId"" integer NOT NULL,
    ""EsAuxiliar"" boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RosterAsignaciones_Dia_Maq_Hor_Usr""
    ON ""RosterAsignaciones"" (""FechaDia"", ""MaquinaId"", ""HorarioId"", ""UsuarioId"");
CREATE INDEX IF NOT EXISTS ""IX_RosterAsignaciones_Anio_Semana""
    ON ""RosterAsignaciones"" (""Anio"", ""SemanaIso"");"),
            ("PersonalNovedades",
                @"CREATE TABLE IF NOT EXISTS ""PersonalNovedades"" (
    ""Id"" serial PRIMARY KEY,
    ""UsuarioId"" integer NOT NULL,
    ""Tipo"" character varying(40) NOT NULL DEFAULT 'falta',
    ""FechaInicio"" date NOT NULL,
    ""FechaFin"" date NOT NULL,
    ""Observacion"" text NULL
);
CREATE INDEX IF NOT EXISTS ""IX_PersonalNovedades_Usuario_Fechas""
    ON ""PersonalNovedades"" (""UsuarioId"", ""FechaInicio"", ""FechaFin"");"),
            ("RosterTurnoDias",
                @"CREATE TABLE IF NOT EXISTS ""RosterTurnoDias"" (
    ""Id"" serial PRIMARY KEY,
    ""FechaDia"" date NOT NULL,
    ""MaquinaId"" integer NOT NULL,
    ""HorarioId"" integer NOT NULL,
    ""Incluir"" boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RosterTurnoDias_Dia_Maq_Hor""
    ON ""RosterTurnoDias"" (""FechaDia"", ""MaquinaId"", ""HorarioId"");"),
            ("RosterDiasFestivos",
                @"CREATE TABLE IF NOT EXISTS ""RosterDiasFestivos"" (
    ""Id"" serial PRIMARY KEY,
    ""FechaDia"" date NOT NULL,
    ""Observacion"" character varying(256) NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RosterDiasFestivos_FechaDia""
    ON ""RosterDiasFestivos"" (""FechaDia"");"),
            ("PersonalNovedades.MedioDia",
                @"ALTER TABLE ""PersonalNovedades"" ADD COLUMN IF NOT EXISTS ""MedioDia"" boolean NOT NULL DEFAULT false;"),
            ("PersonalNovedades.Jornada",
                @"ALTER TABLE ""PersonalNovedades"" ADD COLUMN IF NOT EXISTS ""Jornada"" character varying(16) NULL;"),
            ("RosterAsignaciones.HoraInicio",
                @"ALTER TABLE ""RosterAsignaciones"" ADD COLUMN IF NOT EXISTS ""HoraInicio"" time NULL;"),
            ("RosterAsignaciones.HoraFin",
                @"ALTER TABLE ""RosterAsignaciones"" ADD COLUMN IF NOT EXISTS ""HoraFin"" time NULL;"),
            ("RosterAsignaciones.EsDescanso",
                @"ALTER TABLE ""RosterAsignaciones"" ADD COLUMN IF NOT EXISTS ""EsDescanso"" boolean NOT NULL DEFAULT false;"),
            ("RosterAsignaciones.DescuentaComida",
                @"ALTER TABLE ""RosterAsignaciones"" ADD COLUMN IF NOT EXISTS ""DescuentaComida"" boolean NOT NULL DEFAULT false;"),
            ("RosterAsignaciones.MinutosComida",
                @"ALTER TABLE ""RosterAsignaciones"" ADD COLUMN IF NOT EXISTS ""MinutosComida"" integer NOT NULL DEFAULT 0;")
        };

        foreach (var (label, sql) in patches)
        {
            try
            {
                context.Database.ExecuteSqlRaw(sql);
                Console.WriteLine($"[STARTUP] {label} verificada.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB FIX] {label}: {ex.Message}");
            }
        }
    }

}
