using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConsolidadoNCController : ControllerBase
{
    private readonly AppDbContext _context;

    public ConsolidadoNCController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// GET api/consolidadonc/consolidado?mes=X&anio=Y
    /// Returns ALL encuestas for the period with their NC data (left join).
    /// Rows without NC data will have null NC fields.
    /// </summary>
    [HttpGet("consolidado")]
    public async Task<ActionResult> GetConsolidado(int? mes, int? anio)
    {
        var queryEncuestas = _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .AsQueryable();

        if (mes.HasValue && anio.HasValue)
        {
            queryEncuestas = queryEncuestas.Where(e => e.Fecha.Month == mes.Value && e.Fecha.Year == anio.Value);
        }

        var encuestas = await queryEncuestas.OrderByDescending(e => e.FechaCreacion).ToListAsync();

        // Get all NC records for these encuestas
        var encuestaIds = encuestas.Select(e => e.Id).ToList();
        var ncRecords = await _context.ConsolidadosNC
            .Where(nc => encuestaIds.Contains(nc.EncuestaProduccionId))
            .ToListAsync();

        var ncMap = ncRecords.ToDictionary(nc => nc.EncuestaProduccionId);

        var result = encuestas.Select(e =>
        {
            ncMap.TryGetValue(e.Id, out var nc);
            return new
            {
                encuestaId = e.Id,
                // Data from encuesta
                fecha = e.Fecha,
                ordenProduccion = e.OrdenProduccion,
                cliente = e.Cliente,
                referencia = e.Referencia,
                material = e.Material,
                cantidadTotal = e.CantidadAProducir,
                cantidadRecuperada = e.CantidadRecuperada,
                cantidadParaDespacho = e.CantidadParaDespacho,
                descripcionNovedad = e.Observaciones,
                totalProcesos = e.Procesos.Count,
                // NC data (null if not filled)
                ncId = nc?.Id,
                tipoReclamacion = nc?.TipoReclamacion,
                cantidadNC = nc?.CantidadNC ?? 0m,
                item = nc?.Item,
                tipoDefecto = nc?.TipoDefecto,
                responsable = nc?.Responsable,
                areaInvolucrada = nc?.AreaInvolucrada,
                cargo = nc?.Cargo,
                valorNC = nc?.ValorNC ?? 0m,
                producto = nc?.Producto,
                salidaNC = nc?.SalidaNC,
                controles = nc?.Controles,
                ncCompleto = nc != null && !string.IsNullOrEmpty(nc.TipoReclamacion)
                    && !string.IsNullOrEmpty(nc.TipoDefecto)
                    && !string.IsNullOrEmpty(nc.Responsable)
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// POST api/consolidadonc/guardar
    /// Creates or updates the NC record for a given encuesta.
    /// If ncId is null, auto-creates a new record. Otherwise updates.
    /// </summary>
    [HttpPost("guardar")]
    public async Task<ActionResult> GuardarNC([FromBody] GuardarNCDto dto)
    {
        try
        {
            ConsolidadoNC? nc;

            if (dto.NcId.HasValue && dto.NcId.Value > 0)
            {
                // Update existing
                nc = await _context.ConsolidadosNC.FindAsync(dto.NcId.Value);
                if (nc == null) return NotFound(new { message = "Registro NC no encontrado" });
            }
            else
            {
                // Auto-create from encuesta
                var encuesta = await _context.EncuestasCalidadProduccion
                    .FirstOrDefaultAsync(e => e.Id == dto.EncuestaProduccionId);

                if (encuesta == null)
                    return BadRequest(new { message = "Encuesta de Producción no encontrada" });

                nc = new ConsolidadoNC
                {
                    EncuestaProduccionId = encuesta.Id,
                    Fecha = encuesta.Fecha,
                    OrdenProduccion = encuesta.OrdenProduccion,
                    Cliente = encuesta.Cliente,
                    Referencia = encuesta.Referencia,
                    CantidadTotal = encuesta.CantidadAProducir,
                    DescripcionNovedad = encuesta.Observaciones,
                    FechaCreacion = DateTime.Now
                };
                _context.ConsolidadosNC.Add(nc);
            }

            // Update NC manual fields
            nc.TipoReclamacion = dto.TipoReclamacion;
            nc.CantidadNC = dto.CantidadNC;
            nc.Item = dto.Item;
            nc.TipoDefecto = dto.TipoDefecto;
            nc.Responsable = dto.Responsable;
            nc.AreaInvolucrada = dto.AreaInvolucrada;
            nc.Cargo = dto.Cargo;
            nc.ValorNC = dto.ValorNC;
            nc.Producto = dto.Producto;
            nc.SalidaNC = dto.SalidaNC;
            nc.Controles = dto.Controles;

            await _context.SaveChangesAsync();

            return Ok(new { id = nc.Id, message = "NC guardado correctamente" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CONSOLIDADO NC ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al guardar NC", details = ex.Message });
        }
    }

    /// <summary>
    /// DELETE api/consolidadonc/{id} — clears NC data for a record
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var nc = await _context.ConsolidadosNC.FindAsync(id);
        if (nc == null) return NotFound();

        _context.ConsolidadosNC.Remove(nc);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

// DTO for create/update
public class GuardarNCDto
{
    public int? NcId { get; set; }
    public int EncuestaProduccionId { get; set; }
    public string? TipoReclamacion { get; set; }
    public decimal CantidadNC { get; set; } = 0;
    public string? Item { get; set; }
    public string? TipoDefecto { get; set; }
    public string? Responsable { get; set; }
    public string? AreaInvolucrada { get; set; }
    public string? Cargo { get; set; }
    public decimal ValorNC { get; set; } = 0;
    public string? Producto { get; set; }
    public string? SalidaNC { get; set; }
    public string? Controles { get; set; }
}
