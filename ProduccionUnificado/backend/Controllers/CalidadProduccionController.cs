using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CalidadProduccionController : ControllerBase
{
    private readonly AppDbContext _context;

    // Lista de procesos disponibles (misma que CalidadController)
    private static readonly string[] Procesos = {
        "Conversión", "Corrugadora", "Guillotina", "Impresión", "Laminado",
        "Estampado", "Troquelado", "Screen", "Colaminadora", "Despique",
        "Pegadora", "Terminados", "Taller Externo", "Tejedora"
    };

    public CalidadProduccionController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("procesos")]
    public ActionResult<IEnumerable<string>> GetProcesos()
    {
        return Ok(Procesos);
    }

    [HttpGet("encuestas")]
    public async Task<ActionResult<IEnumerable<EncuestaCalidadProduccionResumenDto>>> GetEncuestas(int? mes, int? anio)
    {
        var query = _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .AsQueryable();

        if (mes.HasValue && anio.HasValue)
        {
            query = query.Where(e => e.Fecha.Month == mes.Value && e.Fecha.Year == anio.Value);
        }

        var encuestas = await query
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new EncuestaCalidadProduccionResumenDto
            {
                Id = e.Id,
                Fecha = e.Fecha,
                OrdenProduccion = e.OrdenProduccion,
                Referencia = e.Referencia,
                Material = e.Material,
                CantidadAProducir = e.CantidadAProducir,
                CantidadRecuperada = e.CantidadRecuperada,
                CantidadParaDespacho = e.CantidadParaDespacho,
                TotalProcesos = e.Procesos.Count,
                FechaCreacion = e.FechaCreacion
            })
            .ToListAsync();

        return Ok(encuestas);
    }

    [HttpGet("encuestas/{id}")]
    public async Task<ActionResult<EncuestaCalidadProduccionDetalleDto>> GetEncuesta(int id)
    {
        var encuesta = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (encuesta == null)
            return NotFound();

        return Ok(new EncuestaCalidadProduccionDetalleDto
        {
            Id = encuesta.Id,
            Fecha = encuesta.Fecha,
            OrdenProduccion = encuesta.OrdenProduccion,
            Referencia = encuesta.Referencia,
            Material = encuesta.Material,
            Cabida = encuesta.Cabida,
            CantidadAProducir = encuesta.CantidadAProducir,
            CantidadRecuperada = encuesta.CantidadRecuperada,
            CantidadParaDespacho = encuesta.CantidadParaDespacho,
            Observaciones = encuesta.Observaciones,
            FechaCreacion = encuesta.FechaCreacion,
            Procesos = encuesta.Procesos.Select(p => new ProcesoProduccionDto
            {
                Proceso = p.Proceso,
                CantidadProducida = p.CantidadProducida
            }).ToList()
        });
    }

    [HttpPost("encuestas")]
    public async Task<ActionResult> CrearEncuesta([FromBody] CrearEncuestaCalidadProduccionDto dto)
    {
        try
        {
            var encuesta = new EncuestaCalidadProduccion
            {
                Fecha = dto.Fecha,
                OrdenProduccion = dto.OrdenProduccion,
                Referencia = dto.Referencia,
                Material = dto.Material,
                Cabida = dto.Cabida,
                CantidadAProducir = dto.CantidadAProducir,
                CantidadRecuperada = dto.CantidadRecuperada,
                CantidadParaDespacho = dto.CantidadParaDespacho,
                Observaciones = dto.Observaciones,
                FechaCreacion = DateTime.Now
            };

            _context.EncuestasCalidadProduccion.Add(encuesta);
            await _context.SaveChangesAsync();

            // Agregar procesos
            foreach (var proc in dto.Procesos)
            {
                _context.EncuestaCalidadProduccionProcesos.Add(new EncuestaCalidadProduccionProceso
                {
                    EncuestaId = encuesta.Id,
                    Proceso = proc.Proceso,
                    CantidadProducida = proc.CantidadProducida
                });
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetEncuesta), new { id = encuesta.Id }, new { id = encuesta.Id });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CALIDAD PROD ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al guardar la encuesta", details = ex.Message });
        }
    }

    [HttpDelete("encuestas/{id}")]
    public async Task<IActionResult> EliminarEncuesta(int id)
    {
        var encuesta = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (encuesta == null)
            return NotFound();

        _context.EncuestasCalidadProduccion.Remove(encuesta);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
