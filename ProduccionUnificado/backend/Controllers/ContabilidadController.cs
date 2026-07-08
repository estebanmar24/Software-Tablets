using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.IO;

namespace TiempoProcesos.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ContabilidadController : ControllerBase
    {
        private readonly AppDbContext _context;

        /// <summary>Rango del modal = días calendario en Colombia; las <c>Fecha</c> en BD suelen estar en UTC.</summary>
        private static TimeZoneInfo ColombiaTz()
        {
            foreach (var id in new[] { "America/Bogota", "SA Pacific Standard Time" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.Utc;
        }

        private static DateTime LocalCalendarStartToUtc(DateTime dateOnly)
        {
            var d = dateOnly.Date;
            var local = new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(local, ColombiaTz());
        }

        /// <summary>
        /// Día calendario para filtrar/exportar. Los gastos suelen guardar <c>Fecha</c> como día de operación
        /// en <see cref="DateTimeKind.Unspecified"/>; si lo forzáramos a UTC, 10/05 00:00 pasaría a 09/05 en
        /// Colombia y el Excel por rango perdería Talleres/Mantenimiento/etc. manteniendo solo Producción.
        /// </summary>
        private static DateTime FechaCalendarioColombia(DateTime fecha)
        {
            if (fecha.Kind == DateTimeKind.Unspecified)
                return fecha.Date;

            var utc = fecha.Kind == DateTimeKind.Utc ? fecha : fecha.ToUniversalTime();
            return TimeZoneInfo.ConvertTimeFromUtc(utc, ColombiaTz()).Date;
        }

        /// <summary>Texto para Excel: crédito / efectivo; registros viejos sin flags → sin tipo.</summary>
        private static string MedioPagoContabilidadExcel(ContabilidadGastoDTO g)
        {
            if (g.EsIngreso)
                return "sin tipo";
            if (g.EsSolicitudCredito && !g.EsEfectivo)
                return "crédito";
            if (g.EsEfectivo && !g.EsSolicitudCredito)
                return "efectivo";
            return "sin tipo";
        }

        public class ResumenGastos
        {
            public decimal TotalGeneral { get; set; }
            public Dictionary<string, decimal> PorModulo { get; set; } = new();
            public Dictionary<string, decimal> PorRubro { get; set; } = new();
        }

        public class NuevoIngresoDTO
        {
            public string MotivoIngreso { get; set; } = string.Empty;
            public decimal Cantidad { get; set; }
            public DateTime Fecha { get; set; }
            public string? PdfUrl { get; set; }
        }

        public class ContabilidadGastoWriteDTO
        {
            public string Rubro { get; set; } = string.Empty;
            public string Proveedor { get; set; } = string.Empty;
            public string? NumeroFactura { get; set; }
            public decimal Precio { get; set; }
            public decimal? PrecioBase { get; set; }
            public decimal? PrecioIva { get; set; }
            public DateTime Fecha { get; set; }
            public string? Observaciones { get; set; }
            public string? FacturaPdfUrl { get; set; }
            public bool EsPendiente { get; set; }
            public bool EsSolicitudCredito { get; set; }
            public bool EsEfectivo { get; set; }
        }

        public ContabilidadController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("gastos-consolidados")]
        public async Task<ActionResult<IEnumerable<ContabilidadGastoDTO>>> GetGastosConsolidados(
            [FromQuery] int? anio, 
            [FromQuery] int? mes, 
            [FromQuery] string? modulo,
            [FromQuery] bool? esPendiente,
            [FromQuery] bool? esSolicitudCredito,
            [FromQuery] string? rubro,
            [FromQuery] string? search,
            [FromQuery] DateTime? fechaFiltro,
            [FromQuery] string? estado,
            [FromQuery] DateTime? fechaRangoInicio = null,
            [FromQuery] DateTime? fechaRangoFin = null)
        {
            estado = estado?.Trim();
            Console.WriteLine($"[DEBUG] GetGastosConsolidados: modulo={modulo}, estado='{estado}', anio={anio}, mes={mes}, rangoIni={fechaRangoInicio}, rangoFin={fechaRangoFin}");
            DateTime queryInicio = DateTime.MinValue;
            DateTime queryFin = DateTime.MaxValue;
            // Límite superior exclusivo en UTC: ventana amplia para SQL; el corte exacto por día
            // calendario en Colombia se aplica después (evita perder Talleres/otros módulos si Fecha
            // quedó en UTC medianoche u otro desfase frente a Anio/Mes del listado).
            DateTime queryEndExclusive = DateTime.MaxValue;
            bool filtrarPorFechaCampo;
            // Rango inclusivo en fecha local Colombia (post-filtro en memoria).
            DateTime? colFechaIni = null;
            DateTime? colFechaFin = null;

            if (fechaRangoInicio.HasValue && fechaRangoFin.HasValue)
            {
                var ri = fechaRangoInicio.Value.Date;
                var rf = fechaRangoFin.Value.Date;
                if (rf < ri)
                {
                    (ri, rf) = (rf, ri);
                }
                colFechaIni = ri;
                colFechaFin = rf;
                queryInicio = LocalCalendarStartToUtc(ri.AddDays(-1));
                queryEndExclusive = LocalCalendarStartToUtc(rf.AddDays(2));
                filtrarPorFechaCampo = true;
            }
            else if (fechaFiltro.HasValue)
            {
                var d = fechaFiltro.Value.Date;
                colFechaIni = d;
                colFechaFin = d;
                queryInicio = LocalCalendarStartToUtc(d.AddDays(-1));
                queryEndExclusive = LocalCalendarStartToUtc(d.AddDays(2));
                filtrarPorFechaCampo = true;
            }
            else if (anio.HasValue)
            {
                int startMonth = mes ?? 1;
                int endMonth = mes ?? 12;
                queryInicio = new DateTime(anio.Value, startMonth, 1);
                queryFin = new DateTime(anio.Value, endMonth, DateTime.DaysInMonth(anio.Value, endMonth), 23, 59, 59);
                filtrarPorFechaCampo = false;
            }
            else
            {
                filtrarPorFechaCampo = false;
            }

            var results = new List<ContabilidadGastoDTO>();
            var searchText = search?.ToLower();

            // 1. Producción
            if (string.IsNullOrEmpty(modulo) || modulo == "Producción")
            {
                var q = _context.Produccion_Gastos
                    .Include(g => g.Rubro)
                    .Include(g => g.CreadoPor)
                    .Include(g => g.Usuario)
                    .Include(g => g.Maquina)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.Fecha >= queryInicio && g.Fecha < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Nota != null && g.Nota.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)));
                }

                var prod = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Producción",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = "Interno",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.Fecha,
                        Nota = g.Nota,
                        NumeroOP = g.NumeroOP,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.FacturaPdfUrl,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Personal = g.Usuario != null ? g.Usuario.Nombre : null,
                        Maquina = g.Maquina != null ? g.Maquina.Nombre : null,
                        Estado = g.Estado,
                        EsLabor = g.TipoHoraId != null || g.TipoRecargoId != null
                            || (g.Rubro != null && (
                                EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%")))
                    }).ToListAsync();
                results.AddRange(prod);
            }

            // 2. Talleres
            if (string.IsNullOrEmpty(modulo) || modulo == "Talleres")
            {
                var q = _context.Talleres_Gastos
                    .Include(g => g.Rubro)
                    .Include(g => g.Proveedor)
                    .Include(g => g.CreadoPor)
                    .Include(g => g.Personal)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.Fecha >= queryInicio && g.Fecha < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Observaciones != null && g.Observaciones.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var talleres = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Talleres",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.Fecha,
                        Nota = g.Observaciones,
                        NumeroFactura = g.NumeroFactura,
                        NumeroOP = g.NumeroOP,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.FacturaPdfUrl,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Personal = g.Personal != null ? g.Personal.Nombre : null,
                        Estado = g.Estado,
                        EsLabor = g.TipoHoraId != null || g.TipoRecargoId != null
                            || (g.Rubro != null && (
                                EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%")))
                    }).ToListAsync();
                results.AddRange(talleres);
            }

            // 3. Mantenimiento
            if (string.IsNullOrEmpty(modulo) || modulo == "Mantenimiento")
            {
                var q = _context.Mantenimiento_Gastos
                    .Include(g => g.Rubro)
                    .Include(g => g.Proveedor)
                    .Include(g => g.Maquina)
                    .Include(g => g.Producto)
                    .Include(g => g.CreadoPor)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => (filtrarPorFechaCampo
                        ? (g.Fecha >= queryInicio && g.Fecha < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true)) && g.Activo);

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Nota != null && g.Nota.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var mant = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Mantenimiento",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.Fecha,
                        Nota = g.Nota,
                        NumeroFactura = g.NumeroFactura,
                        Cantidad = g.Cantidad,
                        NumeroOP = g.NumeroOP,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.FacturaPdfUrl,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Maquina = g.Maquina != null ? g.Maquina.Nombre : (g.OtraMaquinaNombre ?? null),
                        Referencia = g.Producto != null ? g.Producto.Nombre : null,
                        Estado = g.Estado,
                        EsLabor = g.TipoHoraId != null || g.TipoRecargoId != null
                            || (g.Rubro != null && (
                                EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%")))
                    }).ToListAsync();
                results.AddRange(mant);
            }

            // 4. Gestión Humana
            if (string.IsNullOrEmpty(modulo) || modulo == "Gestión Humana")
            {
                var q = _context.GH_GastosMensuales
                    .Include(g => g.Rubro)
                    .Include(g => g.TipoServicio)
                    .Include(g => g.Proveedor)
                    .Include(g => g.CreadoPor)
                    .Where(g => g.TipoServicio != null && g.TipoServicio.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.FechaCompra >= queryInicio && g.FechaCompra < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Nota != null && g.Nota.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var gh = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Gestión Humana",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.FechaCompra,
                        Nota = g.Nota,
                        NumeroFactura = g.NumeroFactura,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.ArchivoFactura,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Estado = g.Estado,
                        EsLabor = g.Rubro != null && (
                            EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%"))
                    }).ToListAsync();
                results.AddRange(gh);
            }

            // 5. SST
            if (string.IsNullOrEmpty(modulo) || modulo == "SST")
            {
                var q = _context.SST_GastosMensuales
                    .Include(g => g.Rubro)
                    .Include(g => g.Proveedor)
                    .Include(g => g.CreadoPor)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.FechaCompra >= queryInicio && g.FechaCompra < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Nota != null && g.Nota.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var sst = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "SST",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.FechaCompra,
                        Nota = g.Nota,
                        NumeroFactura = g.NumeroFactura,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.ArchivoFactura,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Estado = g.Estado,
                        EsLabor = g.Rubro != null && (
                            EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%"))
                    }).ToListAsync();
                results.AddRange(sst);
            }

            // 6. Planeación
            if (string.IsNullOrEmpty(modulo) || modulo == "Planeación")
            {
                var q = _context.Planeacion_Gastos
                    .Include(g => g.Rubro)
                    .Include(g => g.Proveedor)
                    .Include(g => g.CreadoPor)
                    .Include(g => g.Personal)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.Fecha >= queryInicio && g.Fecha < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Observaciones != null && g.Observaciones.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var plan = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Planeación",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.Fecha,
                        Nota = g.Observaciones,
                        NumeroFactura = g.NumeroFactura,
                        NumeroOP = g.NumeroOP,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.FacturaPdfUrl,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Personal = g.Personal != null ? g.Personal.Nombre : null,
                        Estado = g.Estado,
                        EsLabor = g.TipoHoraId != null || g.TipoRecargoId != null
                            || (g.Rubro != null && (
                                EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                                || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%")))
                    }).ToListAsync();
                results.AddRange(plan);
            }

            // 7. Diseño
            if (string.IsNullOrEmpty(modulo) || modulo == "Diseño")
            {
                var q = _context.Diseno_Gastos
                    .Include(g => g.Rubro)
                    .Include(g => g.Proveedor)
                    .Include(g => g.CreadoPor)
                    .Where(g => g.Rubro != null && g.Rubro.Activo)
                    .Where(g => filtrarPorFechaCampo
                        ? (g.Fecha >= queryInicio && g.Fecha < queryEndExclusive) 
                        : (anio.HasValue ? (g.Anio == anio.Value && (!mes.HasValue || g.Mes == mes.Value)) : true));

                if (esPendiente.HasValue) q = q.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue) q = q.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro)) q = q.Where(g => g.Rubro.Nombre == rubro);
                if (!string.IsNullOrEmpty(estado)) {
                    q = q.Where(g => g.Estado != null && g.Estado == estado);
                }
                if (!string.IsNullOrEmpty(searchText)) {
                    q = q.Where(g => (g.Observaciones != null && g.Observaciones.ToLower().Contains(searchText)) || 
                                     (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                                     (g.Proveedor != null && g.Proveedor.Nombre.ToLower().Contains(searchText)));
                }

                var diseno = await q.Select(g => new ContabilidadGastoDTO {
                        Id = g.Id,
                        Modulo = "Diseño",
                        Rubro = g.Rubro != null ? g.Rubro.Nombre : "Sin Rubro",
                        Proveedor = g.Proveedor != null ? g.Proveedor.Nombre : "Sin Proveedor",
                        Precio = g.Precio,
                        PrecioBase = g.PrecioBase,
                        PrecioIva = g.PrecioIva,
                        Fecha = g.Fecha,
                        Nota = g.Observaciones,
                        NumeroFactura = g.NumeroFactura,
                        NumeroOP = g.OrdenProduccion,
                        EsPendiente = g.EsPendiente,
                        EsSolicitudCredito = g.EsSolicitudCredito,
                        EsEfectivo = g.EsEfectivo,
                        FacturaPdfUrl = g.FacturaPdfUrl,
                        RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Sistema",
                        Estado = g.Estado,
                        EsLabor = g.Rubro != null && (
                            EF.Functions.ILike(g.Rubro.Nombre, "%recargo%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%hora%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%horas%extra%")
                            || EF.Functions.ILike(g.Rubro.Nombre, "%tiempo%extra%"))
                    }).ToListAsync();
                results.AddRange(diseno);
            }

            // 8. Gastos propios del área Contabilidad
            if (string.IsNullOrEmpty(modulo) || modulo == "Contabilidad")
            {
                var qg = _context.Contabilidad_Gastos
                    .Include(g => g.CreadoPor)
                    .AsQueryable();

                if (filtrarPorFechaCampo)
                    qg = qg.Where(g => g.Fecha >= queryInicio && g.Fecha < queryEndExclusive);
                else if (anio.HasValue)
                    qg = qg.Where(g => g.Anio == anio.Value && (!mes.HasValue || mes.Value == 0 || g.Mes == mes.Value));

                if (esPendiente.HasValue)
                    qg = qg.Where(g => g.EsPendiente == esPendiente.Value);
                if (esSolicitudCredito.HasValue)
                    qg = qg.Where(g => g.EsSolicitudCredito == esSolicitudCredito.Value);
                if (!string.IsNullOrEmpty(rubro))
                    qg = qg.Where(g => g.Rubro == rubro);
                if (!string.IsNullOrEmpty(estado))
                    qg = qg.Where(g => g.Estado == estado);
                if (!string.IsNullOrEmpty(searchText))
                {
                    qg = qg.Where(g =>
                        (g.Observaciones != null && g.Observaciones.ToLower().Contains(searchText)) ||
                        (g.NumeroFactura != null && g.NumeroFactura.ToLower().Contains(searchText)) ||
                        (g.Proveedor != null && g.Proveedor.ToLower().Contains(searchText)) ||
                        g.Rubro.ToLower().Contains(searchText));
                }

                var cgastos = await qg.Select(g => new ContabilidadGastoDTO
                {
                    Id = g.Id,
                    Modulo = "Contabilidad",
                    Rubro = g.Rubro,
                    Proveedor = g.Proveedor,
                    Precio = g.Precio,
                    PrecioBase = g.PrecioBase,
                    PrecioIva = g.PrecioIva,
                    Fecha = g.Fecha,
                    Nota = g.Observaciones,
                    NumeroFactura = g.NumeroFactura,
                    EsPendiente = g.EsPendiente,
                    EsSolicitudCredito = g.EsSolicitudCredito,
                    EsEfectivo = g.EsEfectivo,
                    FacturaPdfUrl = g.FacturaPdfUrl,
                    RegistradoPor = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "Contabilidad",
                    Estado = g.Estado,
                    EsLabor = false,
                    EsIngreso = false
                }).ToListAsync();

                results.AddRange(cgastos);
            }

            // 9. Ingresos de Contabilidad (solo visibles en este módulo consolidado)
            if (string.IsNullOrEmpty(modulo) || modulo == "Contabilidad")
            {
                var q = _context.Contabilidad_Ingresos
                    .Where(i => filtrarPorFechaCampo
                        ? (i.Fecha >= queryInicio && i.Fecha < queryEndExclusive)
                        : (anio.HasValue ? (i.Fecha.Year == anio.Value && (!mes.HasValue || i.Fecha.Month == mes.Value)) : true));

                if (!string.IsNullOrEmpty(searchText))
                {
                    q = q.Where(i => i.MotivoIngreso.ToLower().Contains(searchText));
                }

                if (esPendiente.HasValue)
                {
                    if (esPendiente.Value) q = q.Where(_ => false);
                }

                if (esSolicitudCredito.HasValue)
                {
                    if (esSolicitudCredito.Value) q = q.Where(_ => false);
                }

                if (!string.IsNullOrEmpty(rubro))
                {
                    q = q.Where(_ => rubro == "Ingreso");
                }

                if (!string.IsNullOrEmpty(estado))
                {
                    q = q.Where(_ => estado == "Registrado");
                }

                var ingresos = await q.Select(i => new ContabilidadGastoDTO
                {
                    Id = i.Id,
                    Modulo = "Contabilidad",
                    Rubro = "Ingreso",
                    Proveedor = "Ingreso registrado",
                    Precio = i.Cantidad,
                    PrecioBase = null,
                    PrecioIva = null,
                    Fecha = i.Fecha,
                    Nota = i.MotivoIngreso,
                    FacturaPdfUrl = i.PdfUrl,
                    RegistradoPor = "Contabilidad",
                    Estado = "Registrado",
                    EsLabor = false,
                    EsIngreso = true
                }).ToListAsync();

                results.AddRange(ingresos);
            }

            if (colFechaIni.HasValue && colFechaFin.HasValue)
            {
                var a = colFechaIni.Value.Date;
                var b = colFechaFin.Value.Date;
                results = results
                    .Where(g =>
                    {
                        var fc = FechaCalendarioColombia(g.Fecha);
                        return fc >= a && fc <= b;
                    })
                    .ToList();
            }

            var final = results
                .OrderByDescending(g => g.Fecha)
                .ToList();

            return Ok(final);
        }

        // Legacy aliases used by older deployed frontend bundles.
        [HttpGet("consolidado")]
        [HttpGet("ga")]
        [HttpGet("ga_s")]
        public Task<ActionResult<IEnumerable<ContabilidadGastoDTO>>> GetGastosConsolidadosLegacy(
            [FromQuery] int? anio,
            [FromQuery] int? mes,
            [FromQuery] string? modulo,
            [FromQuery] bool? esPendiente,
            [FromQuery] bool? esSolicitudCredito,
            [FromQuery] string? rubro,
            [FromQuery] string? search,
            [FromQuery] DateTime? fechaFiltro,
            [FromQuery] string? estado)
        {
            return GetGastosConsolidados(anio, mes, modulo, esPendiente, esSolicitudCredito, rubro, search, fechaFiltro, estado, null, null);
        }

        [HttpGet("resumen-financiero")]
        public async Task<ActionResult<ResumenGastos>> GetResumenFinanciero(
            [FromQuery] int anio, 
            [FromQuery] int? mes, 
            [FromQuery] string? modulo,
            [FromQuery] bool? esPendiente,
            [FromQuery] bool? esSolicitudCredito,
            [FromQuery] string? rubro,
            [FromQuery] string? search,
            [FromQuery] DateTime? fechaFiltro,
            [FromQuery] string? estado)
        {
            var consolidado = await GetGastosConsolidados(anio, mes, modulo, esPendiente, esSolicitudCredito, rubro, search, fechaFiltro, estado);
            var gastos = ((OkObjectResult)consolidado.Result!).Value as List<ContabilidadGastoDTO>;

            var resumen = new ResumenGastos
            {
                TotalGeneral = gastos!.Sum(g => g.Precio),
                PorModulo = gastos.GroupBy(g => g.Modulo).ToDictionary(g => g.Key, g => g.Sum(x => x.Precio)),
                PorRubro = gastos.GroupBy(g => g.Rubro).ToDictionary(g => g.Key, g => g.Sum(x => x.Precio))
            };

            return Ok(resumen);
        }

        // Legacy aliases used by older deployed frontend bundles.
        [HttpGet("resumen")]
        [HttpGet("re_0")]
        public Task<ActionResult<ResumenGastos>> GetResumenFinancieroLegacy(
            [FromQuery] int anio,
            [FromQuery] int? mes,
            [FromQuery] string? modulo,
            [FromQuery] bool? esPendiente,
            [FromQuery] bool? esSolicitudCredito,
            [FromQuery] string? rubro,
            [FromQuery] string? search,
            [FromQuery] DateTime? fechaFiltro,
            [FromQuery] string? estado)
        {
            return GetResumenFinanciero(anio, mes, modulo, esPendiente, esSolicitudCredito, rubro, search, fechaFiltro, estado);
        }

        [HttpPost("update-estado")]
        public async Task<IActionResult> UpdateEstado([FromBody] UpdateEstadoDTO dto)
        {
            switch (dto.Modulo)
            {
                case "Producción":
                    var prod = await _context.Produccion_Gastos.FindAsync(dto.Id);
                    if (prod != null && prod.TipoHoraId == null && prod.TipoRecargoId == null) prod.Estado = dto.Estado;
                    break;
                case "Talleres":
                    var tall = await _context.Talleres_Gastos.FindAsync(dto.Id);
                    if (tall != null && tall.TipoHoraId == null && tall.TipoRecargoId == null) tall.Estado = dto.Estado;
                    break;
                case "Mantenimiento":
                    var mant = await _context.Mantenimiento_Gastos.FindAsync(dto.Id);
                    if (mant != null && mant.TipoHoraId == null && mant.TipoRecargoId == null) mant.Estado = dto.Estado;
                    break;
                case "Gestión Humana":
                    var gh = await _context.GH_GastosMensuales.FindAsync(dto.Id);
                    if (gh != null) gh.Estado = dto.Estado;
                    break;
                case "SST":
                    var sst = await _context.SST_GastosMensuales.FindAsync(dto.Id);
                    if (sst != null) sst.Estado = dto.Estado;
                    break;
                case "Planeación":
                    var plan = await _context.Planeacion_Gastos.FindAsync(dto.Id);
                    if (plan != null && plan.TipoHoraId == null && plan.TipoRecargoId == null) plan.Estado = dto.Estado;
                    break;
                case "Diseño":
                    var dis = await _context.Diseno_Gastos.FindAsync(dto.Id);
                    if (dis != null) dis.Estado = dto.Estado;
                    break;
                case "Contabilidad":
                    var cg = await _context.Contabilidad_Gastos.FindAsync(dto.Id);
                    if (cg != null) cg.Estado = dto.Estado;
                    break;
                default:
                    return BadRequest("Módulo no válido");
            }

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpGet("export-excel")]
        public async Task<IActionResult> ExportExcel(
            [FromQuery] int anio,
            [FromQuery] int? mes,
            [FromQuery] string? modulo,
            [FromQuery] bool? esPendiente,
            [FromQuery] bool? esSolicitudCredito,
            [FromQuery] string? rubro,
            [FromQuery] string? search,
            [FromQuery] DateTime? fechaFiltro,
            [FromQuery] string? estado,
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] bool? incluirHorasExtrasRecargos,
            [FromQuery] bool? incluirIngresos)
        {
            var exportPorRango = fechaInicio.HasValue && fechaFin.HasValue;
            // Si el modal trae inicio y fin, consultar por ese rango en BD (no limitar al mes del filtro de pantalla).
            var consolidado = await GetGastosConsolidados(
                anio,
                mes,
                modulo,
                esPendiente,
                esSolicitudCredito,
                rubro,
                search,
                exportPorRango ? null : fechaFiltro,
                estado,
                exportPorRango ? fechaInicio : null,
                exportPorRango ? fechaFin : null);
            var gastos = ((OkObjectResult)consolidado.Result!).Value as List<ContabilidadGastoDTO> ?? new List<ContabilidadGastoDTO>();

            if (!exportPorRango && fechaInicio.HasValue)
            {
                var fi = fechaInicio.Value.Date;
                gastos = gastos.Where(g => g.Fecha.Date >= fi).ToList();
            }

            if (!exportPorRango && fechaFin.HasValue)
            {
                var ff = fechaFin.Value.Date;
                gastos = gastos.Where(g => g.Fecha.Date <= ff).ToList();
            }

            if (!exportPorRango && fechaFiltro.HasValue)
            {
                var fd = fechaFiltro.Value.Date;
                gastos = gastos.Where(g => g.Fecha.Date == fd).ToList();
            }

            // Opciones de exportación (null = incluir todo, compatible con clientes antiguos)
            if (incluirHorasExtrasRecargos == false)
                gastos = gastos.Where(g => !g.EsLabor).ToList();
            if (incluirIngresos == false)
                gastos = gastos.Where(g => !g.EsIngreso).ToList();

            using var package = new ExcelPackage();
            var ws = package.Workbook.Worksheets.Add("Gastos Contabilidad");

            var headers = new[]
            {
                "Tipo Movimiento",
                "Fecha",
                "Área",
                "Registrado por",
                "Estado Legalización",
                "Estado Proceso",
                "Rubro",
                "Proveedor",
                "Medio de pago",
                "Precio base",
                "Precio IVA",
                "Total",
                "Detalle del Gasto"
            };

            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cells[1, i + 1].Value = headers[i];
                ws.Cells[1, i + 1].Style.Font.Bold = true;
            }

            var row = 2;
            foreach (var g in gastos.OrderByDescending(x => x.Fecha))
            {
                ws.Cells[row, 1].Value = g.EsIngreso ? "Ingreso" : "Gasto";
                ws.Cells[row, 2].Value = g.Fecha.ToString("dd/MM/yyyy");
                ws.Cells[row, 3].Value = g.Modulo;
                ws.Cells[row, 4].Value = g.RegistradoPor ?? "";
                ws.Cells[row, 5].Value = g.EsPendiente ? "Pendiente" : "Legalizado";
                ws.Cells[row, 6].Value = string.IsNullOrWhiteSpace(g.Estado) ? "N/A" : g.Estado;
                ws.Cells[row, 7].Value = g.Rubro;
                ws.Cells[row, 8].Value = g.Proveedor ?? "";
                ws.Cells[row, 9].Value = MedioPagoContabilidadExcel(g);
                var tieneDesglose = g.PrecioBase.HasValue && g.PrecioIva.HasValue;
                ws.Cells[row, 10].Value = tieneDesglose ? (object)Math.Abs(g.PrecioBase!.Value) : "";
                ws.Cells[row, 11].Value = tieneDesglose ? (object)Math.Abs(g.PrecioIva!.Value) : "";
                ws.Cells[row, 12].Value = Math.Abs(g.Precio);
                ws.Cells[row, 13].Value = g.Nota ?? "";
                row++;
            }

            if (row > 2)
            {
                ws.Cells[2, 10, row - 1, 12].Style.Numberformat.Format = "$ #,##0";
            }

            if (gastos.Count > 0)
            {
                var conDesglose = gastos.Where(g => g.PrecioBase.HasValue && g.PrecioIva.HasValue);
                var totalBase = conDesglose.Sum(g => Math.Abs(g.PrecioBase!.Value));
                var totalIva = conDesglose.Sum(g => Math.Abs(g.PrecioIva!.Value));
                var totalGeneral = gastos.Sum(x => Math.Abs(x.Precio));

                // Etiqueta en columna "Medio de pago"; totales alineados con Precio base, IVA y Total
                ws.Cells[row, 9].Value = "TOTAL GENERAL";
                ws.Cells[row, 9].Style.Font.Bold = true;
                ws.Cells[row, 10].Value = totalBase;
                ws.Cells[row, 10].Style.Font.Bold = true;
                ws.Cells[row, 10].Style.Numberformat.Format = "$ #,##0";
                ws.Cells[row, 11].Value = totalIva;
                ws.Cells[row, 11].Style.Font.Bold = true;
                ws.Cells[row, 11].Style.Numberformat.Format = "$ #,##0";
                ws.Cells[row, 12].Value = totalGeneral;
                ws.Cells[row, 12].Style.Font.Bold = true;
                ws.Cells[row, 12].Style.Numberformat.Format = "$ #,##0";
            }

            ws.Cells[ws.Dimension.Address].AutoFitColumns();

            // Hoja 2: Resumen por área y estado
            var wsResumen = package.Workbook.Worksheets.Add("Resumen");

            wsResumen.Cells[1, 1].Value = "Resumen de Gastos";
            wsResumen.Cells[1, 1].Style.Font.Bold = true;
            wsResumen.Cells[1, 1].Style.Font.Size = 14;

            wsResumen.Cells[3, 1].Value = "Totales por Área";
            wsResumen.Cells[3, 1].Style.Font.Bold = true;
            wsResumen.Cells[4, 1].Value = "Área";
            wsResumen.Cells[4, 2].Value = "Total";
            wsResumen.Cells[4, 1, 4, 2].Style.Font.Bold = true;

            var resumenPorArea = gastos
                .GroupBy(g => g.Modulo)
                .Select(g => new { Area = g.Key, Total = g.Sum(x => Math.Abs(x.Precio)) })
                .OrderByDescending(x => x.Total)
                .ToList();

            var resumenRow = 5;
            foreach (var item in resumenPorArea)
            {
                wsResumen.Cells[resumenRow, 1].Value = item.Area;
                wsResumen.Cells[resumenRow, 2].Value = item.Total;
                resumenRow++;
            }

            if (resumenRow > 5)
            {
                wsResumen.Cells[5, 2, resumenRow - 1, 2].Style.Numberformat.Format = "$ #,##0";
            }

            var estadoStartRow = resumenRow + 2;
            wsResumen.Cells[estadoStartRow, 1].Value = "Totales por Estado";
            wsResumen.Cells[estadoStartRow, 1].Style.Font.Bold = true;
            wsResumen.Cells[estadoStartRow + 1, 1].Value = "Estado";
            wsResumen.Cells[estadoStartRow + 1, 2].Value = "Total";
            wsResumen.Cells[estadoStartRow + 1, 1, estadoStartRow + 1, 2].Style.Font.Bold = true;

            var resumenPorEstado = gastos
                .GroupBy(g => string.IsNullOrWhiteSpace(g.Estado) ? "N/A" : g.Estado)
                .Select(g => new { Estado = g.Key, Total = g.Sum(x => Math.Abs(x.Precio)) })
                .OrderByDescending(x => x.Total)
                .ToList();

            var estadoRow = estadoStartRow + 2;
            foreach (var item in resumenPorEstado)
            {
                wsResumen.Cells[estadoRow, 1].Value = item.Estado;
                wsResumen.Cells[estadoRow, 2].Value = item.Total;
                estadoRow++;
            }

            if (estadoRow > estadoStartRow + 2)
            {
                wsResumen.Cells[estadoStartRow + 2, 2, estadoRow - 1, 2].Style.Numberformat.Format = "$ #,##0";
            }

            var legalizacionStartRow = estadoRow + 2;
            wsResumen.Cells[legalizacionStartRow, 1].Value = "Totales por Legalización";
            wsResumen.Cells[legalizacionStartRow, 1].Style.Font.Bold = true;
            wsResumen.Cells[legalizacionStartRow + 1, 1].Value = "Legalización";
            wsResumen.Cells[legalizacionStartRow + 1, 2].Value = "Total";
            wsResumen.Cells[legalizacionStartRow + 1, 1, legalizacionStartRow + 1, 2].Style.Font.Bold = true;

            var resumenPorLegalizacion = gastos
                .GroupBy(g => g.EsPendiente ? "Pendiente" : "Legalizado")
                .Select(g => new { EstadoLegalizacion = g.Key, Total = g.Sum(x => Math.Abs(x.Precio)) })
                .OrderByDescending(x => x.Total)
                .ToList();

            var legalizacionRow = legalizacionStartRow + 2;
            foreach (var item in resumenPorLegalizacion)
            {
                wsResumen.Cells[legalizacionRow, 1].Value = item.EstadoLegalizacion;
                wsResumen.Cells[legalizacionRow, 2].Value = item.Total;
                legalizacionRow++;
            }

            if (legalizacionRow > legalizacionStartRow + 2)
            {
                wsResumen.Cells[legalizacionStartRow + 2, 2, legalizacionRow - 1, 2].Style.Numberformat.Format = "$ #,##0";
            }

            var ingresosStartRow = legalizacionRow + 2;
            wsResumen.Cells[ingresosStartRow, 1].Value = "Ingresos de Contabilidad";
            wsResumen.Cells[ingresosStartRow, 1].Style.Font.Bold = true;
            wsResumen.Cells[ingresosStartRow + 1, 1].Value = "Concepto";
            wsResumen.Cells[ingresosStartRow + 1, 2].Value = "Total";
            wsResumen.Cells[ingresosStartRow + 1, 1, ingresosStartRow + 1, 2].Style.Font.Bold = true;

            var totalIngresos = gastos.Where(g => g.EsIngreso).Sum(g => Math.Abs(g.Precio));
            wsResumen.Cells[ingresosStartRow + 2, 1].Value = "Ingresos registrados";
            wsResumen.Cells[ingresosStartRow + 2, 2].Value = totalIngresos;
            wsResumen.Cells[ingresosStartRow + 2, 2].Style.Numberformat.Format = "$ #,##0";

            wsResumen.Cells[wsResumen.Dimension.Address].AutoFitColumns();

            var fileName = $"Contabilidad_Gastos_{DateTime.Now:yyyyMMdd_HHmm}.xlsx";
            return File(
                package.GetAsByteArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName
            );
        }

        [HttpPost("ingresos")]
        public async Task<ActionResult<Contabilidad_Ingreso>> CrearIngreso([FromBody] NuevoIngresoDTO dto)
        {
            if (string.IsNullOrWhiteSpace(dto.MotivoIngreso))
                return BadRequest("El motivo del ingreso es obligatorio.");

            if (dto.Cantidad <= 0)
                return BadRequest("La cantidad del ingreso debe ser mayor que cero.");

            var ingreso = new Contabilidad_Ingreso
            {
                MotivoIngreso = dto.MotivoIngreso.Trim(),
                Cantidad = dto.Cantidad,
                Fecha = dto.Fecha == default ? DateTime.Today : dto.Fecha.Date,
                PdfUrl = string.IsNullOrWhiteSpace(dto.PdfUrl) ? null : dto.PdfUrl.Trim()
            };

            _context.Contabilidad_Ingresos.Add(ingreso);
            await _context.SaveChangesAsync();
            return Ok(ingreso);
        }

        [HttpPut("ingresos/{id}")]
        public async Task<ActionResult<Contabilidad_Ingreso>> ActualizarIngreso(int id, [FromBody] NuevoIngresoDTO dto)
        {
            var ingreso = await _context.Contabilidad_Ingresos.FindAsync(id);
            if (ingreso == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.MotivoIngreso))
                return BadRequest("El motivo del ingreso es obligatorio.");

            if (dto.Cantidad <= 0)
                return BadRequest("La cantidad del ingreso debe ser mayor que cero.");

            ingreso.MotivoIngreso = dto.MotivoIngreso.Trim();
            ingreso.Cantidad = dto.Cantidad;
            ingreso.Fecha = dto.Fecha == default ? ingreso.Fecha : dto.Fecha.Date;
            ingreso.PdfUrl = string.IsNullOrWhiteSpace(dto.PdfUrl) ? ingreso.PdfUrl : dto.PdfUrl.Trim();

            await _context.SaveChangesAsync();
            return Ok(ingreso);
        }

        [HttpDelete("ingresos/{id}")]
        public async Task<IActionResult> EliminarIngreso(int id)
        {
            var ingreso = await _context.Contabilidad_Ingresos.FindAsync(id);
            if (ingreso == null) return NotFound();

            _context.Contabilidad_Ingresos.Remove(ingreso);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("upload-ingreso-pdf")]
        public async Task<ActionResult> UploadIngresoPdf(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No se recibió archivo." });

            if (!file.ContentType.Contains("pdf") && !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Solo se permiten archivos PDF." });

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "ingresos_contabilidad");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsDir, uniqueFileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = $"/uploads/ingresos_contabilidad/{uniqueFileName}" });
        }

        [HttpPost("upload-factura-gasto")]
        public async Task<ActionResult> UploadFacturaGastoContabilidad(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No se recibió archivo." });

            if (!file.ContentType.Contains("pdf") && !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Solo se permiten archivos PDF." });

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "facturas_contabilidad");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsDir, uniqueFileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { url = $"/uploads/facturas_contabilidad/{uniqueFileName}" });
        }

        /// <summary>Rubros y proveedores ya usados en gastos de contabilidad (para listas dinámicas en el formulario).</summary>
        [HttpGet("gastos/maestros")]
        public async Task<ActionResult<object>> GetGastosContabilidadMaestros()
        {
            var rubros = await _context.Contabilidad_Gastos
                .AsNoTracking()
                .Select(g => g.Rubro)
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Distinct()
                .OrderBy(r => r)
                .ToListAsync();

            var proveedores = await _context.Contabilidad_Gastos
                .AsNoTracking()
                .Select(g => g.Proveedor)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Distinct()
                .OrderBy(p => p)
                .ToListAsync();

            return Ok(new { rubros, proveedores });
        }

        [HttpPost("gastos")]
        public async Task<IActionResult> CrearGastoContabilidad([FromBody] ContabilidadGastoWriteDTO dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Rubro))
                return BadRequest(new { message = "El rubro es obligatorio." });
            if (string.IsNullOrWhiteSpace(dto.Proveedor))
                return BadRequest(new { message = "El proveedor es obligatorio." });

            var mp = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(false, dto.EsSolicitudCredito, dto.EsEfectivo);
            if (mp != null) return mp;

            var rubro = dto.Rubro.Trim();
            var p = dto.Precio;
            var pb = dto.PrecioBase;
            var pi = dto.PrecioIva;
            var errIv = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, null, null, rubro, ref p, ref pb, ref pi);
            if (errIv != null) return errIv;

            var fecha = dto.Fecha == default ? DateTime.Today : dto.Fecha.Date;

            var entity = new Contabilidad_Gasto
            {
                Rubro = rubro.Length > 200 ? rubro[..200] : rubro,
                Proveedor = dto.Proveedor.Trim().Length > 200 ? dto.Proveedor.Trim()[..200] : dto.Proveedor.Trim(),
                NumeroFactura = string.IsNullOrWhiteSpace(dto.NumeroFactura) ? null : dto.NumeroFactura.Trim(),
                Precio = p,
                PrecioBase = pb,
                PrecioIva = pi,
                Fecha = fecha,
                Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones) ? null : dto.Observaciones.Trim(),
                FacturaPdfUrl = string.IsNullOrWhiteSpace(dto.FacturaPdfUrl) ? null : dto.FacturaPdfUrl.Trim(),
                EsPendiente = dto.EsPendiente,
                EsSolicitudCredito = dto.EsSolicitudCredito,
                EsEfectivo = dto.EsEfectivo,
                Estado = "Montado",
                Anio = fecha.Year,
                Mes = fecha.Month,
                FechaCreacion = DateTime.UtcNow
            };

            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
                entity.CreadoPorId = adminId;

            _context.Contabilidad_Gastos.Add(entity);
            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpPut("gastos/{id}")]
        public async Task<IActionResult> ActualizarGastoContabilidad(int id, [FromBody] ContabilidadGastoWriteDTO dto)
        {
            var entity = await _context.Contabilidad_Gastos.FindAsync(id);
            if (entity == null) return NotFound();

            if (string.IsNullOrWhiteSpace(dto.Rubro))
                return BadRequest(new { message = "El rubro es obligatorio." });
            if (string.IsNullOrWhiteSpace(dto.Proveedor))
                return BadRequest(new { message = "El proveedor es obligatorio." });

            var mp = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(false, dto.EsSolicitudCredito, dto.EsEfectivo);
            if (mp != null) return mp;

            var rubro = dto.Rubro.Trim();
            var p = dto.Precio;
            var pb = dto.PrecioBase;
            var pi = dto.PrecioIva;
            var errIv = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, null, null, rubro, ref p, ref pb, ref pi);
            if (errIv != null) return errIv;

            var fecha = dto.Fecha == default ? entity.Fecha.Date : dto.Fecha.Date;

            entity.Rubro = rubro.Length > 200 ? rubro[..200] : rubro;
            entity.Proveedor = dto.Proveedor.Trim().Length > 200 ? dto.Proveedor.Trim()[..200] : dto.Proveedor.Trim();
            entity.NumeroFactura = string.IsNullOrWhiteSpace(dto.NumeroFactura) ? null : dto.NumeroFactura.Trim();
            entity.Precio = p;
            entity.PrecioBase = pb;
            entity.PrecioIva = pi;
            entity.Fecha = fecha;
            entity.Anio = fecha.Year;
            entity.Mes = fecha.Month;
            entity.Observaciones = string.IsNullOrWhiteSpace(dto.Observaciones) ? null : dto.Observaciones.Trim();
            entity.FacturaPdfUrl = string.IsNullOrWhiteSpace(dto.FacturaPdfUrl) ? entity.FacturaPdfUrl : dto.FacturaPdfUrl.Trim();
            entity.EsPendiente = dto.EsPendiente;
            entity.EsSolicitudCredito = dto.EsSolicitudCredito;
            entity.EsEfectivo = dto.EsEfectivo;
            entity.FechaModificacion = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("gastos/{id}")]
        public async Task<IActionResult> EliminarGastoContabilidad(int id)
        {
            var entity = await _context.Contabilidad_Gastos.FindAsync(id);
            if (entity == null) return NotFound();
            _context.Contabilidad_Gastos.Remove(entity);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        public class UpdateEstadoDTO
        {
            public string Modulo { get; set; } = string.Empty;
            public int Id { get; set; }
            public string Estado { get; set; } = string.Empty;
        }
    }
}
