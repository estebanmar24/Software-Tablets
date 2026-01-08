using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EquiposController : ControllerBase
{
    private readonly AppDbContext _context;

    public EquiposController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Obtiene estadísticas del dashboard
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        try 
        {
            var equipos = await _context.Equipos.ToListAsync();
            var totalEquipos = equipos.Count;
            var disponibles = equipos.Count(e => e.Estado == "Disponible");
            var asignados = equipos.Count(e => e.Estado == "Asignado");
            var enMantenimiento = equipos.Count(e => e.Estado == "EnMantenimiento");
            var fueraDeServicio = equipos.Count(e => e.Estado == "FueraDeServicio");

            // Mantenimientos realizados este mes
            var inicioMes = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var mantenimientosEsteMes = await _context.HistorialMantenimientos
                .Where(m => m.Fecha >= inicioMes)
                .CountAsync();

            return Ok(new
            {
                totalEquipos,
                disponibles,
                asignados,
                enMantenimiento,
                fueraDeServicio,
                mantenimientosEsteMes,
                porcentajeOperativos = totalEquipos > 0 
                    ? Math.Round((decimal)(disponibles + asignados) / totalEquipos * 100, 0) 
                    : 0
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message, stack = ex.StackTrace?.Substring(0, Math.Min(500, ex.StackTrace?.Length ?? 0)) });
        }
    }

    /// <summary>
    /// Obtiene próximos mantenimientos programados (30 días)
    /// </summary>
    [HttpGet("proximos-mantenimientos")]
    public async Task<ActionResult> GetProximosMantenimientos()
    {
        var hoy = DateTime.UtcNow.Date;
        var en30Dias = hoy.AddDays(30);

        var equiposConProximo = await _context.Equipos
            .Where(e => e.ProximoMantenimiento != null && 
                        e.ProximoMantenimiento >= hoy && 
                        e.ProximoMantenimiento <= en30Dias)
            .OrderBy(e => e.ProximoMantenimiento)
            .Select(e => new
            {
                e.Id,
                e.Nombre,
                e.Ubicacion,
                e.Area,
                e.ProximoMantenimiento
            })
            .ToListAsync();

        // Calculate days in memory (not in SQL)
        var proximos = equiposConProximo.Select(e => new
        {
            e.Id,
            e.Nombre,
            e.Ubicacion,
            e.Area,
            e.ProximoMantenimiento,
            DiasRestantes = e.ProximoMantenimiento.HasValue 
                ? (int)(e.ProximoMantenimiento.Value.Date - hoy).TotalDays 
                : 0
        }).ToList();

        return Ok(new { pendientes = proximos.Count, proximos });
    }

    /// <summary>
    /// Lista todos los equipos
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Equipo>>> GetEquipos(
        [FromQuery] string? estado = null,
        [FromQuery] string? area = null,
        [FromQuery] string? buscar = null)
    {
        var query = _context.Equipos.AsQueryable();

        if (!string.IsNullOrEmpty(estado))
            query = query.Where(e => e.Estado == estado);

        if (!string.IsNullOrEmpty(area))
            query = query.Where(e => e.Area == area);

        if (!string.IsNullOrEmpty(buscar))
        {
            var term = buscar.ToLower();
            query = query.Where(e => 
                e.Nombre.ToLower().Contains(term) ||
                (e.PcMarca != null && e.PcMarca.ToLower().Contains(term)) ||
                (e.PcModelo != null && e.PcModelo.ToLower().Contains(term)) ||
                (e.Ubicacion != null && e.Ubicacion.ToLower().Contains(term)) ||
                (e.UsuarioAsignado != null && e.UsuarioAsignado.ToLower().Contains(term)));
        }

        var equipos = await query.OrderBy(e => e.Nombre).ToListAsync();
        return Ok(equipos);
    }

    /// <summary>
    /// Obtiene un equipo por ID (con historial de mantenimientos)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Equipo>> GetEquipo(int id)
    {
        var equipo = await _context.Equipos
            .Include(e => e.Mantenimientos.OrderByDescending(m => m.Fecha))
            .FirstOrDefaultAsync(e => e.Id == id);

        if (equipo == null)
            return NotFound(new { message = "Equipo no encontrado" });

        return Ok(equipo);
    }

    /// <summary>
    /// Crea un nuevo equipo
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Equipo>> CreateEquipo([FromBody] Equipo equipo)
    {
        try 
        {
            equipo.FechaCreacion = DateTime.UtcNow;
            equipo.FechaActualizacion = DateTime.UtcNow;

            _context.Equipos.Add(equipo);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetEquipo), new { id = equipo.Id }, equipo);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Actualiza un equipo
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateEquipo(int id, [FromBody] Equipo equipo)
    {
        if (id != equipo.Id)
            return BadRequest(new { message = "ID no coincide" });

        var existente = await _context.Equipos.FindAsync(id);
        if (existente == null)
            return NotFound(new { message = "Equipo no encontrado" });

        // Actualizar campos
        _context.Entry(existente).CurrentValues.SetValues(equipo);
        existente.FechaActualizacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(existente);
    }

    /// <summary>
    /// Cambia el estado de un equipo
    /// </summary>
    [HttpPatch("{id}/estado")]
    public async Task<ActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoDto dto)
    {
        var equipo = await _context.Equipos.FindAsync(id);
        if (equipo == null)
            return NotFound(new { message = "Equipo no encontrado" });

        var estadosValidos = new[] { "Disponible", "Asignado", "EnMantenimiento", "FueraDeServicio" };
        if (!estadosValidos.Contains(dto.Estado))
            return BadRequest(new { message = "Estado inválido" });

        equipo.Estado = dto.Estado;
        equipo.FechaActualizacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Estado actualizado", equipo.Estado });
    }

    /// <summary>
    /// Elimina un equipo
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteEquipo(int id)
    {
        var equipo = await _context.Equipos.FindAsync(id);
        if (equipo == null)
            return NotFound(new { message = "Equipo no encontrado" });

        _context.Equipos.Remove(equipo);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Equipo eliminado" });
    }

    // ============ HISTORIAL DE MANTENIMIENTOS ============

    /// <summary>
    /// Obtiene el historial de mantenimientos de un equipo
    /// </summary>
    [HttpGet("{id}/mantenimientos")]
    public async Task<ActionResult> GetMantenimientos(int id)
    {
        try
        {
            var equipo = await _context.Equipos.FindAsync(id);
            if (equipo == null)
                return NotFound(new { message = "Equipo no encontrado" });

            // Project to anonymous objects to avoid circular reference with Equipo navigation
            var mantenimientos = await _context.HistorialMantenimientos
                .Where(m => m.EquipoId == id)
                .OrderByDescending(m => m.Fecha)
                .Select(m => new
                {
                    m.Id,
                    m.Tipo,
                    m.TrabajoRealizado,
                    m.Tecnico,
                    m.Costo,
                    m.Fecha,
                    m.ProximoProgramado,
                    m.Observaciones
                })
                .ToListAsync();

            var costoTotal = mantenimientos.Sum(m => m.Costo);

            return Ok(new
            {
                equipoId = id,
                equipoNombre = equipo.Nombre,
                totalRegistros = mantenimientos.Count,
                costoTotal,
                mantenimientos
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Registra un nuevo mantenimiento
    /// </summary>
    [HttpPost("{id}/mantenimientos")]
    public async Task<ActionResult> RegistrarMantenimiento(int id, [FromBody] HistorialMantenimiento mantenimiento)
    {
        try
        {
            var equipo = await _context.Equipos.FindAsync(id);
            if (equipo == null)
                return NotFound(new { message = "Equipo no encontrado" });

            mantenimiento.EquipoId = id;
            mantenimiento.Fecha = DateTime.UtcNow;

            _context.HistorialMantenimientos.Add(mantenimiento);

            // Actualizar fechas del equipo
            equipo.UltimoMantenimiento = mantenimiento.Fecha;
            if (mantenimiento.ProximoProgramado.HasValue)
            {
                equipo.ProximoMantenimiento = mantenimiento.ProximoProgramado;
            }
            equipo.FechaActualizacion = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Mantenimiento registrado", id = mantenimiento.Id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Obtiene lista de áreas/departamentos existentes
    /// </summary>
    [HttpGet("areas")]
    public async Task<ActionResult> GetAreas()
    {
        var areas = await _context.Equipos
            .Where(e => e.Area != null)
            .Select(e => e.Area)
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync();

        return Ok(areas);
    }
}

public class CambiarEstadoDto
{
    public string Estado { get; set; } = string.Empty;
}
