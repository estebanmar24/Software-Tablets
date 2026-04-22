using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CalidadProduccionController : ControllerBase
{
    private readonly AppDbContext _context;

    // Lista de procesos disponibles (misma que CalidadController)
    private static readonly string[] Procesos = {
        "Conversión", "Corrugadora", "Guillotina", "Impresión", "Laminado",
        "Estampado", "Troquelado", "Screen", "Colaminadora", "Despique",
        "Pegadora", "Terminados", "Taller Externo", "Tejedora",
        "Diseño", "Facturación", "Despachos", "Comercial"
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
                Cliente = e.Cliente,
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
            Cliente = encuesta.Cliente,
            Cabida = encuesta.Cabida,
            CantidadAProducir = encuesta.CantidadAProducir,
            CantidadRecuperada = encuesta.CantidadRecuperada,
            CantidadParaDespacho = encuesta.CantidadParaDespacho,
            Observaciones = encuesta.Observaciones,
            FechaCreacion = encuesta.FechaCreacion,
            Procesos = encuesta.Procesos.Select(p => new ProcesoProduccionDto
            {
                Proceso = p.Proceso,
                CantidadProducida = p.CantidadProducida,
                Observaciones = p.Observaciones
            }).ToList()
        });
    }

    [AllowAnonymous]
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
                Cliente = dto.Cliente,
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
                    CantidadProducida = proc.CantidadProducida,
                    Observaciones = proc.Observaciones
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

    [HttpPut("encuestas/{id}")]
    public async Task<ActionResult> ActualizarEncuesta(int id, [FromBody] CrearEncuestaCalidadProduccionDto dto)
    {
        try
        {
            var encuesta = await _context.EncuestasCalidadProduccion
                .Include(e => e.Procesos)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (encuesta == null)
                return NotFound();

            // Actualizar cabecera
            encuesta.Fecha = dto.Fecha;
            encuesta.OrdenProduccion = dto.OrdenProduccion;
            encuesta.Referencia = dto.Referencia;
            encuesta.Material = dto.Material;
            encuesta.Cliente = dto.Cliente;
            encuesta.Cabida = dto.Cabida;
            encuesta.CantidadAProducir = dto.CantidadAProducir;
            encuesta.CantidadRecuperada = dto.CantidadRecuperada;
            encuesta.CantidadParaDespacho = dto.CantidadParaDespacho;
            encuesta.Observaciones = dto.Observaciones;

            // Actualizar procesos (borramos y volvemos a añadir)
            _context.EncuestaCalidadProduccionProcesos.RemoveRange(encuesta.Procesos);
            
            foreach (var proc in dto.Procesos)
            {
                _context.EncuestaCalidadProduccionProcesos.Add(new EncuestaCalidadProduccionProceso
                {
                    EncuestaId = encuesta.Id,
                    Proceso = proc.Proceso,
                    CantidadProducida = proc.CantidadProducida,
                    Observaciones = proc.Observaciones
                });
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CALIDAD PROD UPDATE ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al actualizar la encuesta", details = ex.Message });
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
