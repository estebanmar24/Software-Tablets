using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using System.Text.Json;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class PlaneadorMaquinasController : ControllerBase
{
    private readonly AppDbContext _context;

    public static readonly string[] ProcesosDisponibles =
    {
        "Preprensa", "Conversion", "Corte", "Impresion", "Recubrimiento",
        "Colaminado", "Estampado", "Troquelado", "Terminado"
    };

    private static readonly string[] OpColors =
    {
        "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
        "#06B6D4", "#6366F1", "#EAB308", "#22C55E", "#EF4444"
    };

    public PlaneadorMaquinasController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("rango")]
    public async Task<IActionResult> GetByRango([FromQuery] string start, [FromQuery] string end)
    {
        if (!DateTime.TryParse(start, out var startDate) || !DateTime.TryParse(end, out var endDate))
        {
            return BadRequest("Formato de fecha inválido.");
        }

        var planes = await _context.PlaneacionesMaquinas
            .Include(p => p.Maquina)
            .Include(p => p.OrdenProduccion)
            .Where(p => p.FechaInicio >= startDate && p.FechaFin <= endDate)
            .ToListAsync();

        return Ok(planes);
    }

    [HttpGet("actual")]
    public async Task<IActionResult> GetPlanActual([FromQuery] int maquinaId)
    {
        var now = DateTime.Now;
        var plan = await _context.PlaneacionesMaquinas
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.MaquinaId == maquinaId && p.FechaInicio <= now && p.FechaFin >= now);

        if (plan == null) return NotFound();

        return Ok(plan);
    }

    // Endpoints de Telemetría con prefijo único para evitar conflictos de ruteo
    [HttpGet("telemetria/estado")]
    public async Task<IActionResult> GetEstadoActualMaquinas()
    {
        var today = DateTime.Today;
        // Traer activos y finalizados de hoy y ayer
        var limitDate = today.AddDays(-2);
        var procesos = await _context.TiemposProceso
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.HoraInicio >= limitDate)
            .Select(t => new {
                t.MaquinaId,
                ActividadCodigo = t.Actividad != null ? t.Actividad.Codigo : "00",
                t.ActividadId,
                t.OrdenProduccionId,
                OrdenProduccionNumero = t.OrdenProduccion != null ? t.OrdenProduccion.Numero : "",
                t.HoraInicio,
                t.HoraFin,
                EsActivo = (t.HoraFin == default(DateTime) || t.Duracion == 0)
            })
            .ToListAsync();

        return Ok(procesos);
    }

    [HttpGet("telemetria/debug")]
    public async Task<IActionResult> GetDebugData()
    {
        try 
        {
            var total = await _context.TiemposProceso.CountAsync();
            var todayCount = await _context.TiemposProceso.CountAsync(t => t.Fecha >= DateTime.Today);
            var recent = await _context.TiemposProceso
                .OrderByDescending(t => t.Id)
                .Take(10)
                .Select(t => new { t.Id, t.Fecha, t.HoraInicio, t.MaquinaId, t.OrdenProduccionId })
                .ToListAsync();
                
            return Ok(new { total, todayCount, recent });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> CrearPlan([FromBody] PlaneacionMaquina plan)
    {
        if (plan.FechaInicio >= plan.FechaFin) return BadRequest("La fecha de inicio debe ser anterior a la fecha de fin.");

        // Check for overlaps
        var overlap = await _context.PlaneacionesMaquinas
            .AnyAsync(p => p.MaquinaId == plan.MaquinaId && p.FechaInicio < plan.FechaFin && p.FechaFin > plan.FechaInicio);

        if (overlap) return BadRequest("La máquina ya tiene una planeación en el horario seleccionado.");

        _context.PlaneacionesMaquinas.Add(plan);
        await _context.SaveChangesAsync();
        
        // Cargar los includes para devolver el objeto completo
        var savedPlan = await _context.PlaneacionesMaquinas
            .Include(p => p.Maquina)
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.Id == plan.Id);
            
        return CreatedAtAction(nameof(GetPlanActual), new { maquinaId = plan.MaquinaId }, savedPlan);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePlaneacion(int id)
    {
        var plan = await _context.PlaneacionesMaquinas.FindAsync(id);
        if (plan == null) return NotFound();

        _context.PlaneacionesMaquinas.Remove(plan);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdatePlaneacion(int id, PlaneacionMaquina updated)
    {
        if (id != updated.Id) return BadRequest();

        var existing = await _context.PlaneacionesMaquinas.FindAsync(id);
        if (existing == null) return NotFound();

        existing.OrdenProduccionId = updated.OrdenProduccionId;
        existing.FechaInicio = updated.FechaInicio;
        existing.FechaFin = updated.FechaFin;
        existing.MetaTiros = updated.MetaTiros;
        existing.Referencia = updated.Referencia;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ==================== PROGRAMACIÓN OP (GANTT) ====================

    [HttpGet("procesos")]
    public IActionResult GetProcesosDisponibles()
    {
        return Ok(ProcesosDisponibles);
    }

    [HttpGet("programacion/rango")]
    public async Task<IActionResult> GetProgramacionesRango([FromQuery] string start, [FromQuery] string end)
    {
        if (!DateTime.TryParse(start, out var startDate) || !DateTime.TryParse(end, out var endDate))
            return BadRequest("Formato de fecha inválido.");

        var programaciones = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .Where(p => p.Procesos.Any(pr =>
                pr.FechaInicio <= endDate && pr.FechaFin >= startDate))
            .OrderBy(p => p.NumeroOP)
            .ToListAsync();

        var encuestas = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .Where(e => programaciones.Select(p => p.NumeroOP).Contains(e.OrdenProduccion))
            .ToListAsync();

        var result = programaciones.Select(p => MapToDetalleDto(p, encuestas)).ToList();
        return Ok(result);
    }

    [HttpGet("programacion/{id:int}")]
    public async Task<IActionResult> GetProgramacion(int id)
    {
        var programacion = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (programacion == null) return NotFound();

        var encuestas = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .Where(e => e.OrdenProduccion == programacion.NumeroOP)
            .ToListAsync();

        return Ok(MapToDetalleDto(programacion, encuestas));
    }

    [HttpPost("programacion")]
    public async Task<IActionResult> CrearProgramacion([FromBody] CrearProgramacionOPDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.NumeroOP))
                return BadRequest("El número de OP es obligatorio.");
            if (dto.Procesos == null || dto.Procesos.Count == 0)
                return BadRequest("Debe asignar al menos un proceso.");

            foreach (var proc in dto.Procesos)
            {
                if (proc.FechaInicio >= proc.FechaFin)
                    return BadRequest($"El proceso {proc.Proceso} tiene fechas/horas inválidas.");
            }

            var colorIndex = await _context.ProgramacionesOP.CountAsync();
            var programacion = new ProgramacionOP
            {
                NumeroOP = dto.NumeroOP.Trim(),
                OrdenProduccionId = dto.OrdenProduccionId,
                Cliente = dto.Cliente?.Trim() ?? string.Empty,
                MetaTiros = dto.MetaTiros,
                Color = dto.Color ?? OpColors[colorIndex % OpColors.Length],
                FechaCreacion = DateTime.Now,
                Procesos = dto.Procesos.Select(p => MapProcesoInput(p)).ToList()
            };

            _context.ProgramacionesOP.Add(programacion);
            await _context.SaveChangesAsync();

            var saved = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .Include(p => p.OrdenProduccion)
                .FirstAsync(p => p.Id == programacion.Id);

            return CreatedAtAction(nameof(GetProgramacion), new { id = saved.Id }, MapToDetalleDto(saved, new()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error al guardar programación: {ex.Message}");
        }
    }

    [HttpPut("programacion/{id:int}")]
    public async Task<IActionResult> ActualizarProgramacion(int id, [FromBody] CrearProgramacionOPDto dto)
    {
        var existing = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        existing.NumeroOP = dto.NumeroOP.Trim();
        existing.OrdenProduccionId = dto.OrdenProduccionId;
        existing.Cliente = dto.Cliente?.Trim() ?? string.Empty;
        existing.MetaTiros = dto.MetaTiros;
        if (!string.IsNullOrWhiteSpace(dto.Color)) existing.Color = dto.Color;

        _context.ProgramacionesOPProcesos.RemoveRange(existing.Procesos);
        existing.Procesos = dto.Procesos.Select(p => MapProcesoInput(p)).ToList();

        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static ProgramacionOPProceso MapProcesoInput(ProgramacionProcesoInputDto p)
    {
        return new ProgramacionOPProceso
        {
            Proceso = p.Proceso,
            FechaInicio = p.FechaInicio,
            FechaFin = p.FechaFin,
            HorasEstimadas = p.HorasEstimadas,
            TiemposAuxiliaresJson = p.TiemposAuxiliares?.Count > 0
                ? JsonSerializer.Serialize(p.TiemposAuxiliares)
                : null
        };
    }

    private static List<TiempoAuxiliarDto> DeserializeAuxiliares(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<TiempoAuxiliarDto>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }

    [HttpDelete("programacion/{id:int}")]
    public async Task<IActionResult> EliminarProgramacion(int id)
    {
        var programacion = await _context.ProgramacionesOP.FindAsync(id);
        if (programacion == null) return NotFound();

        _context.ProgramacionesOP.Remove(programacion);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static ProgramacionOPDetalleDto MapToDetalleDto(ProgramacionOP p, List<EncuestaCalidadProduccion> encuestas)
    {
        var now = DateTime.Now;
        var procesosDto = p.Procesos.OrderBy(pr => pr.FechaInicio).Select(pr =>
        {
            var producido = encuestas
                .SelectMany(e => e.Procesos)
                .Where(ep => NormalizeProceso(ep.Proceso) == NormalizeProceso(pr.Proceso))
                .Sum(ep => ep.CantidadProducida);

            var totalMs = (pr.FechaFin - pr.FechaInicio).TotalMilliseconds;
            var elapsedMs = Math.Max(0, Math.Min((now - pr.FechaInicio).TotalMilliseconds, totalMs));
            var pctTiempo = totalMs > 0 ? (int)Math.Round(elapsedMs / totalMs * 100) : 0;

            string estado;
            if (producido > 0 && now >= pr.FechaFin) estado = "completado";
            else if (producido > 0 || (now >= pr.FechaInicio && now <= pr.FechaFin)) estado = "en_proceso";
            else if (now > pr.FechaFin) estado = "atrasado";
            else estado = "pendiente";

            return new ProgramacionProcesoProgresoDto
            {
                Id = pr.Id,
                Proceso = pr.Proceso,
                FechaInicio = pr.FechaInicio,
                FechaFin = pr.FechaFin,
                HorasEstimadas = pr.HorasEstimadas,
                TiemposAuxiliares = DeserializeAuxiliares(pr.TiemposAuxiliaresJson),
                Estado = estado,
                CantidadProducida = producido,
                PorcentajeTiempo = pctTiempo
            };
        }).ToList();

        var progresoGeneral = procesosDto.Count == 0 ? 0 :
            (int)Math.Round(procesosDto.Count(pr => pr.Estado == "completado") / (double)procesosDto.Count * 100);

        return new ProgramacionOPDetalleDto
        {
            Id = p.Id,
            NumeroOP = p.NumeroOP,
            OrdenProduccionId = p.OrdenProduccionId,
            Cliente = p.Cliente,
            MetaTiros = p.MetaTiros,
            Color = p.Color,
            FechaCreacion = p.FechaCreacion,
            Procesos = procesosDto,
            ProgresoGeneral = progresoGeneral
        };
    }

    private static string NormalizeProceso(string proceso)
    {
        return proceso.Trim().ToLowerInvariant()
            .Replace("ó", "o").Replace("í", "i").Replace("é", "e").Replace("á", "a").Replace("ú", "u");
    }
}
