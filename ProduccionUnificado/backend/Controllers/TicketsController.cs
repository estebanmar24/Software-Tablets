using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TicketsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TicketsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Obtiene estadísticas de tickets
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats([FromQuery] string? reportadoPor = null)
    {
        try
        {
            var query = _context.Tickets.AsQueryable();
            if (!string.IsNullOrEmpty(reportadoPor))
                query = query.Where(t => t.ReportadoPor == reportadoPor);
            var tickets = await query.ToListAsync();
            var total = tickets.Count;
            var abiertos = tickets.Count(t => t.Estado == "Abierto");
            var enProgreso = tickets.Count(t => t.Estado == "EnProgreso");
            var resueltos = tickets.Count(t => t.Estado == "Resuelto");
            var cerrados = tickets.Count(t => t.Estado == "Cerrado");

            var altaPrioridad = tickets.Count(t => t.Prioridad == "Alta" && t.Estado != "Cerrado" && t.Estado != "Resuelto");

            return Ok(new
            {
                total,
                abiertos,
                enProgreso,
                resueltos,
                cerrados,
                altaPrioridad
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Lista todos los tickets con filtros opcionales
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Ticket>>> GetTickets(
        [FromQuery] string? estado = null,
        [FromQuery] string? prioridad = null,
        [FromQuery] string? modulo = null,
        [FromQuery] string? buscar = null,
        [FromQuery] string? reportadoPor = null)
    {
        try
        {
            var query = _context.Tickets.Include(t => t.Imagenes).AsQueryable();

            if (!string.IsNullOrEmpty(reportadoPor))
                query = query.Where(t => t.ReportadoPor == reportadoPor);

            if (!string.IsNullOrEmpty(estado))
                query = query.Where(t => t.Estado == estado);

            if (!string.IsNullOrEmpty(prioridad))
                query = query.Where(t => t.Prioridad == prioridad);

            if (!string.IsNullOrEmpty(modulo))
                query = query.Where(t => t.ModuloAfectado == modulo);

            if (!string.IsNullOrEmpty(buscar))
            {
                var term = buscar.ToLower();
                query = query.Where(t =>
                    t.Titulo.ToLower().Contains(term) ||
                    t.Descripcion.ToLower().Contains(term) ||
                    (t.ReportadoPor != null && t.ReportadoPor.ToLower().Contains(term)));
            }

            var tickets = await query.OrderByDescending(t => t.FechaCreacion).ToListAsync();
            return Ok(tickets);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Obtiene un ticket por ID con sus imágenes
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Ticket>> GetTicket(int id)
    {
        var ticket = await _context.Tickets
            .Include(t => t.Imagenes)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
            return NotFound(new { message = "Ticket no encontrado" });

        return Ok(ticket);
    }

    /// <summary>
    /// Crea un nuevo ticket
    /// </summary>
    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult<Ticket>> CreateTicket([FromBody] Ticket ticket)
    {
        try
        {
            // Validar prioridad
            var prioridadesValidas = new[] { "Baja", "Media", "Alta" };
            if (!prioridadesValidas.Contains(ticket.Prioridad))
                return BadRequest(new { message = "Prioridad inválida. Use: Baja, Media o Alta" });

            ticket.Estado = "Abierto";
            ticket.FechaCreacion = DateTime.UtcNow;
            ticket.FechaActualizacion = DateTime.UtcNow;

            _context.Tickets.Add(ticket);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Actualiza un ticket existente
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTicket(int id, [FromBody] Ticket ticket)
    {
        try
        {
            var existente = await _context.Tickets.Include(t => t.Imagenes).FirstOrDefaultAsync(t => t.Id == id);
            if (existente == null)
                return NotFound(new { message = "Ticket no encontrado" });

            // Validar estado
            var estadosValidos = new[] { "Abierto", "EnProgreso", "Resuelto", "Cerrado" };
            if (!estadosValidos.Contains(ticket.Estado))
                return BadRequest(new { message = "Estado inválido" });

            // Si se resuelve, registrar fecha de resolución
            if (ticket.Estado == "Resuelto" && existente.Estado != "Resuelto")
            {
                existente.FechaResolucion = DateTime.UtcNow;
            }

            existente.Titulo = ticket.Titulo;
            existente.Descripcion = ticket.Descripcion;
            existente.PasosReproducir = ticket.PasosReproducir;
            existente.Prioridad = ticket.Prioridad;
            existente.Estado = ticket.Estado;
            existente.ModuloAfectado = ticket.ModuloAfectado;
            existente.Comentarios = ticket.Comentarios;
            existente.FechaActualizacion = DateTime.UtcNow;

            // Manejar imágenes: reemplazar lista completa
            var imagenesExistentes = await _context.TicketImagenes.Where(ti => ti.TicketId == id).ToListAsync();
            if (imagenesExistentes.Any())
            {
                _context.TicketImagenes.RemoveRange(imagenesExistentes);
            }
            existente.Imagenes.Clear();

            if (ticket.Imagenes != null && ticket.Imagenes.Count > 0)
            {
                foreach (var img in ticket.Imagenes)
                {
                    existente.Imagenes.Add(new TicketImagen
                    {
                        ImagenUrl = img.ImagenUrl,
                        FechaSubida = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();
            return Ok(existente);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Actualiza solo el estado de un ticket
    /// </summary>
    [HttpPatch("{id}/estado")]
    public async Task<ActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoTicketDto dto)
    {
        try
        {
            var ticket = await _context.Tickets.FindAsync(id);
            if (ticket == null)
                return NotFound(new { message = "Ticket no encontrado" });

            var estadosValidos = new[] { "Abierto", "EnProgreso", "Resuelto", "Cerrado" };
            if (!estadosValidos.Contains(dto.Estado))
                return BadRequest(new { message = "Estado inválido" });

            if (dto.Estado == "Resuelto" && ticket.Estado != "Resuelto")
            {
                ticket.FechaResolucion = DateTime.UtcNow;
            }

            ticket.Estado = dto.Estado;
            ticket.FechaActualizacion = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(dto.Comentarios))
            {
                ticket.Comentarios = dto.Comentarios;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Estado actualizado", ticket.Estado });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Elimina un ticket
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTicket(int id)
    {
        try
        {
            var ticket = await _context.Tickets.Include(t => t.Imagenes).FirstOrDefaultAsync(t => t.Id == id);
            if (ticket == null)
                return NotFound(new { message = "Ticket no encontrado" });

            if (ticket.Imagenes.Any())
                _context.TicketImagenes.RemoveRange(ticket.Imagenes);
            _context.Tickets.Remove(ticket);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Ticket eliminado" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Sube una imagen para un ticket
    /// </summary>
    [HttpPost("upload-imagen")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult> UploadImagen([FromForm] DTOs.ArchivoUploadDto dto)
    {
        var archivo = dto.Archivo;
        if (archivo == null || archivo.Length == 0)
            return BadRequest(new { message = "No se ha subido ningún archivo" });

        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "tickets");
        if (!Directory.Exists(uploadsFolder))
            Directory.CreateDirectory(uploadsFolder);

        var uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(archivo.FileName);
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await archivo.CopyToAsync(stream);
        }

        var imageUrl = $"/uploads/tickets/{uniqueFileName}";
        return Ok(new { url = imageUrl });
    }
}

public class CambiarEstadoTicketDto
{
    public string Estado { get; set; } = string.Empty;
    public string? Comentarios { get; set; }
}
