using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ConsolidadoNCController : ControllerBase
{
    private readonly AppDbContext _context;

    public ConsolidadoNCController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("tipos-reclamacion")]
    public async Task<ActionResult<IEnumerable<string>>> GetTiposReclamacion()
    {
        var tipos = await _context.CalidadNC_TiposReclamacion
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .Select(t => t.Nombre)
            .ToListAsync();
        return Ok(tipos);
    }

    [HttpPost("tipos-reclamacion")]
    public async Task<ActionResult> AgregarTipoReclamacion([FromBody] NuevoTipoReclamacionDto dto)
    {
        var nombre = dto.Nombre?.Trim();
        if (string.IsNullOrWhiteSpace(nombre))
            return BadRequest(new { message = "Nombre requerido" });

        var exists = await _context.CalidadNC_TiposReclamacion
            .AnyAsync(t => t.Nombre.ToLower() == nombre.ToLower());
        if (!exists)
        {
            _context.CalidadNC_TiposReclamacion.Add(new CalidadNC_TipoReclamacionOpcion
            {
                Nombre = nombre,
                Activo = true
            });
            await _context.SaveChangesAsync();
        }

        return Ok(new { nombre });
    }

    [HttpGet("consolidado")]
    public async Task<ActionResult> GetConsolidado(int? mes, int? anio)
    {
        try
        {
            var queryEncuestas = _context.EncuestasCalidadProduccion
                .Include(e => e.Procesos)
                .AsQueryable();

            if (mes.HasValue && anio.HasValue)
                queryEncuestas = queryEncuestas.Where(e => e.Fecha.Month == mes.Value && e.Fecha.Year == anio.Value);

            var encuestas = await queryEncuestas.OrderByDescending(e => e.FechaCreacion).ToListAsync();

            var encuestaIds = encuestas.Select(e => e.Id).ToList();
            var ncRecords = encuestaIds.Count == 0
                ? new List<ConsolidadoNC>()
                : await _context.ConsolidadosNC
                    .Where(nc => encuestaIds.Contains(nc.EncuestaProduccionId))
                    .ToListAsync();

            var ncMap = ncRecords
                .GroupBy(nc => nc.EncuestaProduccionId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

            var result = encuestas.Select(e =>
            {
                ncMap.TryGetValue(e.Id, out var nc);
                var alcance = nc?.Alcance ?? e.Alcance;
                var tipoReclamacion = nc?.TipoReclamacion ?? e.TipoReclamacion;
                return new
                {
                    encuestaId = e.Id,
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
                    ncId = nc?.Id,
                    alcance,
                    tipoReclamacion,
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
                    ncCompleto = !string.IsNullOrWhiteSpace(alcance)
                        && !string.IsNullOrWhiteSpace(tipoReclamacion)
                        && !string.IsNullOrWhiteSpace(nc?.TipoDefecto)
                        && !string.IsNullOrWhiteSpace(nc?.Responsable)
                };
            }).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CONSOLIDADO NC LIST ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al cargar consolidado", details = ex.Message });
        }
    }

    [HttpPost("guardar")]
    public async Task<ActionResult> GuardarNC([FromBody] GuardarNCDto dto)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(dto.TipoReclamacionNuevo))
                await RegistrarTipoReclamacionSiNuevo(dto.TipoReclamacionNuevo);

            ConsolidadoNC? nc;

            if (dto.NcId.HasValue && dto.NcId.Value > 0)
            {
                nc = await _context.ConsolidadosNC.FindAsync(dto.NcId.Value);
                if (nc == null) return NotFound(new { message = "Registro NC no encontrado" });
            }
            else
            {
                nc = await _context.ConsolidadosNC
                    .FirstOrDefaultAsync(x => x.EncuestaProduccionId == dto.EncuestaProduccionId);

                if (nc == null)
                {
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
            }

            nc.Alcance = dto.Alcance;
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

            var encuestaRef = await _context.EncuestasCalidadProduccion
                .FirstOrDefaultAsync(e => e.Id == dto.EncuestaProduccionId);
            if (encuestaRef != null)
            {
                encuestaRef.Alcance = dto.Alcance;
                encuestaRef.TipoReclamacion = dto.TipoReclamacion;
            }

            await _context.SaveChangesAsync();

            return Ok(new { id = nc.Id, message = "NC guardado correctamente" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CONSOLIDADO NC ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al guardar NC", details = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var nc = await _context.ConsolidadosNC.FindAsync(id);
        if (nc == null) return NotFound();

        _context.ConsolidadosNC.Remove(nc);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task RegistrarTipoReclamacionSiNuevo(string? nombre)
    {
        var limpio = nombre?.Trim();
        if (string.IsNullOrWhiteSpace(limpio)) return;

        var exists = await _context.CalidadNC_TiposReclamacion
            .AnyAsync(t => t.Nombre.ToLower() == limpio.ToLower());
        if (!exists)
        {
            _context.CalidadNC_TiposReclamacion.Add(new CalidadNC_TipoReclamacionOpcion
            {
                Nombre = limpio,
                Activo = true
            });
        }
    }
}

public class GuardarNCDto
{
    public int? NcId { get; set; }
    public int EncuestaProduccionId { get; set; }
    public string? Alcance { get; set; }
    public string? TipoReclamacion { get; set; }
    public string? TipoReclamacionNuevo { get; set; }
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

public class NuevoTipoReclamacionDto
{
    public string? Nombre { get; set; }
}
