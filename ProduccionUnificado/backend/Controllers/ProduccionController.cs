using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Services;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

// [Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProduccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITiempoProcesoService _tiempoProcesoService;
    private readonly IWebHostEnvironment _env;

    public ProduccionController(AppDbContext context, ITiempoProcesoService tiempoProcesoService, IWebHostEnvironment env)
    {
        _context = context;
        _tiempoProcesoService = tiempoProcesoService;
        _env = env;
    }

    [HttpGet("maestros")]
    public async Task<ActionResult<object>> GetMaestros()
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var proveedores = await _context.Produccion_Proveedores.Where(p => p.Activo).ToListAsync();
        var tiposHora = await _context.Produccion_TiposHora.Where(t => t.Activo).ToListAsync();
        var tiposRecargo = await _context.Produccion_TiposRecargo.Where(t => t.Activo).ToListAsync();
        
        // Existing tables
        var maquinas = await _context.Maquinas.Where(m => m.Activo).Select(m => new { m.Id, m.Nombre }).ToListAsync();
        
        // Ordenamiento Natural (1, 2, ... 10)
        maquinas = maquinas.OrderBy(m => 
        {
            var match = System.Text.RegularExpressions.Regex.Match(m.Nombre, @"^\d+");
            return match.Success ? int.Parse(match.Value) : int.MaxValue;
        })
        .ThenBy(m => m.Nombre)
        .ToList();

        var usuarios = await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new { u.Id, u.Nombre, u.Salario }) // Include Salario for frontend calc
            .ToListAsync();

        return Ok(new
        {
            rubros,
            proveedores,
            tiposHora,
            tiposRecargo,
            maquinas,
            usuarios
        });
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
        _context.RegistrosDesperdicio.RemoveRange(desperdicios);

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Se eliminaron {records.Count} de resumen, {tiempos.Count} detalles y {desperdicios.Count} desperdicios." });
    }

    /// <summary>
    /// Guarda o actualiza registros de producción diaria para un mes completo.
    /// Soporta múltiples registros en un solo request (sincronización).
    /// </summary>
    [HttpPost("mensual")]
    public async Task<IActionResult> GuardarProduccionMensual([FromBody] List<ProduccionDiariaDto> registros)
    {
        try
        {
            if (registros == null || !registros.Any())
            {
                return BadRequest("No hay registros para guardar");
            }

            // Obtener el mes/año/máquina del primer registro para determinar qué borrar
            var primerRegistro = registros.First();
            var fecha = DateTime.Parse(primerRegistro.Fecha);
            var mes = fecha.Month;
            var anio = fecha.Year;
            var maquinaId = primerRegistro.MaquinaId;

            // Borrar registros existentes del mes/año/máquina para sincronización completa
            var existentes = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
                .ToListAsync();

            if (existentes.Any())
            {
                _context.ProduccionDiaria.RemoveRange(existentes);
            }

            // Insertar nuevos registros
            foreach (var dto in registros)
            {
                var fechaRegistro = DateTime.Parse(dto.Fecha);
                var horaInicio = TimeSpan.TryParse(dto.HoraInicio, out var hi) ? hi : TimeSpan.Zero;
                var horaFin = TimeSpan.TryParse(dto.HoraFin, out var hf) ? hf : TimeSpan.Zero;

                var produccion = new ProduccionDiaria
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
                    // Calcular totales auxiliares y muertos
                    TotalHorasAuxiliares = dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux,
                    TotalTiemposMuertos = dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto,
                    TotalHoras = dto.TotalHorasProductivas + dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux + dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto,
                    HorarioId = dto.HorarioId
                };
                _context.ProduccionDiaria.Add(produccion);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = $"Se guardaron {registros.Count} registros exitosamente." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error en GuardarProduccionMensual: {ex.Message}");
            Console.WriteLine($"StackTrace: {ex.StackTrace}");
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
    public async Task<ActionResult<Produccion_Gasto>> CreateGasto(Produccion_Gasto gasto)
    {
        // Basic validations
        if (gasto.RubroId <= 0) return BadRequest("Rubro es requerido");

        // Set Creator
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
        {
            gasto.CreadoPorId = adminId;
        }

        // Helper: Validate logic based on Rubro
        var rubro = await _context.Produccion_Rubros.FindAsync(gasto.RubroId);
        if (rubro != null)
        {
            if (rubro.Nombre == "Horas Extras" || rubro.Nombre == "Recargo")
            {
                bool isRecargo = rubro.Nombre == "Recargo";
                if (gasto.UsuarioId == null) return BadRequest("Usuario es requerido");
                if (!isRecargo && gasto.TipoHoraId == null) return BadRequest("Tipo de Hora es requerido");
                if (isRecargo && gasto.TipoRecargoId == null) return BadRequest("Tipo de Recargo es requerido");
                if (gasto.CantidadHoras == null || gasto.CantidadHoras <= 0) return BadRequest("Cantidad de Horas invalidas");

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

                if (usuario == null || factor <= 0) return BadRequest("Referencia no encontrada o factor inválido");

                // Formula: (Salario / 220) * Factor * Horas
                decimal hourlyRate = usuario.Salario / 220m;
                gasto.Precio = hourlyRate * factor * (gasto.CantidadHoras ?? 0);
                gasto.Precio = Math.Round(gasto.Precio, 2);
                
                gasto.NumeroFactura = null;
                gasto.FacturaPdfUrl = null;
            }
            else
            {
                // Non-Horas Extras rubros require invoice number
                if (string.IsNullOrWhiteSpace(gasto.NumeroFactura))
                    return BadRequest("Número de Factura es requerido para este tipo de rubro");
            }
            // Add more if needed
        }

        gasto.Fecha = gasto.Fecha.ToUniversalTime(); // Postgres timestamp handling
        gasto.FechaCreacion = DateTime.UtcNow;
        _context.Produccion_Gastos.Add(gasto);
        await _context.SaveChangesAsync();

        return Ok(gasto);
    }



    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Produccion_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        gasto.Fecha = gasto.Fecha.ToUniversalTime();

        // Preserve FechaCreacion
        var existingEntry = await _context.Produccion_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;

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
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario != null ? g.Usuario.Nombre : "N/A",
                UsuarioDocumento = g.Usuario != null ? g.Usuario.Documento : "",
                Salario = g.Usuario != null ? g.Usuario.Salario : 0, // ADDED
                ValorHora = g.Usuario != null ? (g.Usuario.Salario / 220m) : 0, // ADDED
                NumeroOP = g.NumeroOP ?? "",
                TipoHoraNombre = g.TipoHora != null ? g.TipoHora.Nombre : "N/A",
                Factor = g.TipoHora != null ? g.TipoHora.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Nota ?? "" // ADDED
            })
            .ToListAsync();

        return Ok(gastos);
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
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario != null ? g.Usuario.Nombre : "N/A",
                UsuarioDocumento = g.Usuario != null ? g.Usuario.Documento : "", // ADDED
                Salario = g.Usuario != null ? g.Usuario.Salario : 0, // ADDED
                ValorHora = g.Usuario != null ? (g.Usuario.Salario / 220m) : 0, // ADDED
                NumeroOP = g.NumeroOP ?? "",
                TipoRecargoNombre = g.TipoRecargo != null ? g.TipoRecargo.Nombre : "N/A",
                Factor = g.TipoRecargo != null ? g.TipoRecargo.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Nota ?? ""
            })
            .ToListAsync();
        
        // DEBUG LOG TO TRACE MISSING IDS
        Console.WriteLine($"[DEBUG] Found {gastos.Count} recargos records");
        foreach(var g in gastos) {
             Console.WriteLine($"[DEBUG] Recargo User: {g.UsuarioNombre}, ID: '{g.UsuarioDocumento}'");
        }

        return Ok(gastos);
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
    /// Get production summary with operators and machines data for a month
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen(int mes, int anio, int? diaInicio = null, int? diaFin = null)
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
        var maquinas = await _context.Maquinas.Where(m => m.Activo).ToListAsync();

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
                
                // Calculate TirosConEquivalencia
                var totalTiros = g.Sum(p => (p.Cambios * tirosReferencia) + p.TirosDiarios);
                var tirosBonificables = g.Sum(p => p.TirosBonificables);
                var diasOp = g.Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use Meta100Porciento like CalificacionController
                var meta100PorcientoBase = maq?.Meta100Porciento ?? maq?.MetaRendimiento ?? 7500;
                

                // Calculate meta100 iterating days to handle Half-Day Saturdays AND Jan 1-14 Adjustment
                decimal meta100 = 0;
                var distinctDays = g.Select(p => p.Fecha.Date).Distinct().ToList();
                foreach (var day in distinctDays)
                {
                    // JAN 1-14 2026 ADJUSTMENT: User requested strict division: Meta / Hours
                    if (day.Month == 1 && day.Day >= 1 && day.Day <= 14 && day.Year == 2026)
                    {
                        // Find stats for this specific day/user/machine
                        // Use Sum in case of multiple records per day for same user/machine
                        var dayHours = g.Where(p => p.Fecha.Date == day).Sum(p => p.TotalHoras);
                        if (dayHours > 0) 
                        {
                             // User instructions: "agarrar la meta del 100% y dividirla entre las horas"
                             // Example given: 7500 / 4 = 1875.
                             meta100 += (meta100PorcientoBase / (decimal)dayHours);
                        }
                    }
                    else if (day.DayOfWeek == DayOfWeek.Saturday)
                    {
                        meta100 += meta100PorcientoBase / 2;
                    }
                    else
                    {
                        meta100 += meta100PorcientoBase;
                    }
                }

                var meta75 = meta100 * 0.75m;
                
                var pct75 = meta75 > 0 ? (decimal)totalTiros / meta75 * 100 : 0;
                var pct100 = meta100 > 0 ? (decimal)totalTiros / meta100 * 100 : 0;
                
                string sem75 = pct75 >= 100 ? "Verde" : pct75 >= 75 ? "Amarillo" : "Rojo";
                string sem100 = pct100 >= 100 ? "Verde" : pct100 >= 75 ? "Amarillo" : "Rojo";

                // Apply 75% threshold: Only pay bonificación if operario achieved >= 75% of Meta100
                var valorBonifSum = g.Sum(p => p.ValorAPagarBonificable);
                var valorAPagarBonificableFinal = pct100 >= 75 ? valorBonifSum : 0;

                return new {
                    usuarioId = g.Key.UsuarioId,
                    maquinaId = g.Key.MaquinaId,
                    operario = first.Usuario?.Nombre ?? "Desconocido",
                    maquina = first.Maquina?.Nombre ?? "Desconocida",
                    totalTiros = totalTiros,
                    tirosBonificables = tirosBonificables,
                    totalHorasProductivas = g.Sum(p => p.TotalHorasProductivas),
                    promedioHoraProductiva = g.Average(p => p.PromedioHoraProductiva),
                    totalHoras = g.Sum(p => p.TotalHoras),
                    valorAPagar = g.Sum(p => p.ValorAPagar),
                    valorAPagarBonificable = valorAPagarBonificableFinal,
                    diasLaborados = diasOp,
                    metaBonificacion = meta75,
                    meta100Porciento = meta100,
                    eficiencia = pct100 / 100,
                    porcentajeRendimiento75 = pct75,
                    porcentajeRendimiento100 = pct100,
                    semaforoColor = sem75,
                    semaforoColor100 = sem100,
                    ultimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy"),
                };
            })
            .OrderBy(r => r.operario)
            .ThenBy(r => r.maquina)
            .ToList();

        // Group by Maquina only - ALIGNED WITH CalificacionController calculation
        var resumenMaquinas = produccion
            .GroupBy(p => p.MaquinaId)
            .Select(g => {
                var maq = maquinas.FirstOrDefault(m => m.Id == g.Key);
                var tirosReferencia = maq?.TirosReferencia ?? 0;
                
                // Calculate TirosConEquivalencia like CalificacionController
                var tirosTotales = g.Sum(p => (p.Cambios * tirosReferencia) + p.TirosDiarios);
                var diasMaq = g.Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use Meta100Porciento like CalificacionController
                var meta100PorcientoBase = maq?.Meta100Porciento ?? maq?.MetaRendimiento ?? 7500;
                

                // Calculate meta100 iterating days to handle Half-Day Saturdays AND Jan 1-14 Adjustment
                decimal meta100 = 0;
                var distinctDays = g.Select(p => p.Fecha.Date).Distinct().ToList();
                foreach (var day in distinctDays)
                {
                    // JAN 1-14 2026 ADJUSTMENT
                    if (day.Month == 1 && day.Day >= 1 && day.Day <= 14 && day.Year == 2026)
                    {
                        // Machine Summary
                        decimal totalHoursMachine = (decimal)g.Where(p => p.Fecha.Date == day).Sum(p => p.TotalHoras);
                        
                        // Apply same user logic: Base / Hours
                        if (totalHoursMachine > 0)
                        {
                             meta100 += (meta100PorcientoBase / totalHoursMachine);
                        }
                    }
                    else if (day.DayOfWeek == DayOfWeek.Saturday)
                    {
                        meta100 += meta100PorcientoBase / 2;
                    }
                    else
                    {
                        meta100 += meta100PorcientoBase;
                    }
                }

                var meta75 = meta100 * 0.75m;
                
                var pct = meta100 > 0 ? (decimal)tirosTotales / meta100 * 100 : 0;
                string sem = pct >= 100 ? "Verde" : pct >= 75 ? "Amarillo" : "Rojo";
                
                var importancia = maq?.Importancia ?? 0;
                var calificacion = pct * importancia / 100;

                return new {
                    maquinaId = g.Key,
                    maquina = maq?.Nombre ?? "Desconocida",
                    tirosTotales = tirosTotales,
                    rendimientoEsperado = meta100,
                    meta75Porciento = meta75,
                    meta100Porciento = meta100,
                    porcentajeRendimiento = pct / 100,
                    porcentajeRendimiento100 = pct,
                    semaforoColor = sem,
                    totalTiemposMuertos = g.Sum(p => p.TotalTiemposMuertos),
                    totalTiempoReparacion = g.Sum(p => p.TiempoReparacion),
                    totalTiempoFaltaTrabajo = g.Sum(p => p.TiempoFaltaTrabajo),
                    totalTiempoOtro = g.Sum(p => p.TiempoOtroMuerto),
                    importancia = importancia,
                    calificacion = Math.Round(calificacion, 2),
                    diasLaborados = diasMaq,
                    ultimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy")
                };
            })
            .OrderBy(r => r.maquina)
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
        var calificacionTotalPlanta = resumenMaquinas.Sum(m => m.calificacion);

        return Ok(new {
            resumenOperarios,
            resumenMaquinas,
            tendenciaDiaria,
            calificacionTotalPlanta
        });
    }

    /// <summary>
    /// Get budget summary for a month (renamed from original resumen)
    /// </summary>
    [HttpGet("resumen-gastos")]
    public async Task<ActionResult> GetResumenGastos(int anio, int mes)
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
    public async Task<ActionResult> UpdateSalario(int id, [FromBody] SalarioUpdateDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();
        usuario.Salario = dto.Salario;
        await _context.SaveChangesAsync();
        return Ok(new { usuario.Id, usuario.Nombre, usuario.Salario });
    }

    // ===================== PROVEEDORES CRUD =====================
    [HttpPost("proveedores")]
    public async Task<ActionResult> CreateProveedor([FromBody] Produccion_Proveedor proveedor)
    {
        proveedor.Activo = true;
        _context.Produccion_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(proveedor);
    }

    [HttpPut("proveedores/{id}")]
    public async Task<ActionResult> UpdateProveedor(int id, [FromBody] Produccion_Proveedor updated)
    {
        var proveedor = await _context.Produccion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Nombre = updated.Nombre;
        proveedor.Nit = updated.Nit;
        proveedor.Telefono = updated.Telefono;
        proveedor.RubroId = updated.RubroId;
        proveedor.PrecioCotizado = updated.PrecioCotizado;
        await _context.SaveChangesAsync();
        return Ok(proveedor);
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

        var breakdown = new List<object>();
        decimal totalMeta = 0;

        var distinctDays = produccion.Select(p => p.Fecha.Date).Distinct().ToList();
        
        foreach (var day in distinctDays)
        {
            decimal metaDia = 0;
            string formula = "";
            decimal divisor = 0;

            var prodDia = produccion.Where(p => p.Fecha.Date == day).ToList();
            // AJUSTE: Sum both normal hours and dead time for total hours as per recent fix
            decimal horas = prodDia.Sum(p => p.TotalHoras);
            
            // Equivalence Data
            int cambios = prodDia.Sum(p => p.Cambios);
            int tirosDiarios = prodDia.Sum(p => p.TirosDiarios);
            int tirosCambios = cambios * maquina.TirosReferencia;

            if (day.Month == 1 && day.Day >= 1 && day.Day <= 14 && day.Year == 2026)
            {
                if (horas > 0)
                {
                    metaDia = maquina.Meta100Porciento / horas;
                    formula = $"MetaBase ({maquina.Meta100Porciento}) / Horas ({horas:F2})";
                    divisor = horas;
                }
                tirosCambios = 0; // Cambios ignored for strict equivalent in this period, BUT user asked for "sum of equivalent shots"
                // Actually, user asked to see "suma los tiros equivalentes por cambios y el numero de cambios"
                // Since I reverted the logic, TirosCambios SHOULD be counted now.
                // Reverted logic: TirosEquivalentes = (TirosRef * Cambios) + R_Final
                tirosCambios = cambios * maquina.TirosReferencia;
            }
            else if (day.DayOfWeek == DayOfWeek.Saturday)
            {
                metaDia = maquina.Meta100Porciento / 2;
                formula = "MetaBase / 2 (Sabado)";
            }
            else
            {
                metaDia = maquina.Meta100Porciento;
                formula = "MetaBase Completa";
            }

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
                decimal hourlyRate = g.Usuario.Salario / 220m;
                g.Precio = Math.Round(hourlyRate * factor * g.CantidadHoras.Value, 2);
                count++;
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Recalculated {count} records." });
    }
}
