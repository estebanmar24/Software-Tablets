using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProduccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITiempoProcesoService _tiempoProcesoService;
    private readonly IWebHostEnvironment _env;
    private readonly GastoAutorizacionService _gastoAutorizacion;

    public ProduccionController(
        AppDbContext context,
        ITiempoProcesoService tiempoProcesoService,
        IWebHostEnvironment env,
        GastoAutorizacionService gastoAutorizacion)
    {
        _context = context;
        _tiempoProcesoService = tiempoProcesoService;
        _env = env;
        _gastoAutorizacion = gastoAutorizacion;
    }

    [AllowAnonymous]
    [HttpGet("maestros")]
    public async Task<ActionResult> GetMaestros()
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var proveedores = await ProveedorRubroHelper.ListProduccionProveedoresAsync(_context);
        var tiposHora = await _context.Produccion_TiposHora.Where(t => t.Activo).ToListAsync();
        var tiposRecargo = await _context.Produccion_TiposRecargo.Where(t => t.Activo).ToListAsync();
        
        // Existing tables
        var maquinas = await _context.Maquinas.Where(m => m.Activo && m.Nombre != null && !m.Nombre.Contains("TERMINADOS")).Select(m => new { m.Id, m.Nombre }).ToListAsync();
        
        // Ordenamiento Natural (1, 2, ... 10)
        maquinas = maquinas.OrderBy(m => 
        {
            var match = System.Text.RegularExpressions.Regex.Match(m.Nombre ?? "", @"^\d+");
            return match.Success ? int.Parse(match.Value) : int.MaxValue;
        })
        .ThenBy(m => m.Nombre ?? "")
        .ToList();

        var usuarios = await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new { u.Id, u.Nombre, u.Salario, u.Documento })
            .ToListAsync();

        var productos = await _context.Produccion_Productos.Where(p => p.Activo).ToListAsync();

        return Ok(new
        {
            rubros,
            productos,
            proveedores,
            tiposHora,
            tiposRecargo,
            maquinas,
            usuarios
        });
    }

    // --- PRODUCTOS ---

    [HttpGet("productos")]
    public async Task<ActionResult> GetProductos()
    {
        return Ok(await _context.Produccion_Productos.Include(p => p.Rubro).OrderBy(p => p.Nombre).ToListAsync());
    }

    [HttpPost("productos")]
    public async Task<ActionResult> CreateProducto(Produccion_Producto producto)
    {
        _context.Produccion_Productos.Add(producto);
        await _context.SaveChangesAsync();
        return Ok(producto);
    }

    [HttpPut("productos/{id}")]
    public async Task<ActionResult> UpdateProducto(int id, Produccion_Producto producto)
    {
        if (id != producto.Id) return BadRequest();
        _context.Entry(producto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return Ok(producto);
    }

    [HttpDelete("productos/{id}")]
    public async Task<ActionResult> DeleteProducto(int id)
    {
        var producto = await _context.Produccion_Productos.FindAsync(id);
        if (producto == null) return NotFound();
        
        producto.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }









    /// <summary>
    /// Get available periods (month/year combinations) with production data
    /// </summary>
    [HttpGet("periodos-disponibles")]
    public async Task<ActionResult> GetPeriodosDisponibles()
    {
        var periodos = await _context.ProduccionDiaria
            .Select(p => new { Mes = p.Fecha.Month, Anio = p.Fecha.Year })
            .Distinct()
            .OrderByDescending(p => p.Anio)
            .ThenByDescending(p => p.Mes)
            .ToListAsync();
        return Ok(periodos);
    }

    /// <summary>
    /// Exportación mensual consolidada para todas las máquinas.
    /// Incluye: resumen de ProduccionDiaria y detalle de TiempoProceso (con subcódigos).
    /// </summary>
    [HttpGet("export-mensual")]
    public async Task<ActionResult> GetExportMensual([FromQuery] int mes, [FromQuery] int anio)
    {
        if (mes < 1 || mes > 12)
            return BadRequest("Mes inválido");

        if (anio < 2000 || anio > 2100)
            return BadRequest("Año inválido");

        var resumen = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Include(p => p.Horario)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .OrderBy(p => p.Maquina != null ? p.Maquina.Nombre : "")
            .ThenBy(p => p.Fecha)
            .ThenBy(p => p.Usuario != null ? p.Usuario.Nombre : "")
            .Select(p => new
            {
                p.Id,
                Fecha = p.Fecha.ToString("yyyy-MM-dd"),
                MaquinaId = p.MaquinaId,
                Maquina = p.Maquina != null ? p.Maquina.Nombre : "",
                UsuarioId = p.UsuarioId,
                Operario = p.Usuario != null ? p.Usuario.Nombre : "",
                Horario = p.Horario != null ? p.Horario.Nombre : "",
                HoraInicio = p.HoraInicio.HasValue ? p.HoraInicio.Value.ToString(@"hh\:mm") : "",
                HoraFin = p.HoraFin.HasValue ? p.HoraFin.Value.ToString(@"hh\:mm") : "",
                p.RendimientoFinal,
                p.HorasOperativas,
                p.Cambios,
                p.TiempoPuestaPunto,
                p.TirosDiarios,
                TirosConEquivalencia = p.TirosConEquivalencia,
                p.TotalHorasProductivas,
                p.PromedioHoraProductiva,
                p.TirosBonificables,
                p.ValorTiroSnapshot,
                p.ValorAPagar,
                p.ValorAPagarBonificable,
                p.HorasMantenimiento,
                p.HorasDescanso,
                p.HorasOtrosAux,
                p.TotalHorasAuxiliares,
                p.TiempoFaltaTrabajo,
                p.TiempoReparacion,
                p.TiempoOtroMuerto,
                p.TotalTiemposMuertos,
                p.TotalHoras,
                p.Desperdicio,
                p.ReferenciaOP,
                p.Novedades
            })
            .ToListAsync();

        var detalleTiempos = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio)
            .OrderBy(t => t.Maquina != null ? t.Maquina.Nombre : "")
            .ThenBy(t => t.Fecha)
            .ThenBy(t => t.HoraInicio)
            .Select(t => new
            {
                t.Id,
                Fecha = t.Fecha.ToString("yyyy-MM-dd"),
                MaquinaId = t.MaquinaId,
                Maquina = t.Maquina != null ? t.Maquina.Nombre : "",
                UsuarioId = t.UsuarioId,
                Operario = t.Usuario != null ? t.Usuario.Nombre : "",
                ActividadCodigo = t.Actividad != null ? t.Actividad.Codigo : "",
                Actividad = t.Actividad != null ? t.Actividad.Nombre : "",
                SubCodigoActividad = t.SubCodigoActividad ?? "",
                SubCodigoDetalle = t.SubCodigoDetalle ?? "",
                HoraInicio = t.HoraInicio.ToString("HH:mm:ss"),
                HoraFin = t.HoraFin.ToString("HH:mm:ss"),
                DuracionHoras = Math.Round(TimeSpan.FromTicks(t.Duracion).TotalHours, 2),
                t.Tiros,
                t.Desperdicio,
                ReferenciaOP = t.OrdenProduccion != null ? t.OrdenProduccion.Numero : "",
                Observaciones = t.Observaciones ?? ""
            })
            .ToListAsync();

        return Ok(new
        {
            mes,
            anio,
            totalRegistrosResumen = resumen.Count,
            totalRegistrosDetalle = detalleTiempos.Count,
            resumen,
            detalleTiempos
        });
    }

    /// <summary>
    /// Get operators that have production data for a given month/year
    /// Returns grouped by usuario+maquina with days count for CaptureGridScreen modal
    /// </summary>
    [HttpGet("operarios-con-datos")]
    public async Task<ActionResult> GetOperariosConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => new {
                usuarioId = g.Key.UsuarioId,
                usuarioNombre = g.First().Usuario != null ? g.First().Usuario.Nombre : "Desconocido",
                maquinaId = g.Key.MaquinaId,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.usuarioNombre)
            .ThenBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get machines that have production data for a given month/year
    /// Returns with maquinaId, maquinaNombre, and diasRegistrados for CaptureGridScreen modal
    /// </summary>
    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult> GetMaquinasConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => p.MaquinaId)
            .Select(g => new {
                maquinaId = g.Key,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get detailed daily production records for a specific operator and machine
    /// Used by CaptureGridScreen to populate the grid
    /// </summary>
    [HttpGet("detalles")]
    public async Task<ActionResult> GetDetalles(int mes, int anio, int maquinaId, int usuarioId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }

    /// <summary>
    /// Get detailed daily production records for a specific machine (all operators)
    /// Used by CaptureGridScreen when filtered by machine
    /// </summary>
    [HttpGet("detalles-maquina")]
    public async Task<ActionResult> GetDetallesMaquina(int mes, int anio, int maquinaId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }

    /// <summary>
    /// Get detailed daily production records for a specific operator (all machines)
    /// Used by Dashboard report to build OP traceability and machine usage.
    /// </summary>
    [HttpGet("detalles-operario")]
    public async Task<ActionResult> GetDetallesOperario(int mes, int anio, int usuarioId)
    {
        var detalles = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.UsuarioId == usuarioId)
            .OrderBy(p => p.Fecha)
            .ThenBy(p => p.MaquinaId)
            .Select(p => new
            {
                p.Id,
                p.Fecha,
                p.UsuarioId,
                p.MaquinaId,
                MaquinaNombre = p.Maquina != null ? p.Maquina.Nombre : "Desconocida",
                p.HoraInicio,
                p.HoraFin,
                p.HorasOperativas,
                p.TirosDiarios,
                TirosConEquivalencia = p.TirosConEquivalencia,
                p.Cambios,
                p.TiempoPuestaPunto,
                p.TotalHorasProductivas,
                p.HorasMantenimiento,
                p.HorasDescanso,
                p.HorasOtrosAux,
                p.TotalTiemposMuertos,
                p.TotalHoras,
                p.ValorAPagar,
                p.ValorAPagarBonificable,
                p.ValorTiroSnapshot,
                p.ReferenciaOP,
                p.Desperdicio
            })
            .ToListAsync();
        return Ok(detalles);
    }

    /// <summary>
    /// Obtiene detalle de tiempos para una actividad específica (ej: Reparación),
    /// incluyendo subcódigos registrados, para modal de consulta en cuadro master.
    /// </summary>
    [HttpGet("detalle-tiempo")]
    public async Task<ActionResult> GetDetalleTiempo(
        [FromQuery] int mes,
        [FromQuery] int anio,
        [FromQuery] int maquinaId,
        [FromQuery] string actividadCodigo)
    {
        if (string.IsNullOrWhiteSpace(actividadCodigo))
            return BadRequest("actividadCodigo es requerido");

        var codigo = actividadCodigo.Trim();

        var data = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t =>
                t.Fecha.Month == mes &&
                t.Fecha.Year == anio &&
                t.MaquinaId == maquinaId &&
                t.Actividad != null &&
                t.Actividad.Codigo == codigo)
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.HoraInicio)
            .Select(t => new
            {
                t.Id,
                Fecha = t.Fecha.ToString("yyyy-MM-dd"),
                HoraInicio = t.HoraInicio.ToString("HH:mm:ss"),
                HoraFin = t.HoraFin.ToString("HH:mm:ss"),
                DuracionHoras = Math.Round(TimeSpan.FromTicks(t.Duracion).TotalHours, 2),
                Operario = t.Usuario != null ? t.Usuario.Nombre : "",
                Maquina = t.Maquina != null ? t.Maquina.Nombre : "",
                Actividad = t.Actividad != null ? t.Actividad.Nombre : "",
                ActividadCodigo = t.Actividad != null ? t.Actividad.Codigo : "",
                SubCodigoActividad = t.SubCodigoActividad,
                SubCodigoDetalle = t.SubCodigoDetalle,
                ReferenciaOP = t.OrdenProduccion != null ? t.OrdenProduccion.Numero : "",
                t.Tiros,
                t.Desperdicio,
                t.Observaciones
            })
            .ToListAsync();

        return Ok(data);
    }


    /// <summary>
    /// Delete production data for a specific period, optionally filtered by user or machine
    /// </summary>
    [HttpDelete("borrar")]
    public async Task<IActionResult> BorrarProduccion(int mes, int anio, int? usuarioId = null, int? maquinaId = null)
    {
        // 1. Borrar de ProduccionDiaria
        var query = _context.ProduccionDiaria.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        // Queries para TiemposProceso y RegistrosDesperdicio
        var queryTiempos = _context.TiemposProceso.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);
        var queryDesperdicios = _context.RegistrosDesperdicio.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (usuarioId.HasValue)
        {
            query = query.Where(p => p.UsuarioId == usuarioId.Value);
            queryTiempos = queryTiempos.Where(p => p.UsuarioId == usuarioId.Value);
            queryDesperdicios = queryDesperdicios.Where(p => p.UsuarioId == usuarioId.Value);
        }

        if (maquinaId.HasValue)
        {
            query = query.Where(p => p.MaquinaId == maquinaId.Value);
            queryTiempos = queryTiempos.Where(p => p.MaquinaId == maquinaId.Value);
            queryDesperdicios = queryDesperdicios.Where(p => p.MaquinaId == maquinaId.Value);
        }

        var records = await query.ToListAsync();
        var tiempos = await queryTiempos.ToListAsync();
        var desperdicios = await queryDesperdicios.ToListAsync();

        if (!records.Any() && !tiempos.Any())
        {
            return NotFound("No se encontraron registros para borrar con los filtros proporcionados.");
        }

        _context.ProduccionDiaria.RemoveRange(records);
        _context.TiemposProceso.RemoveRange(tiempos);
        // _context.RegistrosDesperdicio.RemoveRange(desperdicios); // Preservar desperdicios manuales

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Se eliminaron {records.Count} de resumen y {tiempos.Count} detalles. Los desperdicios ({desperdicios.Count}) se mantuvieron intactos." });
    }

    [HttpPost("importar-excel")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportarExcel([FromForm] DTOs.ExcelImportDto dto)
    {
        var file = dto.File;
        var maquinaId = dto.MaquinaId;
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No se ha subido ningún archivo" });

        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "El archivo debe ser un Excel (.xlsx)" });

        try
        {
            using (var stream = new MemoryStream())
            {
                await file.CopyToAsync(stream);
                OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
                using (var package = new OfficeOpenXml.ExcelPackage(stream))
                {
                    var worksheet = package.Workbook.Worksheets[0]; // Leer la primera hoja
                    
                    if (worksheet.Dimension == null)
                        return BadRequest(new { error = "El archivo Excel no tiene un área con datos definida (hoja vacía)" });

                    var rowCount = worksheet.Dimension.Rows;
                    var colCount = worksheet.Dimension.Columns;

                    if (rowCount < 2) 
                        return BadRequest(new { error = "El archivo Excel está vacío o no tiene datos" });

                    // 1. Pre-cargar maestros para optimizar y permitir búsqueda flexible
                    var usuarios = await _context.Usuarios.ToListAsync();
                    var maquinas = await _context.Maquinas.ToListAsync();
                    var actividades = await _context.Actividades.ToListAsync();

                    var headers = new Dictionary<string, int>();
                    for (int col = 1; col <= colCount; col++)
                    {
                        var cabecera = worksheet.Cells[1, col].Value?.ToString()?.ToLower().Trim() ?? "";
                        if (!string.IsNullOrEmpty(cabecera)) headers[cabecera] = col;
                    }

                    // 2. Validar columnas mínimas
                    bool hasMaquina = headers.ContainsKey("maquina") || headers.ContainsKey("máquina");
                    if (!headers.ContainsKey("fecha") || (!hasMaquina && maquinaId == null))
                        return BadRequest(new { error = "El Excel debe contener la columna 'Fecha'. La columna 'Maquina' es necesaria si no se selecciona una en la pantalla." });

                    var filasExcel = new List<ProduccionDiariaDetalleDto>();
                    var agrupaciones = new Dictionary<string, ProduccionDiariaDto>();

                    // Procesar filas
                    for (int row = 2; row <= rowCount; row++)
                    {
                        try 
                        {
                            var fechaVal = worksheet.Cells[row, headers.ContainsKey("fecha") ? headers["fecha"] : 1].Value;
                            if (fechaVal == null) continue;

                            DateTime fecha;
                            if (fechaVal is DateTime dt) fecha = dt;
                            else if (!DateTime.TryParse(fechaVal.ToString(), out fecha)) continue;

                            // Obtener Máquina
                            var maquina = maquinas.FirstOrDefault(m => m.Id == maquinaId); // Prioridad al fallback si se pasa explícitamente y no hay columna
                            
                            if (hasMaquina)
                            {
                                string maquinaNombre = (headers.ContainsKey("maquina") ? worksheet.Cells[row, headers["maquina"]].Value?.ToString() : null)
                                                     ?? (headers.ContainsKey("máquina") ? worksheet.Cells[row, headers["máquina"]].Value?.ToString() : "") ?? "";
                                
                                var maquinaExt = maquinas.FirstOrDefault(m => string.Equals(m.Nombre, maquinaNombre, StringComparison.OrdinalIgnoreCase))
                                              ?? maquinas.FirstOrDefault(m => m.Nombre.ToLower().Contains(maquinaNombre.ToLower()) && maquinaNombre.Length > 3);
                                
                                if (maquinaExt != null) maquina = maquinaExt;
                            }

                            if (maquina == null) continue;

                            // Obtener Operario (Fuzzy Match)
                            string operarioExcel = (headers.ContainsKey("operario") ? worksheet.Cells[row, headers["operario"]].Value?.ToString() : null)
                                                   ?? (headers.ContainsKey("nombre") ? worksheet.Cells[row, headers["nombre"]].Value?.ToString() : "") ?? "";
                            
                            var usuario = BusquedaFuzzyUsuario(usuarios, operarioExcel);
                            if (usuario == null) usuario = usuarios.FirstOrDefault(u => u.Nombre == "Operario General");

                            // Obtener Actividad
                            string actividadExcel = GetStringFromCell(worksheet, row, headers, "actividad") ?? "";
                            string actLower = actividadExcel.ToLower();
                            Actividad actividad = null;

                            // 1. Intentar hacer match por el código numérico si existe al inicio de la cadena (ej. "08 - Tiempo Muerto")
                            var matchCode = System.Text.RegularExpressions.Regex.Match(actividadExcel, @"^(\d{1,2})\b");
                            if (matchCode.Success)
                            {
                                string potentialCode = matchCode.Groups[1].Value.PadLeft(2, '0');
                                actividad = actividades.FirstOrDefault(a => a.Codigo == potentialCode);
                            }

                            // 2. Si no hay match por código, intentar por nombre contenido completo
                            if (actividad == null)
                            {
                                actividad = actividades.FirstOrDefault(a => actLower.Contains(a.Nombre.ToLower()));
                            }

                            // 3. Match flexible por palabras clave comunes si el nombre exacto falló
                            if (actividad == null)
                            {
                                if (actLower.Contains("tiempo muerto") || actLower.Contains("otros muertos")) actividad = actividades.FirstOrDefault(a => a.Codigo == "08");
                                else if (actLower.Contains("falta") && actLower.Contains("trabajo")) actividad = actividades.FirstOrDefault(a => a.Codigo == "13");
                                else if (actLower.Contains("reparacion") || actLower.Contains("reparación")) actividad = actividades.FirstOrDefault(a => a.Codigo == "03");
                                else if (actLower.Contains("mantenimiento")) actividad = actividades.FirstOrDefault(a => a.Codigo == "10");
                                else if (actLower.Contains("descanso") || actLower.Contains("alimento")) actividad = actividades.FirstOrDefault(a => a.Codigo == "04");
                                else if (actLower.Contains("puesta a punto")) actividad = actividades.FirstOrDefault(a => a.Codigo == "01");
                                else if (actLower.Contains("auxiliar") || actLower.Contains("otros tiempo")) actividad = actividades.FirstOrDefault(a => a.Codigo == "14");
                            }

                            // 4. Default: Producción
                            if (actividad == null)
                            {
                                actividad = actividades.FirstOrDefault(a => a.Nombre == "Producción" || a.Codigo == "02");
                            }

                            var comentarioRaw = GetComentarioFromRow(worksheet, row, headers);
                            var subcodigoExplicito = GetStringFromCell(worksheet, row, headers, "subcodigo")
                                ?? GetStringFromCell(worksheet, row, headers, "subc");

                            var detalle = new ProduccionDiariaDetalleDto
                            {
                                HoraInicio = GetStringFromCell(worksheet, row, headers, "inicio") ?? "",
                                HoraFin = GetStringFromCell(worksheet, row, headers, "final") ?? "",
                                ActividadId = actividad?.Id ?? 2,
                                ReferenciaOP = GetStringFromCell(worksheet, row, headers, "orden"),
                                Tiros = (int)(GetDecimalFromCell(worksheet, row, headers, "tiros") ?? 0),
                                Observaciones = comentarioRaw
                            };

                            var actCod = actividad?.Codigo;
                            var parsedSub = !string.IsNullOrWhiteSpace(subcodigoExplicito)
                                ? SubcodigoActividadHelper.TryParseFromText(subcodigoExplicito, actCod)
                                : null;
                            parsedSub ??= SubcodigoActividadHelper.TryParseFromText(comentarioRaw, actCod);
                            if (parsedSub != null)
                            {
                                detalle.SubCodigoActividad = parsedSub.SubCodigoActividad;
                                detalle.SubCodigoDetalle = parsedSub.SubCodigoDetalle;
                                detalle.Observaciones = parsedSub.Observaciones;
                            }

                            // Agrupar por Fecha, Máquina y Usuario
                            string key = $"{fecha:yyyy-MM-dd}_{maquina.Id}_{usuario?.Id}";
                            if (!agrupaciones.ContainsKey(key))
                            {
                                agrupaciones[key] = new ProduccionDiariaDto
                            {
                                Fecha = fecha.ToString("yyyy-MM-dd"),
                                MaquinaId = maquina.Id,
                                    UsuarioId = usuario?.Id ?? 0,
                                    DiaLaborado = 1,
                                    Detalles = new List<ProduccionDiariaDetalleDto>(),
                                    Novedades = "" // Se llenará con la suma de observaciones
                                };
                            }

                            agrupaciones[key].Detalles.Add(detalle);
                            
                            // --- AGREGACIÓN DE TOTALES PARA EL HEADER ---
                            TimeSpan rowStart = ParseTime(detalle.HoraInicio);
                            TimeSpan rowEnd = ParseTime(detalle.HoraFin);
                            double duration = (rowEnd - rowStart).TotalHours;
                            if (duration < 0) duration += 24; // Cruce de medianoche

                            decimal dDuration = (decimal)duration;
                            string actName = actividad?.Nombre.ToLower() ?? "";

                            // Mapeo similar al del frontend
                            if (actName.Contains("producc")) agrupaciones[key].HorasOperativas += dDuration;
                            else if (actName.Contains("puesta a punto")) agrupaciones[key].TiempoPuestaPunto += dDuration;
                            else if (actName.Contains("mantenimiento")) agrupaciones[key].HorasMantenimiento += dDuration;
                            else if (actName.Contains("descanso") || actName.Contains("alimento")) agrupaciones[key].HorasDescanso += dDuration;
                            else if (actName.Contains("falta de trabajo")) agrupaciones[key].TiempoFaltaTrabajo += dDuration;
                            else if (actName.Contains("reparacion") || actName.Contains("reparación")) agrupaciones[key].TiempoReparacion += dDuration;
                            else if (actName.Contains("tiempo muerto")) agrupaciones[key].TiempoOtroMuerto += dDuration;
                            else if (actName.Contains("otros tiempo") || actName.Contains("otros auxiliar")) agrupaciones[key].HorasOtrosAux += dDuration;

                            if (maquina.Id == 11 && (actName.Contains("muert") || actividadExcel.Contains("08")))
                            {
                                Console.WriteLine($"[MAQ11 DEBUG] Fecha: {fecha:yyyy-MM-dd} | ActOrig: {actividadExcel} -> ActMatch: {actName} (Code: {actividad?.Codigo}) | Ini: {detalle.HoraInicio} Fin: {detalle.HoraFin} -> Dur: {duration}hs");
                            }

                            agrupaciones[key].TirosDiarios += detalle.Tiros;
                            agrupaciones[key].RendimientoFinal = agrupaciones[key].TirosDiarios;
                            agrupaciones[key].Desperdicio += (decimal)(GetDecimalFromCell(worksheet, row, headers, "desperdicio") ?? 0);

                            // Cambios (Incrementar si es Puesta a Punto con OP nueva)
                            if (actName.Contains("puesta a punto"))
                            {
                                string opActual = (detalle.ReferenciaOP ?? "").Trim();
                                // Si es el primer detalle o la OP cambió respecto al último registro de este grupo (simplificado)
                                // En el excel granular, solemos contar un cambio por cada bloque de puesta a punto con OP válida.
                                if (!string.IsNullOrEmpty(opActual) && opActual != "460") {
                                    // Para no sobre-contar, comparamos con la última OP agregada a la lista de OPs del grupo
                                    if (!agrupaciones[key].ReferenciaOP?.Contains(opActual) ?? true) {
                                        agrupaciones[key].Cambios++;
                                    }
                                }
                            }

                            // Concatenar OPs (únicas y ordenadas por aparición)
                            if (!string.IsNullOrEmpty(detalle.ReferenciaOP) && detalle.ReferenciaOP != "460")
                            {
                                if (string.IsNullOrEmpty(agrupaciones[key].ReferenciaOP)) 
                                    agrupaciones[key].ReferenciaOP = detalle.ReferenciaOP;
                                else if (!agrupaciones[key].ReferenciaOP.Contains(detalle.ReferenciaOP))
                                    agrupaciones[key].ReferenciaOP += "-" + detalle.ReferenciaOP;
                            }

                            // Rango de horas del día
                            // Agregación inteligente: 
                            // 1. HoraInicio: El menor valor que sea mayor a 00:00.
                            // 2. HoraFin: El mayor valor encontrado.
                            
                            TimeSpan currentStart = string.IsNullOrEmpty(agrupaciones[key].HoraInicio) ? TimeSpan.Zero : ParseTime(agrupaciones[key].HoraInicio);
                            TimeSpan currentFin = string.IsNullOrEmpty(agrupaciones[key].HoraFin) ? TimeSpan.Zero : ParseTime(agrupaciones[key].HoraFin);

                            // Si el nuevo rowStart es > 0, y (el actual es 0 o el nuevo es menor), actualizar.
                            if (rowStart != TimeSpan.Zero) {
                                if (currentStart == TimeSpan.Zero || rowStart < currentStart) {
                                    agrupaciones[key].HoraInicio = detalle.HoraInicio;
                                }
                            }

                            // Si el nuevo rowEnd es mayor al actual, actualizar.
                            if (rowEnd > currentFin) {
                                agrupaciones[key].HoraFin = detalle.HoraFin;
                            }



                            if (!string.IsNullOrEmpty(detalle.Observaciones) && !agrupaciones[key].Novedades.Contains(detalle.Observaciones))
                            {
                                agrupaciones[key].Novedades += (string.IsNullOrEmpty(agrupaciones[key].Novedades) ? "" : "; ") + detalle.Observaciones;
                            }

                            // Totales Productivos
                            agrupaciones[key].TotalHorasProductivas = agrupaciones[key].HorasOperativas + agrupaciones[key].TiempoPuestaPunto;
                            if (agrupaciones[key].TotalHorasProductivas > 0)
                                agrupaciones[key].PromedioHoraProductiva = (agrupaciones[key].RendimientoFinal + (agrupaciones[key].Cambios * maquina.TirosReferencia)) / agrupaciones[key].TotalHorasProductivas;
                            
                            Console.WriteLine($"[IMPORT DEBUG] Key: {key}, Op: {usuario.Nombre}, HorasOp: {agrupaciones[key].HorasOperativas}, Tiros: {agrupaciones[key].TirosDiarios}, Inicio: {agrupaciones[key].HoraInicio}");

                        }
                        catch (Exception exRow)
                        {
                            Console.WriteLine($"Error procesando fila {row}: {exRow.Message}");
                        }
                    }
                    
                    if (agrupaciones.Any())
                    {
                        // Retornar para previsualización
                        var res = agrupaciones.Values.Select(v => new {
                            v.Fecha,
                            v.MaquinaId,
                            MaquinaNombre = maquinas.FirstOrDefault(m => m.Id == v.MaquinaId)?.Nombre,
                            v.UsuarioId,
                            UsuarioNombre = usuarios.FirstOrDefault(u => u.Id == v.UsuarioId)?.Nombre,
                            FilasDetalle = v.Detalles.Count,
                            Data = v // El objeto completo para enviar de vuelta
                        }).OrderBy(x => x.Fecha).ThenBy(x => x.UsuarioNombre).ToList();

                        return Ok(new { 
                            message = $"Se encontraron {res.Count} grupos de registros para cargar.",
                            preview = res
                        });
                    }
                    else
                    {
                        return BadRequest(new { error = "No se pudieron extraer registros válidos del Excel. Verifique que los nombres de columnas coincidan (Fecha, Maquina, Operario, Orden, Inicio, Final, Actividad, Tiros)." });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            var errorDetail = $"Error importando Excel: {ex.Message}\nStack: {ex.StackTrace}";
            if (ex.InnerException != null) errorDetail += $"\nInner Exception: {ex.InnerException.Message}";
            
            Console.WriteLine($"[CRITICAL IMPORT ERROR] {errorDetail}");
            System.IO.File.WriteAllText("import_crash_full.txt", errorDetail);
            
            return StatusCode(500, new { 
                error = "Error interno procesando el archivo Excel.", 
                message = ex.Message,
                details = errorDetail 
            });
        }
    }

    private Usuario BusquedaFuzzyUsuario(List<Usuario> lista, string nombreBusqueda)
    {
        if (string.IsNullOrWhiteSpace(nombreBusqueda)) return null;
        
        string normalizado = nombreBusqueda.ToLower().Trim();
        
        // 1. Coincidencia Exacta
        var exacto = lista.FirstOrDefault(u => u.Nombre.ToLower() == normalizado);
        if (exacto != null) return exacto;

        // 2. Coincidencia por palabras (Fuzzy)
        // Dividimos el nombre buscado en fragmentos de al menos 3 letras
        var palabras = normalizado.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                  .Where(p => p.Length > 2)
                                  .ToList();

        if (!palabras.Any()) return null;

        // Buscamos usuarios que contengan TODAS las palabras clave (sin importar el orden)
        var coincide = lista.FirstOrDefault(u => {
            string uNombre = u.Nombre.ToLower();
            return palabras.All(p => uNombre.Contains(p));
        });

        if (coincide != null)
        {
            Console.WriteLine($"[USER MATCH] Excel: '{nombreBusqueda}' -> Match: '{coincide.Nombre}' (ID: {coincide.Id})");
            return coincide;
        }

        // 3. Coincidencia parcial (al menos 2 palabras clave coinciden)
        if (palabras.Count >= 2)
        {
            return lista.FirstOrDefault(u => {
                string uNombre = u.Nombre.ToLower();
                return palabras.Count(p => uNombre.Contains(p)) >= 2;
            });
        }

        return null;
    }

    private string GetStringFromCell(OfficeOpenXml.ExcelWorksheet ws, int row, Dictionary<string, int> headers, string keySnippet)
    {
        var entry = headers.FirstOrDefault(h => h.Key.Contains(keySnippet));
        if (entry.Key == null || entry.Value <= 0) return null;
        
        var val = ws.Cells[row, entry.Value].Value;
        if (val == null) return null;

        if (val is DateTime dt)
        {
            // Si es un tiempo solo de Excel, suele venir con fecha 1899-12-30
            if (dt.Year == 1899) return dt.ToString("HH:mm:ss"); // Usar 24h para evitar líos de AM/PM
            return dt.ToString("yyyy-MM-dd HH:mm:ss");
        }

        return val.ToString();
    }

    private decimal? GetDecimalFromCell(OfficeOpenXml.ExcelWorksheet ws, int row, Dictionary<string, int> headers, string keySnippet)
    {
        var entry = headers.FirstOrDefault(h => h.Key.Contains(keySnippet));
        if (entry.Key == null || entry.Value <= 0) return null;
        
        var val = ws.Cells[row, entry.Value].Value;
        if (val == null) return null;

        if (decimal.TryParse(val.ToString(), out decimal result))
            return result;
        
        return null;
    }

    /// <summary>
    /// Guarda o actualiza registros de producción diaria para un mes completo.
    /// Soporta múltiples registros en un solo request (sincronización).
    /// </summary>
    /// <summary>
    /// Guarda o actualiza registros de producción diaria para un mes completo o parcial.
    /// OBSOLETO el borrado total. Ahora usa Upsert para preservar IDs y detalles.
    /// </summary>
    [HttpPost("mensual")]
    public async Task<IActionResult> GuardarProduccionMensual([FromBody] List<ProduccionDiariaDto> registros, [FromQuery] bool isPartial = false)
    {
        try
        {
            if (registros == null || !registros.Any())
            {
                return BadRequest("No hay registros para guardar");
            }

            // Obtener el contexto (Mes/Año/Máquina) del primer registro
            var primerRegistro = registros.First();
            var fecha = DateTime.Parse(primerRegistro.Fecha);
            var mes = fecha.Month;
            var anio = fecha.Year;
            var maquinaId = primerRegistro.MaquinaId;

            // Obtener registros existentes para este contexto
            var existentes = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
                .ToListAsync();

            // Catálogo de máquinas para cálculo backend de ValorAPagar cuando el DTO venga en 0.
            var maquinaIds = registros.Select(r => r.MaquinaId).Distinct().ToList();
            var maquinasMap = await _context.Maquinas
                .Where(m => maquinaIds.Contains(m.Id))
                .ToDictionaryAsync(m => m.Id, m => m);

            var metaSnapshotsGuardar = await _context.MetasMensuales
                .Where(s => s.Mes == mes && s.Anio == anio)
                .ToListAsync();

            decimal CalcularValorAPagarFallback(ProduccionDiariaDto dto, Maquina? maq, decimal valorTiroSnapshotActual)
            {
                if (maq == null) return 0;
                var valorTiro = valorTiroSnapshotActual > 0 ? valorTiroSnapshotActual : maq.ValorPorTiro;
                if (valorTiro <= 0) return 0;

                var fecha = DateTime.Parse(dto.Fecha).Date;
                if (fecha.DayOfWeek == DayOfWeek.Sunday || HorarioLaboralHelper.EsFestivoColombia(fecha))
                    return 0;

                var snap = metaSnapshotsGuardar.FirstOrDefault(s => s.MaquinaId == maq.Id);
                var metaBaseInt = MetaResolver.ResolverMetaBaseTirosObjetivo100(maq, snap, 0);
                var metaBase = metaBaseInt > 0 ? (decimal)metaBaseInt
                    : (maq.Meta100Porciento > 0 ? (decimal)maq.Meta100Porciento : (decimal)maq.MetaRendimiento);
                var totalHorasProd = dto.TotalHorasProductivas > 0 ? dto.TotalHorasProductivas : (dto.HorasOperativas + dto.TiempoPuestaPunto);
                // Horas para meta: productivas + mantenimiento + otros aux (sin descanso ni tiempos muertos)
                var totalHorasMeta = totalHorasProd + dto.HorasMantenimiento + dto.HorasOtrosAux;
                var metaRendimiento = (metaBase > 0 ? (metaBase / 8m) : 0m) * totalHorasMeta;
                var meta75 = Math.Round(metaRendimiento * 0.75m, 0, MidpointRounding.AwayFromZero);

                var tirosBase = dto.TirosDiarios > 0 ? dto.TirosDiarios : dto.RendimientoFinal;
                var tirosEquivalentes = Math.Round((dto.Cambios * maq.TirosReferencia) + tirosBase, 0, MidpointRounding.AwayFromZero);
                var meta75Diff = tirosEquivalentes - meta75;
                var vrPagar = Math.Max(0m, meta75Diff * valorTiro);
                return Math.Round(vrPagar, 2, MidpointRounding.AwayFromZero);
            }

            // Lista para seguimiento de procesados (para saber cuáles borrar si no es partial)
            var procesadosIds = new HashSet<long>();
            var processedEntities = new List<ProduccionDiaria>();

            foreach (var dto in registros)
            {
                var fechaRegistro = DateTime.Parse(dto.Fecha);
                var horaInicio = ParseTime(dto.HoraInicio);
                var horaFin = ParseTime(dto.HoraFin);

                // --- FALLBACK REQUERIDO POR EL USUARIO ---
                // Si la cabecera no trae horas, tomar el inicio del primer detalle y el fin del último.
                if ((horaInicio == TimeSpan.Zero || horaFin == TimeSpan.Zero) && dto.Detalles != null && dto.Detalles.Any())
                {
                    var validTimes = dto.Detalles
                        .Select(d => new { i = ParseTime(d.HoraInicio), f = ParseTime(d.HoraFin) })
                        .Where(t => t.i != TimeSpan.Zero || t.f != TimeSpan.Zero)
                        .ToList();

                    if (validTimes.Any())
                    {
                        if (horaInicio == TimeSpan.Zero) {
                            var minI = validTimes.Where(t => t.i != TimeSpan.Zero).Select(t => t.i).DefaultIfEmpty(TimeSpan.Zero).Min();
                            if (minI != TimeSpan.Zero) horaInicio = minI;
                        }
                        if (horaFin == TimeSpan.Zero) {
                            horaFin = validTimes.Max(t => t.f);
                        }
                    }
                }

                // SIEMPRE sincronizar con detalles si existen, para asegurar la cabecera coincida con el modal
                if (dto.Detalles != null && dto.Detalles.Any()) {
                    var detTimes = dto.Detalles
                        .Select(d => new { i = ParseTime(d.HoraInicio), f = ParseTime(d.HoraFin) })
                        .Where(t => t.i != TimeSpan.Zero || t.f != TimeSpan.Zero)
                        .ToList();
                    
                    if (detTimes.Any()) {
                        var minDet = detTimes.Where(t => t.i != TimeSpan.Zero).Select(t => t.i).DefaultIfEmpty(TimeSpan.Zero).Min();
                        var maxDet = detTimes.Max(t => t.f);
                        if (minDet != TimeSpan.Zero) horaInicio = minDet;
                        if (maxDet != TimeSpan.Zero) horaFin = maxDet;
                    }
                }


                ProduccionDiaria produccion = null;

                // Intentar encontrar existente por ID
                if (dto.Id > 0)
                {
                    produccion = existentes.FirstOrDefault(e => e.Id == dto.Id);
                }
                
                // Si no se encuentra por Id (o Id es 0), intentar por Fecha+Maquina+Usuario (Soft Match)
                // Para evitar duplicados si se envía Id 0 pero el registro ya existe conceptualmente
                if (produccion == null)
                {
                    produccion = existentes.FirstOrDefault(e => e.Fecha.Date == fechaRegistro.Date && e.MaquinaId == dto.MaquinaId && e.UsuarioId == dto.UsuarioId && !procesadosIds.Contains(e.Id));
                }

                if (produccion != null)
                {
                    // UPDATE
                    produccion.UsuarioId = dto.UsuarioId;
                    produccion.HoraInicio = horaInicio;
                    produccion.HoraFin = horaFin;
                    produccion.HorasOperativas = dto.HorasOperativas;
                    produccion.RendimientoFinal = dto.RendimientoFinal;
                    produccion.Cambios = dto.Cambios;
                    produccion.TiempoPuestaPunto = dto.TiempoPuestaPunto;
                    produccion.TirosDiarios = (int)dto.TirosDiarios;
                    produccion.TotalHorasProductivas = dto.TotalHorasProductivas;
                    produccion.PromedioHoraProductiva = dto.PromedioHoraProductiva;
                    maquinasMap.TryGetValue(dto.MaquinaId, out var maqDto);
                    produccion.ValorTiroSnapshot = dto.ValorTiroSnapshot > 0
                        ? dto.ValorTiroSnapshot
                        : (maqDto?.ValorPorTiro ?? produccion.ValorTiroSnapshot);
                    produccion.ValorAPagar = dto.ValorAPagar;
                    if (produccion.ValorAPagar <= 0)
                    {
                        produccion.ValorAPagar = CalcularValorAPagarFallback(dto, maqDto, produccion.ValorTiroSnapshot);
                    }
                    produccion.ValorAPagarBonificable = dto.ValorAPagarBonificable;
                    produccion.HorasMantenimiento = dto.HorasMantenimiento;
                    produccion.HorasDescanso = dto.HorasDescanso;
                    produccion.HorasOtrosAux = dto.HorasOtrosAux;
                    produccion.TiempoFaltaTrabajo = dto.TiempoFaltaTrabajo;
                    produccion.TiempoReparacion = dto.TiempoReparacion;
                    produccion.TiempoOtroMuerto = dto.TiempoOtroMuerto;
                    produccion.ReferenciaOP = dto.ReferenciaOP ?? "";
                    produccion.Novedades = dto.Novedades ?? "";
                    
                    // Salvaguarda: No sobrescribir desperdicio con 0 si es una carga parcial (Excel)
                    if (!isPartial || dto.Desperdicio > 0)
                    {
                        produccion.Desperdicio = dto.Desperdicio;
                    }

                    produccion.DiaLaborado = dto.DiaLaborado;
                    produccion.HorarioId = dto.HorarioId;

                    // Recalcular totales
                    produccion.TotalHorasAuxiliares = dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux;
                    produccion.TotalTiemposMuertos = dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto;
                    produccion.TotalHoras = dto.TotalHorasProductivas + dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux + dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto;

                    Console.WriteLine($"[SAVE DEBUG] Updating record {produccion.Id}. Date: {produccion.Fecha}, User: {produccion.UsuarioId}, Inicio: {produccion.HoraInicio}, RFinal: {produccion.RendimientoFinal}");

                    _context.Entry(produccion).State = EntityState.Modified;
                    procesadosIds.Add(produccion.Id);

                    // Sincronizar Detalles si vienen en el DTO
                    if (dto.Detalles != null)
                    {
                        var existentesDetalles = await _context.ProduccionDiariaDetalles
                            .Where(d => d.ProduccionDiariaId == produccion.Id)
                            .ToListAsync();
                        _context.ProduccionDiariaDetalles.RemoveRange(existentesDetalles);

                        foreach (var detDto in dto.Detalles)
                        {
                            _context.ProduccionDiariaDetalles.Add(new ProduccionDiariaDetalle
                            {
                                ProduccionDiariaId = produccion.Id,
                                HoraInicio = ParseTime(detDto.HoraInicio),
                                HoraFin = ParseTime(detDto.HoraFin),
                                ActividadId = detDto.ActividadId,
                                Tiros = detDto.Tiros,
                                ReferenciaOP = detDto.ReferenciaOP ?? "",
                                Observaciones = detDto.Observaciones ?? ""
                            });
                        }
                    }
                }
                else
                {
                    // INSERT
                    var nueva = new ProduccionDiaria
                {
                    Fecha = fechaRegistro,
                    UsuarioId = dto.UsuarioId,
                    MaquinaId = dto.MaquinaId,
                    HoraInicio = horaInicio,
                    HoraFin = horaFin,
                    HorasOperativas = dto.HorasOperativas,
                    RendimientoFinal = dto.RendimientoFinal,
                    Cambios = dto.Cambios,
                    TiempoPuestaPunto = dto.TiempoPuestaPunto,
                    TirosDiarios = (int)dto.TirosDiarios,
                    TotalHorasProductivas = dto.TotalHorasProductivas,
                    PromedioHoraProductiva = dto.PromedioHoraProductiva,
                    ValorTiroSnapshot = dto.ValorTiroSnapshot,
                    ValorAPagar = dto.ValorAPagar,
                    ValorAPagarBonificable = dto.ValorAPagarBonificable,
                    HorasMantenimiento = dto.HorasMantenimiento,
                    HorasDescanso = dto.HorasDescanso,
                    HorasOtrosAux = dto.HorasOtrosAux,
                    TiempoFaltaTrabajo = dto.TiempoFaltaTrabajo,
                    TiempoReparacion = dto.TiempoReparacion,
                    TiempoOtroMuerto = dto.TiempoOtroMuerto,
                    ReferenciaOP = dto.ReferenciaOP ?? "",
                    Novedades = dto.Novedades ?? "",
                    Desperdicio = dto.Desperdicio,
                    DiaLaborado = dto.DiaLaborado,
                        HorarioId = dto.HorarioId,
                        // Totales
                    TotalHorasAuxiliares = dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux,
                    TotalTiemposMuertos = dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto,
                        TotalHoras = dto.TotalHorasProductivas + dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux + dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto
                    };

                    maquinasMap.TryGetValue(dto.MaquinaId, out var maqInsert);
                    if (nueva.ValorTiroSnapshot <= 0 && maqInsert != null)
                    {
                        nueva.ValorTiroSnapshot = maqInsert.ValorPorTiro;
                    }
                    if (nueva.ValorAPagar <= 0)
                    {
                        nueva.ValorAPagar = CalcularValorAPagarFallback(dto, maqInsert, nueva.ValorTiroSnapshot);
                    }

                    Console.WriteLine($"[SAVE DEBUG] Inserting NEW record. Date: {nueva.Fecha}, User: {nueva.UsuarioId}, Inicio: {nueva.HoraInicio}, RFinal: {nueva.RendimientoFinal}");
                    
                    _context.ProduccionDiaria.Add(nueva);
                    produccion = nueva;

                    // Si es nuevo y trae detalles, guardarlos (necesitamos el ID generado después de SaveChanges o usar el objeto)
                    if (dto.Detalles != null)
                    {
                        foreach (var detDto in dto.Detalles)
                        {
                            _context.ProduccionDiariaDetalles.Add(new ProduccionDiariaDetalle
                            {
                                ProduccionDiaria = nueva, // EF manejará el ID
                                HoraInicio = ParseTime(detDto.HoraInicio),
                                HoraFin = ParseTime(detDto.HoraFin),
                                ActividadId = detDto.ActividadId,
                                Tiros = detDto.Tiros,
                                ReferenciaOP = detDto.ReferenciaOP ?? "",
                                Observaciones = detDto.Observaciones ?? ""
                            });
                        }
                    }
                }
                processedEntities.Add(produccion);
            }

            // Si NO es partial, borrar los que no vinieron en el payload (Sincronización completa)
            if (!isPartial)
            {
                var paraBorrar = existentes.Where(e => !procesadosIds.Contains(e.Id)).ToList();
                if (paraBorrar.Any())
                {
                    // CRITICAL FIX: Also delete TiemposProceso (History Logs) for these deleted dailies
                    // Otherwise History view remains populated while Capture Grid is empty
                    foreach (var del in paraBorrar)
                    {
                        var logs = await _context.TiemposProceso
                            .Where(t => t.Fecha.Date == del.Fecha.Date && t.MaquinaId == del.MaquinaId && t.UsuarioId == del.UsuarioId)
                            .ToListAsync();
                        
                        if (logs.Any())
                        {
                            _context.TiemposProceso.RemoveRange(logs);
                            Console.WriteLine($"[SYNC DELETE] Deleted {logs.Count} history logs for {del.Fecha:yyyy-MM-dd} Maq:{del.MaquinaId}");
                        }
                    }

                    _context.ProduccionDiaria.RemoveRange(paraBorrar);
                }

                // EXTRA SAFETY: Clean up orphaned logs (TiemposProceso) for days NOT in the payload OR empty days
                // This handles cases where ProduccionDiaria was already gone but logs remained
                // We trust "registros" as the Full Truth for this Machine/Month
                
                // Identify valid dates: Must be present AND have actual content (Hours > 0 or OP or meaningful data)
                // If a record exists but has 0 hours/content (e.g. just Operator set), we treat it as "Empty" and clear history.
                var validDates = registros
                    .Where(r => (r.TotalHorasProductivas + r.HorasMantenimiento + r.HorasDescanso + 
                                 r.HorasOtrosAux + r.TiempoFaltaTrabajo + r.TiempoReparacion + 
                                 r.TiempoOtroMuerto + r.Desperdicio) > 0 
                                || !string.IsNullOrWhiteSpace(r.ReferenciaOP) 
                                || !string.IsNullOrWhiteSpace(r.Novedades))
                    .Select(r => DateTime.Parse(r.Fecha).Date)
                    .ToHashSet();
                
                var allLogsThisMonth = await _context.TiemposProceso
                    .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio && t.MaquinaId == maquinaId)
                    .ToListAsync();
                
                var orphanedLogs = allLogsThisMonth.Where(t => !validDates.Contains(t.Fecha.Date)).ToList();
                
                if (orphanedLogs.Any())
                {
                    _context.TiemposProceso.RemoveRange(orphanedLogs);
                    Console.WriteLine($"[SYNC CLEANUP] Removing {orphanedLogs.Count} orphaned logs for M:{mes}/A:{anio} Maq:{maquinaId}");
                }
            }

            Console.WriteLine($"[DEBUG] GuardarProduccionMensual: Processing {registros.Count} records. isPartial: {isPartial}");
            await _context.SaveChangesAsync();

            // Sincronizar TiemposProceso (subcódigos) para registros nuevos con detalle granular
            foreach (var dto in registros.Where(r => r.Detalles != null && r.Detalles.Count > 0))
            {
                var fechaRegistro = DateTime.Parse(dto.Fecha).Date;
                var prod = processedEntities.FirstOrDefault(p =>
                    p.Fecha.Date == fechaRegistro &&
                    p.MaquinaId == dto.MaquinaId &&
                    p.UsuarioId == dto.UsuarioId);
                if (prod != null)
                    await SincronizarTiemposProcesoDesdeDetallesAsync(prod, dto.Detalles, dto.HorarioId);
            }
            await _context.SaveChangesAsync();

            var results = processedEntities.Select(p => new {
                id = p.Id,
                fecha = p.Fecha.ToString("yyyy-MM-dd"),
                usuarioId = p.UsuarioId,
                maquinaId = p.MaquinaId
            }).ToList();
            
            Console.WriteLine($"[DEBUG] GuardarProduccionMensual: Returning {results.Count} results.");
            if (results.Any()) {
                Console.WriteLine($"[DEBUG] First Result ID: {results.First().id}");
            }
            
            return Ok(new { 
                message = $"Se procesaron {registros.Count} registros exitosamente.",
                results = results
            });
        }
        catch (Exception ex)
        {
            var errorDetail = $"Error en GuardarProduccionMensual: {ex.Message}\nStackTrace: {ex.StackTrace}\nInner: {ex.InnerException?.Message}";
            System.IO.File.WriteAllText("debug_save_error.txt", errorDetail);
            Console.WriteLine(errorDetail);
            return StatusCode(500, new { error = ex.Message, details = ex.InnerException?.Message });
        }
    }

    [HttpPost("recalcular-mes")]
    public async Task<IActionResult> RecalcularMes([FromQuery] int anio, [FromQuery] int mes)
    {
        try
        {
            await _tiempoProcesoService.RecalcularProduccionMesAsync(anio, mes);
            return Ok(new { message = $"Recálculo completado para {mes}/{anio}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int anio, int? mes = null)
    {
        try 
        {
            var query = _context.Produccion_Gastos
                .AsNoTracking()
                .Include(g => g.Rubro)
                .Include(g => g.Proveedor)
                .Include(g => g.Usuario)
                .Include(g => g.CreadoPor) // Include creator info
                .Include(g => g.Maquina)
                .Include(g => g.TipoHora)
                .Include(g => g.TipoRecargo)
                .Where(g => g.Anio == anio);

            if (mes.HasValue)
            {
                query = query.Where(g => g.Mes == mes.Value);
            }

            var gastos = await query
                .OrderByDescending(g => g.Fecha)
                .ToListAsync();

            // Ensure Estado is never null
            foreach (var g in gastos) { if (string.IsNullOrEmpty(g.Estado)) g.Estado = "Montado"; }

            // Calculate Summary
            var resumen = new
            {
                Total = gastos.Sum(g => g.Precio),
                PorRubro = gastos.GroupBy(g => g.Rubro?.Nombre ?? "Sin Rubro")
                                 .Select(g => new { Rubro = g.Key, Total = g.Sum(x => x.Precio) })
                                 .ToDictionary(k => k.Rubro, v => v.Total)
            };

            return Ok(new { gastos, resumen });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] GetGastos failure: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            if (ex.InnerException != null) Console.WriteLine($"[INNER] {ex.InnerException.Message}");
            return StatusCode(500, new { message = "Error interno del servidor", details = ex.Message });
        }
    }

    [HttpPost("gastos")]
    public async Task<ActionResult<Produccion_Gasto>> CreateGasto(
        Produccion_Gasto gasto,
        [FromQuery] int? autorizacionId = null)
    {
        try
        {
        // Basic validations
        if (gasto.RubroId <= 0) return BadRequest("Rubro es requerido");

        // Set Creator
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        int adminId = 0;
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int parsedAdminId))
        {
            adminId = parsedAdminId;
            gasto.CreadoPorId = parsedAdminId;
        }

        // Helper: Validate logic based on Rubro
        var rubro = await _context.Produccion_Rubros.FindAsync(gasto.RubroId);
        var esNomina = rubro != null && (rubro.Nombre == "Horas Extras" || rubro.Nombre == "Recargo"
            || gasto.TipoHoraId.HasValue || gasto.TipoRecargoId.HasValue);

        if (adminId <= 0 && !esNomina)
            return BadRequest(new { message = "No se pudo identificar al usuario." });

        try
        {
            await _gastoAutorizacion.ExigirAutorizacionParaGastoNormalAsync(
                "produccion", autorizacionId, adminId, esNomina);
        }
        catch (InvalidOperationException exAuth)
        {
            return BadRequest(new { message = exAuth.Message });
        }

        if (rubro != null)
        {
            if (rubro.Nombre == "Horas Extras" || rubro.Nombre == "Recargo")
            {
                bool isRecargo = rubro.Nombre == "Recargo";
                if (gasto.UsuarioId == null) return BadRequest("Usuario es requerido");
                if (!isRecargo && gasto.TipoHoraId == null) return BadRequest("Tipo de Hora es requerido");
                if (isRecargo && gasto.TipoRecargoId == null) return BadRequest("Tipo de Recargo es requerido");
                if (gasto.CantidadHoras == null) return BadRequest("Cantidad de Horas invalidas");

                // Server-side calculation to ensure integrity
                var usuario = await _context.Usuarios.FindAsync(gasto.UsuarioId);
                decimal factor = 0;
                
                if (isRecargo)
                {
                    var tipoRec = await _context.Produccion_TiposRecargo.FindAsync(gasto.TipoRecargoId);
                    factor = tipoRec?.Factor ?? 0;
                }
                else
                {
                    var tipoHora = await _context.Produccion_TiposHora.FindAsync(gasto.TipoHoraId);
                    factor = tipoHora?.Factor ?? 0;
                }

                if (usuario == null) return BadRequest("Usuario no encontrado");

                // Formula: (Salario / divisor) * Factor * Horas
                // divisor 220 hasta 14/07/2026; 210 desde 15/07/2026
                decimal hourlyRate = LaborHorasExtrasHelper.ValorHora(usuario.Salario, gasto.Fecha);
                gasto.Precio = hourlyRate * factor * (gasto.CantidadHoras ?? 0);
                gasto.Precio = Math.Round(gasto.Precio, 2);
                
                gasto.NumeroFactura = null;
                gasto.FacturaPdfUrl = null;
            }
            else
            {
                // Non-Horas Extras rubros require invoice number
                // BUT: If it's a pending expense, we allow empty invoice
                if (!gasto.EsPendiente && string.IsNullOrWhiteSpace(gasto.NumeroFactura))
                    return BadRequest("Número de Factura es requerido para este tipo de rubro");
            }

            var mpErr = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esNomina, gasto.EsSolicitudCredito, gasto.EsEfectivo);
            if (mpErr != null) return (ActionResult<Produccion_Gasto>)(object)mpErr;
            // Add more if needed
        }

        var precioP = gasto.Precio;
        var precioBaseP = gasto.PrecioBase;
        var precioIvaP = gasto.PrecioIva;
        var errIvaP = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(true, gasto.TipoHoraId, gasto.TipoRecargoId, rubro?.Nombre, ref precioP, ref precioBaseP, ref precioIvaP);
        if (errIvaP != null) return (ActionResult<Produccion_Gasto>)(object)errIvaP;
        gasto.Precio = precioP;
        gasto.PrecioBase = precioBaseP;
        gasto.PrecioIva = precioIvaP;

        gasto.Fecha = gasto.Fecha.ToUniversalTime(); // Postgres timestamp handling
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        gasto.FechaCreacion = DateTime.UtcNow;

        if (GastoOvertimeDuplicateHelper.IsOvertimeLabor(gasto.TipoHoraId, gasto.TipoRecargoId))
        {
            if (await GastoOvertimeDuplicateHelper.ExistsProduccionDuplicateAsync(_context, gasto))
                return BadRequest(new { message = GastoOvertimeDuplicateHelper.DuplicateMessage });
        }

        _context.Produccion_Gastos.Add(gasto);
        await _context.SaveChangesAsync();

        if (autorizacionId.HasValue && autorizacionId.Value > 0)
            await _gastoAutorizacion.VincularGastoRegistradoAsync(autorizacionId.Value, gasto.Id);

        return Ok(gasto);
        }
        catch (DbUpdateException ex)
        {
            Console.WriteLine($"[ERROR] CreateGasto DB: {ex.InnerException?.Message ?? ex.Message}");
            return StatusCode(500, new { message = "Error al guardar el gasto en base de datos.", details = ex.InnerException?.Message ?? ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] CreateGasto: {ex.Message}");
            return StatusCode(500, new { message = ex.Message });
        }
    }



    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Produccion_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        gasto.Fecha = gasto.Fecha.ToUniversalTime();
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        // Preserve FechaCreacion
        var existingEntry = await _context.Produccion_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;

        var rubroUp = await _context.Produccion_Rubros.FindAsync(gasto.RubroId);
        if (rubroUp != null)
        {
            var esNominaUp = gasto.TipoHoraId.HasValue || gasto.TipoRecargoId.HasValue
                || rubroUp.Nombre == "Horas Extras" || rubroUp.Nombre == "Recargo";
            var mpErrUp = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esNominaUp, gasto.EsSolicitudCredito, gasto.EsEfectivo);
            if (mpErrUp != null) return mpErrUp;
        }

        var precioU = gasto.Precio;
        var precioBaseU = gasto.PrecioBase;
        var precioIvaU = gasto.PrecioIva;
        var errIvaU = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(true, gasto.TipoHoraId, gasto.TipoRecargoId, rubroUp?.Nombre, ref precioU, ref precioBaseU, ref precioIvaU);
        if (errIvaU != null) return errIvaU;
        gasto.Precio = precioU;
        gasto.PrecioBase = precioBaseU;
        gasto.PrecioIva = precioIvaU;

        gasto.FechaModificacion = DateTime.UtcNow;
        _context.Entry(gasto).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Produccion_Gastos.Any(e => e.Id == id))
                return NotFound();
            else
                throw;
        }

        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.Produccion_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();

        _context.Produccion_Gastos.Remove(gasto);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ===================== HORAS EXTRAS REPORT =====================
    /// <summary>
    /// Get overtime (Horas Extras) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/horas-extras-report")]
    public async Task<ActionResult<List<object>>> GetHorasExtrasReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Horas Extras" rubro ID
        var rubroHE = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        if (rubroHE == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Produccion_Gastos
            .Where(g => g.RubroId == rubroHE.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Usuario)
            .Include(g => g.TipoHora)
            .OrderByDescending(g => g.Fecha)
            .ToListAsync();

        var result = gastos.Select(g =>
        {
            var salario = g.Usuario?.Salario ?? 0;
            var factor = g.TipoHora?.Factor ?? 0;
            var horas = g.CantidadHoras ?? 0;
            return new
            {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario?.Nombre ?? "N/A",
                UsuarioDocumento = g.Usuario?.Documento ?? "",
                Salario = salario,
                ValorHora = LaborHorasExtrasHelper.ValorHora(salario, g.Fecha),
                NumeroOP = g.NumeroOP ?? "",
                TipoHoraNombre = g.TipoHora?.Nombre ?? "N/A",
                Factor = factor,
                CantidadHoras = horas,
                Precio = LaborHorasExtrasHelper.CalcularValorAPagar(salario, factor, horas, g.Fecha),
                Nota = g.Nota ?? ""
            };
        }).ToList();

        return Ok(result);
    }

    // ===================== RECARGOS REPORT =====================
    /// <summary>
    /// Get surcharge (Recargo) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/recargos-report")]
    public async Task<ActionResult<List<object>>> GetRecargosReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Recargo" rubro ID
        var rubroRecargo = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");
        if (rubroRecargo == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Produccion_Gastos
            .Where(g => g.RubroId == rubroRecargo.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Usuario)
            .Include(g => g.TipoRecargo)
            .OrderByDescending(g => g.Fecha)
            .ToListAsync();

        var result = gastos.Select(g =>
        {
            var salario = g.Usuario?.Salario ?? 0;
            var factor = g.TipoRecargo?.Factor ?? 0;
            var horas = g.CantidadHoras ?? 0;
            return new
            {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario?.Nombre ?? "N/A",
                UsuarioDocumento = g.Usuario?.Documento ?? "",
                Salario = salario,
                ValorHora = LaborHorasExtrasHelper.ValorHora(salario, g.Fecha),
                NumeroOP = g.NumeroOP ?? "",
                TipoRecargoNombre = g.TipoRecargo?.Nombre ?? "N/A",
                Factor = factor,
                CantidadHoras = horas,
                Precio = LaborHorasExtrasHelper.CalcularValorAPagar(salario, factor, horas, g.Fecha),
                Nota = g.Nota ?? ""
            };
        }).ToList();

        return Ok(result);
    }


    // ===================== PRESUPUESTOS (Budgets) =====================

    /// <summary>
    /// Get all budgets for a given month/year
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult> GetPresupuestos(int anio, int mes)
    {
        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .Include(p => p.Rubro)
            .ToListAsync();

        return Ok(presupuestos);
    }

    /// <summary>
    /// Set a single budget for a Rubro/Month/Year (create or update)
    /// </summary>
    [HttpPost("presupuesto")]
    public async Task<ActionResult<Produccion_PresupuestoMensual>> SetPresupuesto([FromBody] Produccion_PresupuestoMensual presupuesto)
    {
        var existing = await _context.Produccion_PresupuestosMensuales
            .FirstOrDefaultAsync(p => p.RubroId == presupuesto.RubroId && p.Anio == presupuesto.Anio && p.Mes == presupuesto.Mes);

        if (existing != null)
        {
            existing.Presupuesto = presupuesto.Presupuesto;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }
        else
        {
            _context.Produccion_PresupuestosMensuales.Add(presupuesto);
            await _context.SaveChangesAsync();
            return Ok(presupuesto);
        }
    }

    /// <summary>
    /// Bulk set budgets for a month/year (create or update multiple)
    /// </summary>
    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<Produccion_PresupuestoMensual> presupuestos)
    {
        foreach (var presupuesto in presupuestos)
        {
            var existing = await _context.Produccion_PresupuestosMensuales
                .FirstOrDefaultAsync(p => p.RubroId == presupuesto.RubroId && p.Anio == presupuesto.Anio && p.Mes == presupuesto.Mes);

            if (existing != null)
            {
                existing.Presupuesto = presupuesto.Presupuesto;
            }
            else
            {
                _context.Produccion_PresupuestosMensuales.Add(presupuesto);
            }
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Get production summary (Tiros) filtered by machine, date, user, and OP (string match)
    /// Used for Waste Report percentage calculation.
    /// Supports filtering by exact Date OR by Month/Year.
    /// </summary>
    [HttpGet("resumen-produccion")]
    public async Task<ActionResult<IEnumerable<object>>> GetProduccionSummary(
        [FromQuery] int? maquinaId, 
        [FromQuery] DateTime? fecha, 
        [FromQuery] int? usuarioId, 
        [FromQuery] string? ordenProduccion,
        [FromQuery] int? mes,
        [FromQuery] int? anio)
    {
        // 1. Base query on TiemposProceso (Source valid shots)
        var query = _context.TiemposProceso
            .Include(t => t.OrdenProduccion)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Where(t => t.Actividad.Codigo == "02") // Only Production (02) counts
            .AsQueryable();

        // 2. Apply filters
        if (maquinaId.HasValue) 
            query = query.Where(t => t.MaquinaId == maquinaId.Value);

        if (fecha.HasValue) 
        {
            // Exact date priority
            query = query.Where(t => t.Fecha.Date == fecha.Value.Date);
        }
        else if (mes.HasValue && anio.HasValue)
        {
            // Monthly filter if no exact date
            query = query.Where(t => t.Fecha.Month == mes.Value && t.Fecha.Year == anio.Value);
        }

        if (usuarioId.HasValue) 
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrEmpty(ordenProduccion)) 
            query = query.Where(t => t.OrdenProduccion != null && t.OrdenProduccion.Numero.Contains(ordenProduccion));

        // 3. Group and Sum

        if (usuarioId.HasValue) 
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrEmpty(ordenProduccion)) 
            query = query.Where(t => t.OrdenProduccion != null && t.OrdenProduccion.Numero.Contains(ordenProduccion));

        // 3. Group and Sum
        var summary = await query
            .GroupBy(t => new { t.MaquinaId, t.Maquina.Nombre })
            .Select(g => new
            {
                MaquinaId = g.Key.MaquinaId,
                MaquinaNombre = g.Key.Nombre,
                Tiros = g.Sum(t => t.Tiros)
            })
            .ToListAsync();

        return Ok(summary);
    }

    /// <summary>
    /// Totales de bonificación para reportes PDF (sin aplicar regla del 75%).
    /// Suma ValorAPagar diario por Operario + Máquina para el periodo.
    /// </summary>
    [HttpGet("resumen-bonificacion-reporte")]
    public async Task<ActionResult> GetResumenBonificacionReporte(int mes, int anio)
    {
        // Backfill defensivo: si hay filas antiguas con ValorAPagar=0, se recalculan y se persisten.
        var filasMes = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .ToListAsync();

        var huboCambios = false;
        foreach (var p in filasMes)
        {
            if (p.ValorAPagar > 0) continue;
            if (p.Maquina == null) continue;

            var valorTiro = p.ValorTiroSnapshot > 0 ? p.ValorTiroSnapshot : p.Maquina.ValorPorTiro;
            if (valorTiro <= 0) continue;

            if (p.Fecha.DayOfWeek == DayOfWeek.Sunday || HorarioLaboralHelper.EsFestivoColombia(p.Fecha.Date))
                continue;

            var metaBase = p.Maquina.Meta100Porciento > 0 ? (decimal)p.Maquina.Meta100Porciento : (decimal)p.Maquina.MetaRendimiento;
            var totalHorasProd = p.TotalHorasProductivas > 0 ? p.TotalHorasProductivas : (p.HorasOperativas + p.TiempoPuestaPunto);
            var totalHorasMeta = totalHorasProd + p.HorasMantenimiento + p.HorasOtrosAux;
            var metaRendimiento = (metaBase > 0 ? (metaBase / 8m) : 0m) * totalHorasMeta;
            var meta75 = Math.Round(metaRendimiento * 0.75m, 0, MidpointRounding.AwayFromZero);

            var tirosBase = p.TirosDiarios > 0 ? p.TirosDiarios : p.RendimientoFinal;
            var tirosEquivalentes = Math.Round((p.Cambios * p.Maquina.TirosReferencia) + tirosBase, 0, MidpointRounding.AwayFromZero);
            var meta75Diff = tirosEquivalentes - meta75;
            var valorCalculado = Math.Round(Math.Max(0m, meta75Diff * valorTiro), 2, MidpointRounding.AwayFromZero);

            if (valorCalculado > 0)
            {
                p.ValorTiroSnapshot = valorTiro;
                p.ValorAPagar = valorCalculado;
                huboCambios = true;
            }
        }

        if (huboCambios)
        {
            await _context.SaveChangesAsync();
        }

        var data = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => new
            {
                UsuarioId = g.Key.UsuarioId,
                MaquinaId = g.Key.MaquinaId,
                Operario = g.First().Usuario != null ? g.First().Usuario.Nombre : "Desconocido",
                Maquina = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                ValorAPagar = g.Sum(x => x.ValorAPagar),
                ValorAPagarBonificable = g.Sum(x => x.ValorAPagarBonificable)
            })
            .ToListAsync();

        return Ok(data);
    }

    /// <summary>
    /// Snapshot de metas por máquina para el mes (importancia, tarifa, etc.). La meta base numérica en resumen prioriza el catálogo de máquina vía <c>MetaResolver</c>.
    /// Permite que Captura mensual calcule el mismo objetivo que el Tablero Semáforos.
    /// </summary>
    [HttpGet("metas-mensuales")]
    public async Task<ActionResult> GetMetasMensuales(int mes, int anio)
    {
        var list = await _context.MetasMensuales
            .AsNoTracking()
            .Where(s => s.Mes == mes && s.Anio == anio)
            .Select(s => new
            {
                s.MaquinaId,
                s.Meta100Porciento,
                s.MetaRendimiento,
                s.Importancia,
                s.TirosReferencia,
                s.ValorPorTiro,
                s.Tarifa
            })
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>
    /// Get production summary with operators and machines data for a month
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen(int mes, int anio, int? diaInicio = null, int? diaFin = null)
    {
        try
        {
        // Get all production data for the month
        var query = _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        // Apply day range filter if provided (for weekly reports)
        if (diaInicio.HasValue && diaFin.HasValue)
        {
            query = query.Where(p => p.Fecha.Day >= diaInicio.Value && p.Fecha.Day <= diaFin.Value);
        }

        var produccion = await query.ToListAsync();

        // Get machine metadata for importance and meta calculations
        var maquinas = await _context.Maquinas.Where(m => m.Activo && (m.Nombre == null || !m.Nombre.Contains("TERMINADOS"))).ToListAsync();

        // Load monthly meta snapshots for this period
        var metaSnapshots = await _context.MetasMensuales
            .Where(s => s.Mes == mes && s.Anio == anio)
            .ToListAsync();

        var horasTurnoPorMaquina = HorasTurnoMetaHelper.CalcularHorasTurnoPorMaquina(
            produccion,
            maquinas.Select(m => m.Id),
            mes,
            anio,
            diaInicio,
            diaFin);

        // Count working days in period
        var diasLaborados = produccion
            .Select(p => p.Fecha.Date)
            .Distinct()
            .Count();

        // Group by Operario + Maquina combination - ALIGNED WITH CalificacionController
        var resumenOperarios = produccion
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => {
                var maq = maquinas.FirstOrDefault(m => m.Id == g.Key.MaquinaId);
                var first = g.First();
                var tirosReferencia = maq?.TirosReferencia ?? 0;
                
                // Usar todos los registros del grupo (datos Jan 1-12 2026 ya fueron eliminados de BD)
                var filteredGroup = g.AsEnumerable();
                
                // FIXED: Usar RendimientoFinal (decimal) con redondeo para coincidir con frontend
                var totalTiros = filteredGroup.Sum(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal));
                var tirosBonificables = filteredGroup.Sum(p => p.TirosBonificables);
                // DiasLaborados: Filter days to only those with actual activity
                var diasOp = filteredGroup.Where(p => 
                    (p.TotalHoras > 0 || p.RendimientoFinal > 0 || p.Cambios > 0)
                ).Select(p => p.Fecha.Date).Distinct().Count();
                
                // Misma base de meta que resumen por máquina: snapshot mensual si existe
                var snapshotOp = metaSnapshots.FirstOrDefault(s => s.MaquinaId == g.Key.MaquinaId);
                // Objetivo tiros al 100% (Meta100/snapshot) y % eficiencia: mismo denominador en UI, tablero y cartas.
                var metaBaseTiros100 = MetaResolver.ResolverMetaBaseTirosObjetivo100(maq, snapshotOp, 7500);

                decimal totalHorasOp = filteredGroup
                    .Where(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal) > 0)
                    .Sum(p => p.TotalHoras - p.HorasDescanso - p.TiempoFaltaTrabajo - p.TiempoReparacion - p.TiempoOtroMuerto);

                decimal metaPorHoraTiros100 = (decimal)metaBaseTiros100 / 8;
                decimal meta100MesDisplay = totalHorasOp * metaPorHoraTiros100;

                var meta75 = meta100MesDisplay * 0.75m;

                var pct75 = meta75 > 0 ? (decimal)totalTiros / meta75 * 100 : 0;
                // % "Meta 100%" = tiros / objetivo al 100% (Meta100/snapshot), mismo denominador que meta100Porciento en UI y cartas.
                var pct100 = meta100MesDisplay > 0 ? (decimal)totalTiros / meta100MesDisplay * 100 : 0;
                
                string sem75 = pct75 >= 100 ? "Verde" : pct75 >= 75 ? "Amarillo" : "Rojo";
                string sem100 = pct100 >= 100 ? "Verde" : pct100 >= 75 ? "Amarillo" : "Rojo";

                // Apply 75% threshold: Only pay bonificación if operario achieved >= 75% of Meta100
                var valorBonifSum = filteredGroup.Sum(p => p.ValorAPagarBonificable);
                var valorAPagarBonificableFinal = pct100 >= 75 ? valorBonifSum : 0;

                // Bonif Potencial: Es el valor ganado ANTES de aplicar el filtro del 75% (lo que podría haber ganado)
                // O mejor dicho, sumamos el ValorAPagar completo (total bonus earned) para reporte
                var valorTotalGanado = filteredGroup.Sum(p => p.ValorAPagar);

                return new ResumenOperarioDTO {
                    UsuarioId = g.Key.UsuarioId,
                    MaquinaId = g.Key.MaquinaId,
                    Operario = first.Usuario?.Nombre ?? "Desconocido",
                    Maquina = first.Maquina?.Nombre ?? "Desconocida",
                    TirosReportados = (int)Math.Round(filteredGroup.Sum(p => p.RendimientoFinal)),
                    TirosEquivalentes = filteredGroup.Sum(p => p.Cambios * tirosReferencia),
                    TotalCambios = filteredGroup.Sum(p => p.Cambios),
                    TotalTiros = totalTiros,
                    TirosBonificables = tirosBonificables,
                    TotalHorasProductivas = filteredGroup.Sum(p => p.TotalHorasProductivas),
                    TotalHorasAuxiliares = filteredGroup.Sum(p => p.HorasMantenimiento + p.HorasOtrosAux),
                    PromedioHoraProductiva = filteredGroup.Any() ? filteredGroup.Average(p => p.PromedioHoraProductiva) : 0,
                    TotalHoras = filteredGroup.Sum(p => p.TotalHoras),
                    TotalHorasEfectivasMeta = totalHorasOp,
                    ValorAPagar = valorTotalGanado,
                    ValorAPagarBonificable = valorAPagarBonificableFinal,
                    ValorBonifPotencial = valorBonifSum, 
                    DiasLaborados = diasOp,
                    MetaBonificacion = meta75,
                    Meta100Porciento = meta100MesDisplay,
                    Eficiencia = pct100 / 100,
                    PorcentajeRendimiento75 = pct75,
                    PorcentajeRendimiento100 = pct100,
                    SemaforoColor = sem75,
                    SemaforoColor100 = sem100,
                    UltimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy"),
                };
            })
            .Where(r => r.DiasLaborados > 0)
            .OrderBy(r => r.Operario)
            .ThenBy(r => r.Maquina)
            .ToList();

        // Group by Maquina based on ALL Active Machines to include 0 performance ones
        var resumenMaquinas = maquinas.Select(maq => 
        {
            var g = produccion.Where(p => p.MaquinaId == maq.Id).ToList();
            
            if (g.Any())
            {
                var tirosReferencia = maq.TirosReferencia;
                
                // Usar todos los registros (datos Jan 1-12 2026 ya fueron eliminados de BD)
                var filteredGroup = g;

                // FIXED: Usar RendimientoFinal (decimal) con redondeo
                var tirosTotales = filteredGroup.Sum(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal));
                // Filter days to only those with actual activity
                var diasMaq = filteredGroup.Where(p => 
                    (p.TotalHoras > 0 || p.RendimientoFinal > 0 || p.Cambios > 0)
                ).Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use monthly meta snapshot if available, otherwise fallback to current machine values
                var snapshot = metaSnapshots.FirstOrDefault(s => s.MaquinaId == maq.Id);
                var metaBaseTiros100 = MetaResolver.ResolverMetaBaseTirosObjetivo100(maq, snapshot, 0);

                decimal totalHorasMaq = filteredGroup
                    .Where(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal) > 0)
                    .Sum(p => p.TotalHoras - p.HorasDescanso - p.TiempoFaltaTrabajo - p.TiempoReparacion - p.TiempoOtroMuerto);

                decimal metaPorHoraTiros100 = (decimal)metaBaseTiros100 / 8;
                decimal meta100MesDisplay = totalHorasMaq * metaPorHoraTiros100;

                var meta75 = meta100MesDisplay * 0.75m;

                var pct = meta100MesDisplay > 0 ? (decimal)tirosTotales / meta100MesDisplay * 100 : 0;
                string sem = pct >= 100 ? "Verde" : pct >= 75 ? "Amarillo" : "Rojo";
                
                var importancia = snapshot?.Importancia ?? maq.Importancia;
                var calificacion = pct * importancia / 100;
                var tarifaVal = snapshot?.Tarifa ?? maq.Tarifa;

                return new ResumenMaquinaDTO {
                    MaquinaId = maq.Id,
                    Maquina = maq.Nombre,
                    TirosReportados = (int)Math.Round(filteredGroup.Sum(p => p.RendimientoFinal)),
                    TirosEquivalentes = filteredGroup.Sum(p => p.Cambios * tirosReferencia),
                    TotalCambios = filteredGroup.Sum(p => p.Cambios),
                    TotalTiempoPuestaPunto = filteredGroup.Sum(p => p.TiempoPuestaPunto),
                    TotalHorasDescanso = filteredGroup.Sum(p => p.HorasDescanso),
                    TotalHorasProductivas = filteredGroup.Sum(p => p.TotalHorasProductivas),
                    TotalHorasAuxiliares = filteredGroup.Sum(p => p.HorasMantenimiento + p.HorasOtrosAux),
                    TirosTotales = tirosTotales,
                    RendimientoEsperado = meta100MesDisplay,
                    Meta75Porciento = meta75,
                    Meta100Porciento = meta100MesDisplay,
                    PorcentajeRendimiento = pct / 100,
                    PorcentajeRendimiento100 = pct,
                    SemaforoColor = sem,
                    TotalTiemposMuertos = g.Sum(p => p.TotalTiemposMuertos),
                    TotalTiempoReparacion = g.Sum(p => p.TiempoReparacion),
                    TotalTiempoFaltaTrabajo = g.Sum(p => p.TiempoFaltaTrabajo),
                    TotalTiempoOtro = g.Sum(p => p.TiempoOtroMuerto),
                    TotalHoras = g.Sum(p => p.TotalHoras),
                    TotalHorasEfectivasMeta = totalHorasMaq,
                    Importancia = importancia,
                    Calificacion = Math.Round(calificacion, 2),
                    DiasLaborados = diasMaq,
                    UltimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy"),
                    Tarifa = tarifaVal,
                    MetaDiariaBase = metaBaseTiros100,
                    HorasTurnoMes = horasTurnoPorMaquina.GetValueOrDefault(maq.Id, 0)
                };
            }
            else
            {
                // Zero performance case for active machine with no production
                return new ResumenMaquinaDTO {
                    MaquinaId = maq.Id,
                    Maquina = maq.Nombre,
                    TirosReportados = 0,
                    TirosEquivalentes = 0,
                    TotalCambios = 0,
                    TotalTiempoPuestaPunto = 0m,
                    TotalHorasDescanso = 0m,
                    TotalHorasProductivas = 0m,
                    TotalHorasAuxiliares = 0m,
                    TirosTotales = 0,
                    RendimientoEsperado = 0m,
                    Meta75Porciento = 0m,
                    Meta100Porciento = 0m,
                    PorcentajeRendimiento = 0m,
                    PorcentajeRendimiento100 = 0m,
                    SemaforoColor = "Rojo",
                    TotalTiemposMuertos = 0m,
                    TotalTiempoReparacion = 0m,
                    TotalTiempoFaltaTrabajo = 0m,
                    TotalTiempoOtro = 0m,
                    TotalHoras = 0m,
                    TotalHorasEfectivasMeta = 0m,
                    Importancia = maq.Importancia,
                    Calificacion = 0m,
                    DiasLaborados = 0,
                    UltimaFecha = "",
                    Tarifa = maq.Tarifa,
                    MetaDiariaBase = MetaResolver.ResolverMetaBaseTirosObjetivo100(maq, null, 0),
                    HorasTurnoMes = horasTurnoPorMaquina.GetValueOrDefault(maq.Id, 0)
                };
            }
        })
        .OrderBy(r => r.Maquina)
        .ToList();

        // Daily trend
        var tendenciaDiaria = produccion
            .GroupBy(p => p.Fecha.Date)
            .Select(g => new {
                fecha = g.Key,
                tiros = g.Sum(p => p.TirosDiarios),
                desperdicio = g.Sum(p => p.Desperdicio)
            })
            .OrderBy(t => t.fecha)
            .ToList();

        // Plant score (sum of machine calificaciones)
        var calificacionTotalPlanta = resumenMaquinas.Sum(m => m.Calificacion);

        return Ok(new {
            resumenOperarios,
            resumenMaquinas,
            tendenciaDiaria,
            calificacionTotalPlanta
        });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] GetResumen failure: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            if (ex.InnerException != null) Console.WriteLine($"[INNER] {ex.InnerException.Message}");
            return StatusCode(500, new { message = "Error interno del servidor", details = ex.Message });
        }
    }

    /// <summary>
    /// Get budget summary for a month (renamed from original resumen)
    /// </summary>
    [HttpGet("resumen-gastos")]
    public async Task<ActionResult> GetResumenGastos(int anio, int mes)
    {
        try
        {
        var gastos = await _context.Produccion_Gastos
            .Where(g => g.Anio == anio && g.Mes == mes)
            .Include(g => g.Rubro)
            .ToListAsync();

        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .Include(p => p.Rubro)
            .ToListAsync();

        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();

        var porRubro = rubros.Select(r => new {
            rubroId = r.Id,
            rubroNombre = r.Nombre,
            presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id)?.Presupuesto ?? 0,
            gastado = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio),
        }).Select(x => new {
            x.rubroId,
            x.rubroNombre,
            x.presupuesto,
            x.gastado,
            restante = x.presupuesto - x.gastado
        }).ToList();

        var totalPresupuesto = porRubro.Sum(r => r.presupuesto);
        var totalGastado = porRubro.Sum(r => r.gastado);

        return Ok(new {
            anio,
            mes,
            totalPresupuesto,
            totalGastado,
            totalRestante = totalPresupuesto - totalGastado,
            porRubro
        });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] GetResumenGastos failure: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            if (ex.InnerException != null) Console.WriteLine($"[INNER] {ex.InnerException.Message}");
            return StatusCode(500, new { message = "Error interno del servidor", details = ex.Message });
        }
    }

    /// <summary>
    /// Get annual budget grid for all rubros - matches SST format
    /// </summary>
    [HttpGet("presupuestos-grid")]
    public async Task<ActionResult> GetPresupuestosGrid(int anio)
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();

        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        // Build grid similar to SST - using "tiposServicio" name for compatibility
        var tiposServicio = rubros.Select(r => new {
            tipoServicioId = r.Id,
            tipoServicioNombre = r.Nombre,
            meses = Enumerable.Range(1, 12).Select(mes => new {
                mes,
                presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == mes)?.Presupuesto ?? 0
            }).ToList()
        }).ToList();

        var totalesMensuales = Enumerable.Range(1, 12)
            .Select(mes => presupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto))
            .ToList();

        var totalAnual = presupuestos.Sum(p => p.Presupuesto);

        return Ok(new {
            tiposServicio,
            totalesMensuales,
            totalAnual
        });
    }

    // ===================== RUBROS CRUD =====================
    [HttpPost("rubros")]
    public async Task<ActionResult> CreateRubro([FromBody] Produccion_Rubro rubro)
    {
        rubro.Activo = true;
        _context.Produccion_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(rubro);
    }

    [HttpPut("rubros/{id}")]
    public async Task<ActionResult> UpdateRubro(int id, [FromBody] Produccion_Rubro updated)
    {
        var rubro = await _context.Produccion_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Nombre = updated.Nombre;
        await _context.SaveChangesAsync();
        return Ok(rubro);
    }

    [HttpDelete("rubros/{id}")]
    public async Task<ActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.Produccion_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== SALARIOS CRUD =====================
    [HttpPut("usuarios/{id}/salario")]
    public async Task<ActionResult> UpdateSalario(int id, [FromBody] Models.SalarioUpdateDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();
        usuario.Salario = dto.Salario;
        await _context.SaveChangesAsync();
        return Ok(new { usuario.Id, usuario.Nombre, usuario.Salario });
    }

    // ===================== PROVEEDORES CRUD =====================
    [HttpPost("proveedores")]
    public async Task<ActionResult> CreateProveedor([FromBody] ProveedorWriteDto dto)
    {
        var rubroIds = dto.ResolveRubroIds();
        var proveedor = new Produccion_Proveedor
        {
            Nombre = dto.Nombre,
            Nit = dto.Nit ?? "",
            Telefono = dto.Telefono ?? "",
            RubroId = rubroIds.FirstOrDefault(),
            PrecioCotizado = dto.PrecioCotizado,
            Activo = true
        };
        _context.Produccion_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        await ProveedorRubroHelper.SyncProduccionAsync(_context, proveedor.Id, rubroIds);
        await _context.SaveChangesAsync();
        return Ok(await ProveedorRubroHelper.GetProduccionProveedorAsync(_context, proveedor.Id));
    }

    [HttpPut("proveedores/{id}")]
    public async Task<ActionResult> UpdateProveedor(int id, [FromBody] ProveedorWriteDto dto)
    {
        var proveedor = await _context.Produccion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        var rubroIds = dto.ResolveRubroIds();
        proveedor.Nombre = dto.Nombre;
        proveedor.Nit = dto.Nit ?? proveedor.Nit;
        proveedor.Telefono = dto.Telefono ?? proveedor.Telefono;
        proveedor.PrecioCotizado = dto.PrecioCotizado;
        proveedor.RubroId = rubroIds.FirstOrDefault();
        await ProveedorRubroHelper.SyncProduccionAsync(_context, id, rubroIds);
        await _context.SaveChangesAsync();
        return Ok(await ProveedorRubroHelper.GetProduccionProveedorAsync(_context, id));
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<ActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Produccion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== PARAMETROS JORNADA OT =====================
    private static string? FormatTimeOt(TimeSpan? t) =>
        t.HasValue ? $"{(int)t.Value.TotalHours:D2}:{t.Value.Minutes:D2}" : null;

    private static TimeSpan? ParseTimeOt(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var parts = s.Trim().Split(':');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return null;
        return new TimeSpan(h, m, 0);
    }

    private static ParametrosJornadaOtVersionDto MapJornadaVersion(DateTime vigenteDesde, List<ParametrosJornadaOt> dias) =>
        new()
        {
            VigenteDesde = vigenteDesde.ToString("yyyy-MM-dd"),
            Dias = dias
                .OrderBy(d => d.DiaSemana)
                .ThenBy(d => d.HoraInicio ?? TimeSpan.MaxValue)
                .Select(d => new ParametrosJornadaOtDiaDto
                {
                    DiaSemana = d.DiaSemana,
                    HoraInicio = FormatTimeOt(d.HoraInicio),
                    HoraFin = FormatTimeOt(d.HoraFin),
                    DescuentaComida = d.DescuentaComida,
                    MinutosComida = d.MinutosComida
                }).ToList()
        };

    /// <summary>
    /// Jornada OT vigente para una fecha (la versión con VigenteDesde más reciente &lt;= fecha).
    /// Si no hay versión, retorna dias vacío (el FE usa lógica legacy).
    /// </summary>
    [HttpGet("parametros-jornada-ot")]
    public async Task<ActionResult> GetParametrosJornadaOt([FromQuery] string? fecha = null)
    {
        DateTime fechaRef;
        if (string.IsNullOrWhiteSpace(fecha) || !DateTime.TryParse(fecha, out fechaRef))
            fechaRef = DateTime.Today;
        fechaRef = fechaRef.Date;

        var vigenteDesde = await _context.ParametrosJornadaOt
            .Where(p => p.Activo && p.VigenteDesde <= fechaRef)
            .OrderByDescending(p => p.VigenteDesde)
            .Select(p => p.VigenteDesde)
            .FirstOrDefaultAsync();

        if (vigenteDesde == default)
            return Ok(new ParametrosJornadaOtVersionDto { VigenteDesde = "", Dias = new List<ParametrosJornadaOtDiaDto>() });

        var dias = await _context.ParametrosJornadaOt
            .Where(p => p.Activo && p.VigenteDesde == vigenteDesde)
            .ToListAsync();

        return Ok(MapJornadaVersion(vigenteDesde, dias));
    }

    [HttpGet("parametros-jornada-ot/all")]
    public async Task<ActionResult> GetAllParametrosJornadaOt()
    {
        var grupos = await _context.ParametrosJornadaOt
            .Where(p => p.Activo)
            .GroupBy(p => p.VigenteDesde)
            .OrderByDescending(g => g.Key)
            .ToListAsync();

        var result = grupos.Select(g => MapJornadaVersion(g.Key, g.ToList())).ToList();
        return Ok(result);
    }

    [HttpPut("parametros-jornada-ot")]
    public async Task<ActionResult> SaveParametrosJornadaOt([FromBody] ParametrosJornadaOtSaveDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.VigenteDesde) ||
            !DateTime.TryParse(dto.VigenteDesde, out var vigenteDesde))
            return BadRequest(new { message = "VigenteDesde inválido (yyyy-MM-dd)" });

        vigenteDesde = vigenteDesde.Date;
        if (dto.Dias == null || dto.Dias.Count == 0)
            return BadRequest(new { message = "Debe enviar al menos un horario" });

        var existentes = await _context.ParametrosJornadaOt
            .Where(p => p.VigenteDesde == vigenteDesde)
            .ToListAsync();
        if (existentes.Count > 0)
            _context.ParametrosJornadaOt.RemoveRange(existentes);

        var nuevos = new List<ParametrosJornadaOt>();
        foreach (var diaDto in dto.Dias)
        {
            if (diaDto.DiaSemana < 0 || diaDto.DiaSemana > 6) continue;
            nuevos.Add(new ParametrosJornadaOt
            {
                VigenteDesde = vigenteDesde,
                DiaSemana = diaDto.DiaSemana,
                HoraInicio = ParseTimeOt(diaDto.HoraInicio),
                HoraFin = ParseTimeOt(diaDto.HoraFin),
                DescuentaComida = diaDto.DescuentaComida,
                MinutosComida = Math.Max(0, diaDto.MinutosComida),
                Activo = true
            });
        }

        if (nuevos.Count == 0)
            return BadRequest(new { message = "No hay horarios válidos para guardar" });

        _context.ParametrosJornadaOt.AddRange(nuevos);
        await _context.SaveChangesAsync();
        return Ok(MapJornadaVersion(vigenteDesde, nuevos));
    }

    // ===================== TIPOS DE HORA CRUD =====================
    [HttpPost("tiposhora")]
    public async Task<ActionResult> CreateTipoHora([FromBody] Produccion_TipoHora tipoHora)
    {
        tipoHora.Activo = true;
        _context.Produccion_TiposHora.Add(tipoHora);
        await _context.SaveChangesAsync();
        return Ok(tipoHora);
    }

    [HttpPut("tiposhora/{id}")]
    public async Task<ActionResult> UpdateTipoHora(int id, [FromBody] Produccion_TipoHora updated)
    {
        var tipoHora = await _context.Produccion_TiposHora.FindAsync(id);
        if (tipoHora == null) return NotFound();
        tipoHora.Nombre = updated.Nombre;
        tipoHora.Porcentaje = updated.Porcentaje;
        tipoHora.Factor = updated.Factor;
        await _context.SaveChangesAsync();
        return Ok(tipoHora);
    }

    [HttpDelete("tiposhora/{id}")]
    public async Task<ActionResult> DeleteTipoHora(int id)
    {
        var tipoHora = await _context.Produccion_TiposHora.FindAsync(id);
        if (tipoHora == null) return NotFound();
        tipoHora.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== TIPOS DE RECARGO CRUD =====================
    [HttpPost("tiposrecargo")]
    public async Task<ActionResult> CreateTipoRecargo([FromBody] Produccion_TipoRecargo tipoRecargo)
    {
        tipoRecargo.Activo = true;
        _context.Produccion_TiposRecargo.Add(tipoRecargo);
        await _context.SaveChangesAsync();
        return Ok(tipoRecargo);
    }

    [HttpPut("tiposrecargo/{id}")]
    public async Task<ActionResult> UpdateTipoRecargo(int id, [FromBody] Produccion_TipoRecargo updated)
    {
        var tipoRecargo = await _context.Produccion_TiposRecargo.FindAsync(id);
        if (tipoRecargo == null) return NotFound();
        tipoRecargo.Nombre = updated.Nombre;
        tipoRecargo.Porcentaje = updated.Porcentaje;
        tipoRecargo.Factor = updated.Factor;
        await _context.SaveChangesAsync();
        return Ok(tipoRecargo);
    }

    [HttpDelete("tiposrecargo/{id}")]
    public async Task<ActionResult> DeleteTipoRecargo(int id)
    {
        var tipoRecargo = await _context.Produccion_TiposRecargo.FindAsync(id);
        if (tipoRecargo == null) return NotFound();
        tipoRecargo.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== GRAFICAS ENDPOINT =====================
    [HttpGet("graficas")]
    public async Task<ActionResult> GetGraficas(int anio, int? mes = null)
    {
        var query = _context.Produccion_Gastos
            .AsNoTracking()
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Usuario)
            .Include(g => g.TipoHora)
            .Include(g => g.TipoRecargo)
            .Where(g => g.Anio == anio);

        if (mes.HasValue)
        {
            query = query.Where(g => g.Mes == mes.Value);
        }

        var gastos = await query.ToListAsync();

        // Por Rubro
        var porRubro = gastos
            .GroupBy(g => g.Rubro?.Nombre ?? "Sin Rubro")
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .ToList();

        // Por Proveedor
        var porProveedor = gastos
            .Where(g => g.Proveedor != null)
            .GroupBy(g => g.Proveedor!.Nombre)
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .Take(5)
            .ToList();

        // Por Usuario (para Horas Extras)
        var porUsuario = gastos
            .Where(g => g.Usuario != null)
            .GroupBy(g => g.Usuario!.Nombre)
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .Take(5)
            .ToList();

        // Resumen mensual (para vista anual)
        var resumenMensual = new List<object>();
        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .AsNoTracking()
            .Where(p => p.Anio == anio)
            .ToListAsync();

        if (!mes.HasValue)
        {
            for (int m = 1; m <= 12; m++)
            {
                var gastosMes = gastos.Where(g => g.Mes == m).Sum(g => g.Precio);
                var presupuestoMes = presupuestos.Where(p => p.Mes == m).Sum(p => p.Presupuesto);
                resumenMensual.Add(new {
                    mes = m,
                    totalGastado = gastosMes,
                    totalPresupuesto = presupuestoMes,
                    restante = presupuestoMes - gastosMes
                });
            }
        }

        // Performance by Rubro (for progress bars)
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var desempenoRubro = rubros.Select(r => {
            var gastoRubro = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio);
            var presupuestoRubro = mes.HasValue 
                ? (presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == mes.Value)?.Presupuesto ?? 0)
                : presupuestos.Where(p => p.RubroId == r.Id).Sum(p => p.Presupuesto);

            return new {
                rubroId = r.Id,
                nombre = r.Nombre,
                gastado = gastoRubro,
                presupuesto = presupuestoRubro,
                restante = presupuestoRubro - gastoRubro
            };
        }).OrderByDescending(x => x.gastado).ToList();

        var totalGastado = gastos.Sum(g => g.Precio);
        var totalPresupuesto = mes.HasValue 
            ? presupuestos.Where(p => p.Mes == mes.Value).Sum(p => p.Presupuesto)
            : presupuestos.Sum(p => p.Presupuesto);

        return Ok(new {
            totalGastado,
            totalPresupuesto,
            totalRestante = totalPresupuesto - totalGastado,
            porRubro,
            desempenoRubro,
            porProveedor,
            porUsuario,
            resumenMensual
        });
    }

    /// <summary>
    /// Upload PDF Factura
    /// </summary>
    [HttpPost("upload-factura")]
    public async Task<ActionResult> UploadFactura(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        // Ensure uploads folder exists
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "facturas");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        // Generate unique filename
        var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Return relative URL
        return Ok(new { url = $"/uploads/facturas/{uniqueFileName}" });
    }

    // ================== COTIZACIONES CRUD ==================
    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Produccion_Cotizaciones
            .Include(c => c.Proveedor)
            .Include(c => c.Rubro)
            .Where(c => c.Activo);

        if (proveedorId.HasValue)
            query = query.Where(c => c.ProveedorId == proveedorId.Value);
        if (anio.HasValue)
            query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue)
            query = query.Where(c => c.Mes == mes.Value);

        var cotizaciones = await query
            .OrderByDescending(c => c.FechaCotizacion)
            .Select(c => new
            {
                c.Id,
                c.ProveedorId,
                ProveedorNombre = c.Proveedor != null ? c.Proveedor.Nombre : "",
                c.RubroId,
                RubroNombre = c.Rubro != null ? c.Rubro.Nombre : "",
                c.Anio,
                c.Mes,
                c.PrecioCotizado,
                c.FechaCotizacion,
                c.Descripcion,
                c.Activo
            })
            .ToListAsync();

        return Ok(cotizaciones);
    }

    [HttpPost("cotizaciones")]
    public async Task<ActionResult<Produccion_Cotizacion>> CreateCotizacion([FromBody] Produccion_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.Produccion_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, Produccion_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.Produccion_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        
        // Soft delete
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        
        return NoContent();
    }









    






    [HttpGet("debug-meta")]
    public async Task<ActionResult> GetDebugMeta(string nombreMaquina, int mes, int anio, int? usuarioId = null)
    {
        var maquina = await _context.Maquinas.FirstOrDefaultAsync(m => m.Nombre.Contains(nombreMaquina));
        if (maquina == null) return NotFound("Maquina no encontrada");

        var query = _context.ProduccionDiaria
            .Where(p => p.MaquinaId == maquina.Id && p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (usuarioId.HasValue)
        {
            query = query.Where(p => p.UsuarioId == usuarioId.Value);
        }

        var produccion = await query
            .OrderBy(p => p.Fecha)
            .ToListAsync();

        var snapshotDbg = await _context.MetasMensuales
            .FirstOrDefaultAsync(s => s.MaquinaId == maquina.Id && s.Mes == mes && s.Anio == anio);
        var metaBaseTiros100 = MetaResolver.ResolverMetaBaseTirosObjetivo100(maquina, snapshotDbg, 0);
        if (metaBaseTiros100 <= 0)
            metaBaseTiros100 = maquina.Meta100Porciento > 0 ? maquina.Meta100Porciento : maquina.MetaRendimiento;

        var breakdown = new List<object>();
        decimal totalMeta = 0;

        var distinctDays = produccion.Select(p => p.Fecha.Date).Distinct().ToList();
        
        foreach (var day in distinctDays)
        {
            decimal metaDia = 0;
            string formula = "";

            var prodDia = produccion.Where(p => p.Fecha.Date == day).ToList();
            // Equivalence Data
            int cambios = prodDia.Sum(p => p.Cambios);
            // FIX: Use RendimientoFinal (decimal) to avoid truncation issues (same as GetResumen)
            decimal tirosDiariosDecimal = prodDia.Sum(p => p.RendimientoFinal);
            int tirosDiarios = (int)Math.Round(tirosDiariosDecimal);
            int tirosCambios = cambios * maquina.TirosReferencia;

            // Horas efectivas para meta del día: sin descanso ni tiempos muertos
            // EXCLUDE DAYS WITH NO PRODUCTION (Repairs, etc.)
            decimal horas = ((cambios * maquina.TirosReferencia) + (int)Math.Round(tirosDiariosDecimal) > 0)
                ? prodDia.Sum(p => p.TotalHoras - p.HorasDescanso - p.TiempoFaltaTrabajo - p.TiempoReparacion - p.TiempoOtroMuerto)
                : 0;

            // Hourly Prorated Meta Logic
            // Meta = horas efectivas * (MetaBase / 8)
            decimal metaPorHora = (decimal)metaBaseTiros100 / 8;
            metaDia = horas * metaPorHora;
            formula = $"{Math.Round(horas, 2)}h * {Math.Round(metaPorHora, 2)}/h";

            totalMeta += metaDia;
            breakdown.Add(new { 
                Fecha = day.ToString("dd/MM/yyyy"),
                Meta = Math.Round(metaDia, 2),
                Horas = Math.Round(horas, 2),
                Formula = formula,
                Cambios = cambios,
                TirosDiarios = tirosDiarios,
                TirosCambios = tirosCambios
            });
        }

        return Ok(new { Total = Math.Round(totalMeta, 2), Desglose = breakdown });
    }

    [HttpDelete("history/clear")]
    public async Task<IActionResult> ClearHistory(int mes, int anio)
    {
        var records = await _context.RendimientoOperariosMensual
            .Where(r => r.Mes == mes && r.Anio == anio)
            .ToListAsync();

        if (records.Count == 0)
        {
            return Ok(new { message = "No history records found for this period." });
        }

        _context.RendimientoOperariosMensual.RemoveRange(records);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Deleted {records.Count} history records for {mes}/{anio}." });
    }

    [HttpPost("gastos/recalcular")]
    public async Task<IActionResult> RecalcularGastos()
    {
        var rubroHE = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        var rubroRecargo = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");

        var ids = new List<int>();
        if (rubroHE != null) ids.Add(rubroHE.Id);
        if (rubroRecargo != null) ids.Add(rubroRecargo.Id);

        if (!ids.Any()) return Ok("No rubros found");

        var gastos = await _context.Produccion_Gastos
            .Where(g => ids.Contains(g.RubroId))
            .Include(g => g.Usuario) // Need User Salary
            .Include(g => g.TipoHora) // Need Factors
            .Include(g => g.TipoRecargo)
            .ToListAsync();

        int count = 0;
        foreach (var g in gastos)
        {
            if (g.Usuario == null || g.Usuario.Salario <= 0) continue;

            decimal factor = 0;
            if (g.RubroId == rubroHE?.Id && g.TipoHora != null) factor = g.TipoHora.Factor;
            if (g.RubroId == rubroRecargo?.Id && g.TipoRecargo != null) factor = g.TipoRecargo.Factor;
            
            if (factor > 0 && g.CantidadHoras > 0)
            {
                decimal hourlyRate = LaborHorasExtrasHelper.ValorHora(g.Usuario.Salario, g.Fecha);
                g.Precio = Math.Round(hourlyRate * factor * g.CantidadHoras.Value, 2);
                count++;
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Recalculated {count} records." });
    }


    // ===================== OP SEARCH =====================
    /// <summary>
    /// Get all unique OP values from ReferenciaOP field
    /// OPs may be stored as "7077-7075" so we split by "-"
    /// Excludes invalid OPs like "0" and "460"
    /// </summary>
    [HttpGet("ops-unicos")]
    public async Task<IActionResult> GetOPsUnicos()
    {
        var excludedOPs = new HashSet<string> { "0", "460" };

        // Get OPs from ProduccionDiaria, ProduccionDiariaDetalles and also from OrdenesProduccion
        var opsMaestro = await _context.ProduccionDiaria
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP))
            .Select(p => p.ReferenciaOP)
            .ToListAsync();

        var opsDetalle = await _context.ProduccionDiariaDetalles
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP))
            .Select(p => p.ReferenciaOP)
            .ToListAsync();

        var opsOrdenes = await _context.OrdenesProduccion
            .Select(op => op.Numero)
            .ToListAsync();

        var allRaw = opsMaestro.Concat(opsDetalle).Concat(opsOrdenes).ToList();

        var uniqueOPs = allRaw
            .Where(op => !string.IsNullOrEmpty(op))
            .SelectMany(op => op!.Split(new[] { '-', '/', ',', ' ' }, StringSplitOptions.RemoveEmptyEntries))
            .Select(op => op.Trim())
            .Where(op => !string.IsNullOrWhiteSpace(op) && !excludedOPs.Contains(op))
            .Distinct()
            .OrderByDescending(op => int.TryParse(op, out var num) ? num : 0)
            .ToList();

        return Ok(uniqueOPs);
    }

    /// <summary>
    /// Search for machines that have a specific OP in their ReferenciaOP field
    /// Ordered by date descending, then machine number ascending
    /// </summary>
    [HttpGet("buscar-op/{op}")]
    public async Task<IActionResult> BuscarOP(string op)
    {
        if (string.IsNullOrWhiteSpace(op))
            return BadRequest("OP es requerida");

        op = op.Trim();

        // 1. Buscar en Detalles (donde hay actividades y tiros granulares)
        var detailedResults = await _context.ProduccionDiariaDetalles
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP) && EF.Functions.ILike(p.ReferenciaOP, $"%{op}%"))
            .Include(p => p.ProduccionDiaria)
                .ThenInclude(pd => pd.Maquina)
            .Include(p => p.Actividad)
            .Select(p => new {
                HeaderId = p.ProduccionDiariaId,
                MaquinaId = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.MaquinaId : 0,
                MaquinaNombre = (p.ProduccionDiaria != null && p.ProduccionDiaria.Maquina != null) ? p.ProduccionDiaria.Maquina.Nombre : "Desconocida",
                Fecha = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.Fecha : DateTime.MinValue,
                ReferenciaOP = p.ReferenciaOP,
                ActividadNombre = (p.Actividad != null) ? p.Actividad.Nombre : "N/A",
                Tiros = p.Tiros,
                Desperdicio = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.Desperdicio : 0
            })
            .ToListAsync();

        // 2. Identificar qué cabeceras ya están representadas para no duplicar
        var representedHeaderIds = detailedResults.Select(r => r.HeaderId).Distinct().ToList();

        // 3. Buscar en la tabla principal (Headers) los que coincidan con la OP pero NO tengan detalles representados
        var headerOnlyResults = await _context.ProduccionDiaria
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP) && EF.Functions.ILike(p.ReferenciaOP, $"%{op}%") && !representedHeaderIds.Contains(p.Id))
            .Include(p => p.Maquina)
            .Select(p => new {
                HeaderId = p.Id,
                MaquinaId = p.MaquinaId,
                MaquinaNombre = (p.Maquina != null) ? p.Maquina.Nombre : "Desconocida",
                Fecha = p.Fecha,
                ReferenciaOP = p.ReferenciaOP,
                ActividadNombre = "N/A",
                Tiros = 0,
                Desperdicio = p.Desperdicio
            })
            .ToListAsync();

        // 4. Buscar en Historial Antiguo / Tiempo Real (TiemposProceso)
        // Esto recupera datos de OPs que no se han consolidado o vienen de la versión anterior
        var historyResults = await _context.TiemposProceso
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.OrdenProduccion != null && EF.Functions.ILike(t.OrdenProduccion.Numero, $"%{op}%"))
            .Select(t => new {
                HeaderId = (long)-1, // Indica que no tiene cabecera mensual vinculada
                MaquinaId = t.MaquinaId,
                MaquinaNombre = (t.Maquina != null) ? t.Maquina.Nombre : "Desconocida",
                Fecha = t.Fecha,
                ReferenciaOP = t.OrdenProduccion!.Numero,
                ActividadNombre = (t.Actividad != null) ? t.Actividad.Nombre : "N/A",
                Tiros = t.Tiros,
                Desperdicio = (decimal)t.Desperdicio
            })
            .ToListAsync();

        // 5. Combinar todos los sets (eliminar duplicados muy cercanos si es necesario, pero mejor mostrar todo)
        var combinedResults = detailedResults.Cast<dynamic>()
            .Concat(headerOnlyResults.Cast<dynamic>())
            .Concat(historyResults.Cast<dynamic>())
            .ToList();

        // 6. Ordenar: fecha descendente y máquina por número
        var sortedResults = combinedResults
            .OrderByDescending(r => (DateTime)r.Fecha)
            .ThenBy(r => {
                string mName = (string)r.MaquinaNombre;
                var match = System.Text.RegularExpressions.Regex.Match(mName, @"^(\d+)");
                return match.Success ? int.Parse(match.Groups[1].Value) : 999;
            })
            .ThenBy(r => (string)r.MaquinaNombre)
            .ToList();

        return Ok(sortedResults);
    }

    /// <summary>
    /// Reporte integral por OP: producción, trazabilidad por día/máquina y gastos por módulo.
    /// </summary>
    [HttpGet("reporte-op/{op}")]
    public async Task<IActionResult> GetReportePorOP(string op, [FromQuery] int mes, [FromQuery] int anio)
    {
        if (string.IsNullOrWhiteSpace(op))
            return BadRequest("OP es requerida");
        if (mes < 1 || mes > 12)
            return BadRequest("Mes inválido");
        if (anio < 2000 || anio > 2100)
            return BadRequest("Año inválido");

        var needle = op.Trim();

        // 1) Producción: detalle granular
        var detallesRaw = await _context.ProduccionDiariaDetalles
            .Include(d => d.ProduccionDiaria)
                .ThenInclude(pd => pd.Maquina)
            .Include(d => d.ProduccionDiaria)
                .ThenInclude(pd => pd.Usuario)
            .Include(d => d.Actividad)
            .Where(d => d.ProduccionDiaria != null
                        && d.ProduccionDiaria.Fecha.Month == mes
                        && d.ProduccionDiaria.Fecha.Year == anio
                        && (
                            (!string.IsNullOrEmpty(d.ReferenciaOP) && EF.Functions.ILike(d.ReferenciaOP, $"%{needle}%"))
                            || (!string.IsNullOrEmpty(d.ProduccionDiaria.ReferenciaOP) && EF.Functions.ILike(d.ProduccionDiaria.ReferenciaOP, $"%{needle}%"))
                        ))
            .ToListAsync();

        var detalles = detallesRaw
            .Select(d => new
            {
                Fecha = d.ProduccionDiaria!.Fecha.ToString("yyyy-MM-dd"),
                MaquinaId = d.ProduccionDiaria.MaquinaId,
                Maquina = d.ProduccionDiaria.Maquina != null ? d.ProduccionDiaria.Maquina.Nombre : "Desconocida",
                UsuarioId = d.ProduccionDiaria.UsuarioId,
                Operario = d.ProduccionDiaria.Usuario != null ? d.ProduccionDiaria.Usuario.Nombre : "N/A",
                Actividad = d.Actividad != null ? d.Actividad.Nombre : "N/A",
                ReferenciaOP = d.ReferenciaOP ?? d.ProduccionDiaria.ReferenciaOP ?? "",
                Tiros = d.Tiros,
                Desperdicio = d.ProduccionDiaria.Desperdicio,
                Fuente = "Detalle"
            })
            .ToList();

        // 2) Producción: cabeceras (si no hay detalle en la fila)
        var representedHeaders = detallesRaw.Select(d => d.ProduccionDiariaId).Distinct().ToHashSet();
        var cabecerasRaw = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Include(p => p.Usuario)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio
                        && p.ReferenciaOP != null
                        && EF.Functions.ILike(p.ReferenciaOP, $"%{needle}%")
                        && !representedHeaders.Contains(p.Id))
            .ToListAsync();

        var cabeceras = cabecerasRaw.Select(p => new
            {
                Fecha = p.Fecha.ToString("yyyy-MM-dd"),
                MaquinaId = p.MaquinaId,
                Maquina = p.Maquina != null ? p.Maquina.Nombre : "Desconocida",
                UsuarioId = p.UsuarioId,
                Operario = p.Usuario != null ? p.Usuario.Nombre : "N/A",
                Actividad = "Consolidado",
                ReferenciaOP = p.ReferenciaOP ?? "",
                Tiros = p.TirosConEquivalencia,
                Desperdicio = p.Desperdicio,
                Fuente = "Cabecera"
            })
            .ToList();

        // 3) Historial tiempo real (TiempoProceso)
        var histRaw = await _context.TiemposProceso
            .Include(t => t.Maquina)
            .Include(t => t.Usuario)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio
                        && t.OrdenProduccion != null
                        && EF.Functions.ILike(t.OrdenProduccion.Numero, $"%{needle}%"))
            .ToListAsync();

        var historico = histRaw.Select(t => new
            {
                Fecha = t.Fecha.ToString("yyyy-MM-dd"),
                MaquinaId = t.MaquinaId,
                Maquina = t.Maquina != null ? t.Maquina.Nombre : "Desconocida",
                UsuarioId = t.UsuarioId,
                Operario = t.Usuario != null ? t.Usuario.Nombre : "N/A",
                Actividad = t.Actividad != null ? t.Actividad.Nombre : "N/A",
                ReferenciaOP = t.OrdenProduccion != null ? t.OrdenProduccion.Numero : "",
                Tiros = t.Tiros,
                Desperdicio = (decimal)t.Desperdicio,
                Fuente = "TiempoProceso"
            })
            .ToList();

        var produccionRows = detalles
            .Concat(cabeceras)
            .Concat(historico)
            .OrderBy(r => r.Fecha)
            .ThenBy(r => r.Maquina)
            .ThenBy(r => r.Operario)
            .ToList();

        if (produccionRows.Count == 0)
            return NotFound($"No se encontraron datos para la OP {needle} en {mes}/{anio}.");

        var resumenMaquinas = produccionRows
            .GroupBy(r => new { r.MaquinaId, r.Maquina })
            .Select(g => new
            {
                g.Key.MaquinaId,
                g.Key.Maquina,
                Dias = g.Select(x => x.Fecha).Distinct().Count(),
                Registros = g.Count(),
                TirosTotales = g.Sum(x => x.Tiros),
                DesperdicioTotal = g.Sum(x => x.Desperdicio),
            })
            .OrderByDescending(x => x.TirosTotales)
            .ToList();

        var detalleDiario = produccionRows
            .GroupBy(r => new { r.Fecha, r.MaquinaId, r.Maquina })
            .Select(g => new
            {
                g.Key.Fecha,
                g.Key.MaquinaId,
                g.Key.Maquina,
                Registros = g.Count(),
                TirosTotales = g.Sum(x => x.Tiros),
                DesperdicioTotal = g.Sum(x => x.Desperdicio),
                Operarios = g.Select(x => x.Operario).Distinct().Count(),
            })
            .OrderBy(x => x.Fecha)
            .ThenBy(x => x.Maquina)
            .ToList();

        // 4) Gastos por módulo relacionados a la OP
        var prodG = await _context.Produccion_Gastos
            .Include(g => g.Rubro)
            .Where(g => g.Anio == anio && g.Mes == mes && g.NumeroOP != null && EF.Functions.ILike(g.NumeroOP, $"%{needle}%"))
            .ToListAsync();
        var planG = await _context.Planeacion_Gastos
            .Include(g => g.Rubro)
            .Where(g => g.Anio == anio && g.Mes == mes && g.NumeroOP != null && EF.Functions.ILike(g.NumeroOP, $"%{needle}%"))
            .ToListAsync();
        var tallG = await _context.Talleres_Gastos
            .Include(g => g.Rubro)
            .Where(g => g.Anio == anio && g.Mes == mes && g.NumeroOP != null && EF.Functions.ILike(g.NumeroOP, $"%{needle}%"))
            .ToListAsync();
        var mantG = await _context.Mantenimiento_Gastos
            .Include(g => g.Rubro)
            .Where(g => g.Anio == anio && g.Mes == mes && g.NumeroOP != null && EF.Functions.ILike(g.NumeroOP, $"%{needle}%"))
            .ToListAsync();
        var disG = await _context.Diseno_Gastos
            .Include(g => g.Rubro)
            .Where(g => g.Anio == anio && g.Mes == mes && g.OrdenProduccion != null && EF.Functions.ILike(g.OrdenProduccion, $"%{needle}%"))
            .ToListAsync();

        var gastosDetalle = prodG.Select(g => new { Modulo = "Producción", Fecha = g.Fecha.ToString("yyyy-MM-dd"), Rubro = g.Rubro != null ? g.Rubro.Nombre : "N/A", Valor = g.Precio, Nota = g.Nota ?? "" })
            .Concat(planG.Select(g => new { Modulo = "Planeación", Fecha = g.Fecha.ToString("yyyy-MM-dd"), Rubro = g.Rubro != null ? g.Rubro.Nombre : "N/A", Valor = g.Precio, Nota = g.Observaciones ?? "" }))
            .Concat(tallG.Select(g => new { Modulo = "Talleres", Fecha = g.Fecha.ToString("yyyy-MM-dd"), Rubro = g.Rubro != null ? g.Rubro.Nombre : "N/A", Valor = g.Precio, Nota = g.Observaciones ?? "" }))
            .Concat(mantG.Select(g => new { Modulo = "Mantenimiento", Fecha = g.Fecha.ToString("yyyy-MM-dd"), Rubro = g.Rubro != null ? g.Rubro.Nombre : "N/A", Valor = g.Precio, Nota = g.Nota ?? "" }))
            .Concat(disG.Select(g => new { Modulo = "Diseño", Fecha = g.Fecha.ToString("yyyy-MM-dd"), Rubro = g.Rubro != null ? g.Rubro.Nombre : "N/A", Valor = g.Precio, Nota = g.Observaciones ?? "" }))
            .OrderBy(x => x.Fecha)
            .ThenBy(x => x.Modulo)
            .ToList();

        var gastosPorModulo = gastosDetalle
            .GroupBy(g => g.Modulo)
            .Select(g => new
            {
                Modulo = g.Key,
                Registros = g.Count(),
                Total = g.Sum(x => x.Valor)
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        return Ok(new
        {
            op = needle,
            mes,
            anio,
            totalRegistrosProduccion = produccionRows.Count,
            totalRegistrosGastos = gastosDetalle.Count,
            resumenMaquinas,
            detalleDiario,
            produccionRows,
            gastosPorModulo,
            gastosDetalle
        });
    }

    // ===================== DÍA DETALLADO =====================
    /// <summary>
    /// Get all detail entries for a specific ProduccionDiaria record
    /// </summary>
    [HttpGet("dia-detalle/{produccionDiariaId}")]
    public async Task<IActionResult> GetDiaDetalle(long produccionDiariaId)
    {
        try
    {
        var detalles = await _context.ProduccionDiariaDetalles
            .Where(d => d.ProduccionDiariaId == produccionDiariaId)
            .Include(d => d.Actividad)
            .OrderBy(d => d.HoraInicio)
            .Select(d => new {
                d.Id,
                d.ProduccionDiariaId,
                HoraInicio = d.HoraInicio.ToString(@"hh\:mm"),
                HoraFin = d.HoraFin.ToString(@"hh\:mm"),
                TiempoMinutos = (int)(d.HoraFin - d.HoraInicio).TotalMinutes,
                d.ActividadId,
                ActividadCodigo = d.Actividad != null ? d.Actividad.Codigo : "",
                ActividadNombre = d.Actividad != null ? d.Actividad.Nombre : "",
                d.Tiros,
                d.ReferenciaOP,
                d.Observaciones
            })
            .ToListAsync();

        return Ok(detalles);
    }
        catch (Exception ex)
        {
            return BadRequest($"Error en GetDiaDetalle: {ex.Message} - {ex.InnerException?.Message}");
        }
    }
    /// <summary>
    /// Recalcula todos los totales de ProduccionDiaria a partir de sus detalles.
    /// Usa para corregir datos históricos con cálculos incorrectos.
    /// </summary>
    [HttpPost("recalcular-totales")]
    public async Task<IActionResult> RecalcularTotales()
    {
        try
        {
            var allRecords = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .ToListAsync();

            int recalculados = 0;
            int errores = 0;

            foreach (var parent in allRecords)
            {
                try
                {
                    var savedDetails = await _context.ProduccionDiariaDetalles
                        .Include(d => d.Actividad)
                        .Where(d => d.ProduccionDiariaId == parent.Id)
                        .ToListAsync();

                    if (!savedDetails.Any()) continue;

                    // Reset counters
                    parent.TiempoPuestaPunto = 0;
                    parent.HorasOperativas = 0;
                    parent.TirosDiarios = 0;
                    parent.TiempoReparacion = 0;
                    parent.HorasDescanso = 0;
                    parent.TiempoOtroMuerto = 0;
                    parent.HorasMantenimiento = 0;
                    parent.TiempoFaltaTrabajo = 0;
                    parent.HorasOtrosAux = 0;

                    foreach (var d in savedDetails)
                    {
                        decimal horas = 0;
                        if (d.HoraFin > d.HoraInicio)
                            horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                        string codigo = d.Actividad?.Codigo ?? "";

                        switch (codigo)
                        {
                            case "01": parent.TiempoPuestaPunto += horas; break;
                            case "02":
                                parent.HorasOperativas += horas;
                                parent.TirosDiarios += d.Tiros;
                                break;
                            case "03": parent.TiempoReparacion += horas; break;
                            case "04": parent.HorasDescanso += horas; break;
                            case "08": parent.TiempoOtroMuerto += horas; break;
                            case "10": parent.HorasMantenimiento += horas; break;
                            case "13": parent.TiempoFaltaTrabajo += horas; break;
                            case "14": parent.HorasOtrosAux += horas; break;
                            default: parent.HorasOtrosAux += horas; break;
                        }
                    }

                    // Derived calculations
                    parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                    parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                    parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                    parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                    if (parent.HorasOperativas > 0)
                        parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;

                    _context.Entry(parent).State = EntityState.Modified;
                    recalculados++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[RECALC ERROR] Record {parent.Id}: {ex.Message}");
                    errores++;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = $"Recalculación completada. {recalculados} registros actualizados, {errores} errores." });
        }
        catch (Exception ex)
        {
            return BadRequest($"Error en RecalcularTotales: {ex.Message}");
        }
    }

    [HttpPost("dia-detalle")]
    public async Task<IActionResult> SaveDiaDetalle([FromBody] List<DiaDetalleDto> detalles)
    {
        try
    {
        if (detalles == null || !detalles.Any())
            return BadRequest("No se enviaron detalles");

        var produccionDiariaId = detalles.First().ProduccionDiariaId;
        
        // Delete existing details
        var existing = await _context.ProduccionDiariaDetalles
            .Where(d => d.ProduccionDiariaId == produccionDiariaId)
            .ToListAsync();
        _context.ProduccionDiariaDetalles.RemoveRange(existing);

        // Add new details (filter out empty rows)
        foreach (var dto in detalles.Where(d => !string.IsNullOrEmpty(d.HoraInicio) && !string.IsNullOrEmpty(d.HoraFin)))
        {
                // Skip rows with unparseable times (e.g. placeholder "HH:MM")
                if (!TimeSpan.TryParse(dto.HoraInicio, out var horaInicio) ||
                    !TimeSpan.TryParse(dto.HoraFin, out var horaFin))
                    continue;

            var detalle = new ProduccionDiariaDetalle
            {
                ProduccionDiariaId = dto.ProduccionDiariaId,
                    HoraInicio = horaInicio,
                    HoraFin = horaFin,
                ActividadId = dto.ActividadId,
                Tiros = dto.Tiros,
                ReferenciaOP = dto.ReferenciaOP,
                Observaciones = dto.Observaciones
            };
            _context.ProduccionDiariaDetalles.Add(detalle);
        }

        await _context.SaveChangesAsync();

            // Recalculate parent ProduccionDiaria summary from saved details
            var parent = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .FirstOrDefaultAsync(p => p.Id == produccionDiariaId);

            if (parent != null)
            {
                var savedDetails = await _context.ProduccionDiariaDetalles
                    .Include(d => d.Actividad)
                    .Where(d => d.ProduccionDiariaId == produccionDiariaId)
                    .ToListAsync();

                // Reset counters
                parent.TiempoPuestaPunto = 0;
                parent.HorasOperativas = 0;
                parent.TirosDiarios = 0;
                parent.Desperdicio = 0;
                parent.TiempoReparacion = 0;
                parent.HorasDescanso = 0;
                parent.TiempoOtroMuerto = 0;
                parent.HorasMantenimiento = 0;
                parent.TiempoFaltaTrabajo = 0;
                parent.HorasOtrosAux = 0;

                foreach (var d in savedDetails)
                {
                    decimal horas = 0;
                    if (d.HoraFin > d.HoraInicio)
                        horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                    string codigo = d.Actividad?.Codigo ?? "";

                    switch (codigo)
                    {
                        case "01": parent.TiempoPuestaPunto += horas; break;
                        case "02":
                            parent.HorasOperativas += horas;
                            parent.TirosDiarios += d.Tiros;
                            break;
                        case "03": parent.TiempoReparacion += horas; break;
                        case "04": parent.HorasDescanso += horas; break;
                        case "08": parent.TiempoOtroMuerto += horas; break;
                        case "10": parent.HorasMantenimiento += horas; break;
                        case "13": parent.TiempoFaltaTrabajo += horas; break;
                        case "14": parent.HorasOtrosAux += horas; break;
                        default: parent.HorasOtrosAux += horas; break;
                    }
                }

                // Derived calculations
                parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                if (parent.HorasOperativas > 0)
                {
                    parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;
                }

                await _context.SaveChangesAsync();
            }

        return Ok(new { success = true, message = "Detalles guardados correctamente" });
        }
        catch (Exception ex)
        {
             return BadRequest($"Error en SaveDiaDetalle: {ex.Message} - {ex.InnerException?.Message} - Stack: {ex.StackTrace}");
        }
    }

    /// <summary>
    /// Delete a single detail entry
    /// </summary>
    [HttpDelete("dia-detalle/{id}")]
    public async Task<IActionResult> DeleteDiaDetalle(int id)
    {
        var detalle = await _context.ProduccionDiariaDetalles.FindAsync(id);
        if (detalle == null)
            return NotFound();
        
        _context.ProduccionDiariaDetalles.Remove(detalle);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private string? GetComentarioFromRow(OfficeOpenXml.ExcelWorksheet ws, int row, Dictionary<string, int> headers)
    {
        foreach (var key in new[] { "comentario", "comentarios", "observacio", "observaciones", "novedad", "nota", "detalle" })
        {
            var val = GetStringFromCell(ws, row, headers, key);
            if (!string.IsNullOrWhiteSpace(val)) return val.Trim();
        }
        return null;
    }

  /// <summary>
    /// Crea registros en TiemposProceso desde detalles importados (para modal de subcódigos en cuadro master).
    /// </summary>
    private async Task SincronizarTiemposProcesoDesdeDetallesAsync(
        ProduccionDiaria produccion,
        List<ProduccionDiariaDetalleDto> detalles,
        int? horarioId)
    {
        if (detalles == null || detalles.Count == 0) return;

        var logsExistentes = await _context.TiemposProceso
            .Where(t =>
                t.Fecha.Date == produccion.Fecha.Date &&
                t.MaquinaId == produccion.MaquinaId &&
                t.UsuarioId == produccion.UsuarioId)
            .ToListAsync();
        if (logsExistentes.Count > 0)
            _context.TiemposProceso.RemoveRange(logsExistentes);

        foreach (var det in detalles)
        {
            var hi = ParseTime(det.HoraInicio);
            var hf = ParseTime(det.HoraFin);
            if (hi == TimeSpan.Zero && hf == TimeSpan.Zero) continue;

            var horaInicioDt = produccion.Fecha.Date.Add(hi);
            var horaFinDt = produccion.Fecha.Date.Add(hf);
            if (hf <= hi && hf != TimeSpan.Zero)
                horaFinDt = horaFinDt.AddDays(1);

            var duracion = horaFinDt - horaInicioDt;
            if (duracion.TotalMinutes <= 0) continue;

            int? ordenId = null;
            var opNum = (det.ReferenciaOP ?? "").Trim();
            if (!string.IsNullOrEmpty(opNum) && opNum != "460")
            {
                var op = await _context.OrdenesProduccion.FirstOrDefaultAsync(o => o.Numero == opNum);
                if (op == null)
                {
                    op = new OrdenProduccion
                    {
                        Numero = opNum,
                        Descripcion = "Importación Excel",
                        Estado = "EnProceso",
                        FechaCreacion = DateTime.UtcNow
                    };
                    _context.OrdenesProduccion.Add(op);
                    await _context.SaveChangesAsync();
                }
                ordenId = op.Id;
            }

            _context.TiemposProceso.Add(new TiempoProceso
            {
                Fecha = produccion.Fecha.Date,
                HoraInicio = horaInicioDt,
                HoraFin = horaFinDt,
                Duracion = duracion.Ticks,
                UsuarioId = produccion.UsuarioId,
                MaquinaId = produccion.MaquinaId,
                OrdenProduccionId = ordenId,
                ActividadId = det.ActividadId,
                Tiros = det.Tiros,
                Desperdicio = 0,
                Observaciones = det.Observaciones,
                SubCodigoActividad = det.SubCodigoActividad,
                SubCodigoDetalle = det.SubCodigoDetalle,
                HorarioId = horarioId ?? produccion.HorarioId,
                Estado = "Finalizado",
                TiempoPausadoSegundos = 0,
                PausadoEn = null
            });
        }
    }

    private TimeSpan ParseTime(string? timeStr)
    {
        if (string.IsNullOrWhiteSpace(timeStr)) return TimeSpan.Zero;
        
        // Intentar parseo directo (00:00:00)
        if (TimeSpan.TryParse(timeStr, out var ts)) return ts;

        // Intentar como DateTime (para manejar "7:00:00 a. m.")
        if (DateTime.TryParse(timeStr, out var dt)) return dt.TimeOfDay;

        // Limpieza agresiva para formatos raros de Excel
        // Reemplazar puntos y espacios raros: "a. m." -> "am", "p. m." -> "pm"
        string clean = timeStr.Replace(".", "").Replace(" ", "").ToLower(); 
        if (DateTime.TryParse(clean, out var dtClean)) return dtClean.TimeOfDay;
        
        // Intentar agregar un espacio antes de am/pm si no lo tiene
        if (clean.EndsWith("am") || clean.EndsWith("pm")) {
            string withSpace = clean.Insert(clean.Length - 2, " ");
            if (DateTime.TryParse(withSpace, out var dtSpace)) return dtSpace.TimeOfDay;
        }

        return TimeSpan.Zero;
    }

    /// <summary>
    /// Recalculate dead hours for ALL ProduccionDiaria that have Día Detallado entries
    /// </summary>
    [HttpPost("recalcular-horas-muertas")]
    public async Task<IActionResult> RecalcularHorasMuertasDesdeDetalles()
    {
        try
        {
            var parentIds = await _context.ProduccionDiariaDetalles
                .Select(d => d.ProduccionDiariaId)
                .Distinct()
                .ToListAsync();

            int updated = 0;

            foreach (var parentId in parentIds)
            {
                var parent = await _context.ProduccionDiaria
                    .FirstOrDefaultAsync(p => p.Id == parentId);
                if (parent == null) continue;

                var details = await _context.ProduccionDiariaDetalles
                    .Include(d => d.Actividad)
                    .Where(d => d.ProduccionDiariaId == parentId)
                    .ToListAsync();
                if (!details.Any()) continue;

                // Reset
                parent.TiempoPuestaPunto = 0;
                parent.HorasOperativas = 0;
                parent.TirosDiarios = 0;
                parent.Desperdicio = 0;
                parent.TiempoReparacion = 0;
                parent.HorasDescanso = 0;
                parent.TiempoOtroMuerto = 0;
                parent.HorasMantenimiento = 0;
                parent.TiempoFaltaTrabajo = 0;
                parent.HorasOtrosAux = 0;

                foreach (var d in details)
                {
                    decimal horas = 0;
                    if (d.HoraFin > d.HoraInicio)
                        horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                    string codigo = d.Actividad?.Codigo ?? "";
                    switch (codigo)
                    {
                        case "01": parent.TiempoPuestaPunto += horas; break;
                        case "02":
                            parent.HorasOperativas += horas;
                            parent.TirosDiarios += d.Tiros;
                            break;
                        case "03": parent.TiempoReparacion += horas; break;
                        case "04": parent.HorasDescanso += horas; break;
                        case "08": parent.TiempoOtroMuerto += horas; break;
                        case "10": parent.HorasMantenimiento += horas; break;
                        case "13": parent.TiempoFaltaTrabajo += horas; break;
                        case "14": parent.HorasOtrosAux += horas; break;
                        default: parent.HorasOtrosAux += horas; break;
                    }
                }

                parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                if (parent.HorasOperativas > 0)
                    parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;

                updated++;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = $"Recalculados {updated} registros" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

// DTO for day detail
public class DiaDetalleDto
{
    public int Id { get; set; }
    public long ProduccionDiariaId { get; set; }
    public string? HoraInicio { get; set; }
    public string? HoraFin { get; set; }
    public int ActividadId { get; set; }
    public int Tiros { get; set; }
    public string? ReferenciaOP { get; set; }
    public string? Observaciones { get; set; }
}
