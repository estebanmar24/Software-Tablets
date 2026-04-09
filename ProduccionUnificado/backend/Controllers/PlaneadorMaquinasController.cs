using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlaneadorMaquinasController : ControllerBase
{
    private readonly AppDbContext _context;

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
}
