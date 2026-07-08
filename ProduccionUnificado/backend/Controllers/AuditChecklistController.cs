using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Checklist de auditorías (CT-PAT e ILS). Cada item se asigna a uno o
/// más responsables (usuarios del sistema) y se notifica vía email al
/// crearse. Los responsables marcan completada o no completada, dejando
/// registrada la fecha-hora de cierre.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuditChecklistController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AlephEmailService _email;

    public AuditChecklistController(AppDbContext context, AlephEmailService email)
    {
        _context = context;
        _email = email;
    }

    private const string TIPO_CTPAT = "CTPAT";
    private const string TIPO_ILS = "ILS";

    private static string NormalizarTipo(string? tipo)
    {
        var t = (tipo ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(t)) return TIPO_CTPAT;
        if (t.Equals(TIPO_ILS, StringComparison.OrdinalIgnoreCase)) return TIPO_ILS;
        if (t.Equals(TIPO_CTPAT, StringComparison.OrdinalIgnoreCase)) return TIPO_CTPAT;
        // Tipos personalizados: C{id}
        if (System.Text.RegularExpressions.Regex.IsMatch(t, @"^C\d+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            return t.ToUpperInvariant();
        return t.Length > 50 ? t[..50] : t;
    }

    public class TipoWriteDTO
    {
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int? Anio { get; set; }
        public string? CreadoPorNombre { get; set; }
    }

    public class ResponsableDTO
    {
        public int? UsuarioId { get; set; }
        public string? UsuarioNombre { get; set; }
        public string? UsuarioEmail { get; set; }
    }

    public class ChecklistWriteDTO
    {
        public string Tipo { get; set; } = TIPO_CTPAT;
        public int? NumeroActividad { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int? Anio { get; set; }
        public int? Mes { get; set; }
        public int? CreadoPorId { get; set; }
        public string? CreadoPorNombre { get; set; }
        /// <summary>Usuarios responsables. Pueden ser usuarios existentes (UsuarioId)
        /// o solo nombre/email manuales (sin UsuarioId).</summary>
        public List<ResponsableDTO> Responsables { get; set; } = new();
        /// <summary>Si es true, se envía correo a los responsables nuevos.</summary>
        public bool NotificarPorCorreo { get; set; } = true;
    }

    public class EstadoUpdateDTO
    {
        /// <summary>'pendiente' | 'completada' | 'no_completada'</summary>
        public string Estado { get; set; } = "pendiente";
        public string? RazonNoCompletada { get; set; }
        public string? CerradaPorNombre { get; set; }
    }

    public class UsuarioListadoDTO
    {
        public int Id { get; set; }
        public string NombreMostrar { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string? Area { get; set; }
    }

    public class ResumenChecklistDTO
    {
        public string Tipo { get; set; } = TIPO_CTPAT;
        public int Total { get; set; }
        public int Completadas { get; set; }
        public int NoCompletadas { get; set; }
        public int Pendientes { get; set; }
        public double PorcentajeCumplimiento { get; set; }
        public List<Audit_Checklist> Items { get; set; } = new();
    }

    /// <summary>Listado de usuarios para asignar como responsables.</summary>
    [HttpGet("usuarios")]
    public async Task<ActionResult<IEnumerable<UsuarioListadoDTO>>> GetUsuarios()
    {
        var users = await _context.AdminUsuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.NombreMostrar)
            .Select(u => new UsuarioListadoDTO
            {
                Id = u.Id,
                NombreMostrar = u.NombreMostrar ?? u.Username,
                Email = u.Email ?? string.Empty,
                Username = u.Username,
                Area = u.Area,
            })
            .ToListAsync();
        return Ok(users);
    }

    /// <summary>GET api/AuditChecklist/tipos?anio=2026 — pestañas de auditoría personalizadas.</summary>
    [HttpGet("tipos")]
    public async Task<ActionResult<IEnumerable<Audit_ChecklistTipo>>> GetTipos([FromQuery] int? anio)
    {
        var query = _context.Audit_Checklist_Tipos.AsQueryable();
        if (anio.HasValue) query = query.Where(t => t.Anio == anio.Value);
        var data = await query
            .OrderBy(t => t.Nombre)
            .ThenBy(t => t.Id)
            .AsNoTracking()
            .ToListAsync();
        return Ok(data);
    }

    /// <summary>POST api/AuditChecklist/tipos — crea una nueva pestaña de auditoría.</summary>
    [HttpPost("tipos")]
    public async Task<ActionResult<Audit_ChecklistTipo>> CrearTipo([FromBody] TipoWriteDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre))
            return BadRequest(new { error = "Nombre requerido" });

        var hoy = DateTime.UtcNow;
        var anio = dto.Anio ?? hoy.Year;
        var nombre = dto.Nombre.Trim();

        var duplicado = await _context.Audit_Checklist_Tipos
            .AnyAsync(t => t.Anio == anio && t.Nombre.ToLower() == nombre.ToLower());
        if (duplicado)
            return BadRequest(new { error = "Ya existe una auditoría con ese nombre en el año seleccionado." });

        var item = new Audit_ChecklistTipo
        {
            Codigo = string.Empty,
            Nombre = nombre,
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            Anio = anio,
            CreadoPorNombre = dto.CreadoPorNombre,
            FechaCreacion = hoy,
        };
        _context.Audit_Checklist_Tipos.Add(item);
        await _context.SaveChangesAsync();

        item.Codigo = $"C{item.Id}";
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTipos), new { anio = item.Anio }, item);
    }

    /// <summary>
    /// GET api/AuditChecklist?tipo=CTPAT&amp;anio=2026
    /// El filtro por mes es opcional. Por defecto el checklist de auditoría
    /// es ANUAL (general), así que si no se pasa <c>mes</c> se devuelven todos
    /// los meses del año.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Audit_Checklist>>> GetItems(
        [FromQuery] string? tipo, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var tipoNorm = NormalizarTipo(tipo);
        var query = _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .AsQueryable()
            .Where(c => c.Tipo == tipoNorm);

        if (anio.HasValue) query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue) query = query.Where(c => c.Mes == mes.Value);

        var data = await query
            .OrderBy(c => c.NumeroActividad ?? int.MaxValue)
            .ThenBy(c => c.Titulo)
            .ThenByDescending(c => c.FechaCreacion)
            .ToListAsync();
        return Ok(data);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Audit_Checklist>> GetItem(int id)
    {
        var item = await _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Audit_Checklist>> Crear([FromBody] ChecklistWriteDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Titulo))
            return BadRequest(new { error = "Título requerido" });

        var hoy = DateTime.UtcNow;
        var tipo = NormalizarTipo(dto.Tipo);

        // Resolvemos responsables consultando AdminUsuarios cuando se mandan IDs,
        // para tener nombre/email actualizados; si llegan sin Id se aceptan literales.
        var responsablesIds = (dto.Responsables ?? new List<ResponsableDTO>())
            .Where(r => r.UsuarioId.HasValue)
            .Select(r => r.UsuarioId!.Value)
            .Distinct()
            .ToList();

        var usuariosBd = responsablesIds.Count == 0
            ? new List<AdminUsuario>()
            : await _context.AdminUsuarios
                .Where(u => responsablesIds.Contains(u.Id))
                .ToListAsync();

        var item = new Audit_Checklist
        {
            Tipo = tipo,
            NumeroActividad = dto.NumeroActividad,
            Titulo = dto.Titulo.Trim(),
            Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim(),
            Estado = "pendiente",
            Anio = dto.Anio ?? hoy.Year,
            Mes = dto.Mes ?? hoy.Month,
            CreadoPorId = dto.CreadoPorId,
            CreadoPorNombre = dto.CreadoPorNombre,
            FechaCreacion = hoy,
        };

        foreach (var r in dto.Responsables ?? new List<ResponsableDTO>())
        {
            string? nombre = r.UsuarioNombre;
            string? email = r.UsuarioEmail;
            if (r.UsuarioId.HasValue)
            {
                var u = usuariosBd.FirstOrDefault(x => x.Id == r.UsuarioId.Value);
                if (u != null)
                {
                    nombre = u.NombreMostrar ?? u.Username;
                    email = u.Email;
                }
            }
            item.Responsables.Add(new Audit_ChecklistResponsable
            {
                UsuarioId = r.UsuarioId,
                UsuarioNombre = nombre,
                UsuarioEmail = email,
            });
        }

        _context.Audit_Checklist_Items.Add(item);
        await _context.SaveChangesAsync();

        // Enviar correos en background (no esperamos para no bloquear la respuesta).
        if (dto.NotificarPorCorreo)
        {
            _ = NotificarResponsablesAsync(item, dto.CreadoPorNombre ?? "Administrador");
        }

        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, item);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Audit_Checklist>> Editar(int id, [FromBody] ChecklistWriteDTO dto)
    {
        var item = await _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (item == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.Titulo)) item.Titulo = dto.Titulo.Trim();
        item.NumeroActividad = dto.NumeroActividad;
        item.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        if (dto.Anio.HasValue) item.Anio = dto.Anio.Value;
        if (dto.Mes.HasValue) item.Mes = dto.Mes.Value;
        if (!string.IsNullOrWhiteSpace(dto.Tipo)) item.Tipo = NormalizarTipo(dto.Tipo);
        item.FechaModificacion = DateTime.UtcNow;

        // Sincronizamos responsables: identificamos cuáles son nuevos para
        // poder notificarlos sólo a ellos (no a los que ya estaban).
        var nuevosIds = (dto.Responsables ?? new List<ResponsableDTO>())
            .Where(r => r.UsuarioId.HasValue)
            .Select(r => r.UsuarioId!.Value)
            .Distinct()
            .ToList();
        var usuariosBd = nuevosIds.Count == 0
            ? new List<AdminUsuario>()
            : await _context.AdminUsuarios.Where(u => nuevosIds.Contains(u.Id)).ToListAsync();

        var responsablesPrevIds = item.Responsables
            .Where(r => r.UsuarioId.HasValue)
            .Select(r => r.UsuarioId!.Value)
            .ToHashSet();

        var responsablesAEliminar = item.Responsables.ToList();
        _context.Set<Audit_ChecklistResponsable>().RemoveRange(responsablesAEliminar);
        item.Responsables.Clear();

        var nuevosCreados = new List<Audit_ChecklistResponsable>();
        foreach (var r in dto.Responsables ?? new List<ResponsableDTO>())
        {
            string? nombre = r.UsuarioNombre;
            string? email = r.UsuarioEmail;
            if (r.UsuarioId.HasValue)
            {
                var u = usuariosBd.FirstOrDefault(x => x.Id == r.UsuarioId.Value);
                if (u != null)
                {
                    nombre = u.NombreMostrar ?? u.Username;
                    email = u.Email;
                }
            }
            var resp = new Audit_ChecklistResponsable
            {
                ChecklistId = item.Id,
                UsuarioId = r.UsuarioId,
                UsuarioNombre = nombre,
                UsuarioEmail = email,
            };
            item.Responsables.Add(resp);
            if (!r.UsuarioId.HasValue || !responsablesPrevIds.Contains(r.UsuarioId.Value))
            {
                nuevosCreados.Add(resp);
            }
        }

        await _context.SaveChangesAsync();

        if (dto.NotificarPorCorreo && nuevosCreados.Any())
        {
            _ = NotificarResponsablesAsync(item, dto.CreadoPorNombre ?? "Administrador", nuevosCreados);
        }

        return Ok(item);
    }

    [HttpPut("{id}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] EstadoUpdateDTO dto)
    {
        var item = await _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (item == null) return NotFound();

        var estado = (dto.Estado ?? "pendiente").Trim().ToLowerInvariant();
        if (estado != "completada" && estado != "no_completada" && estado != "pendiente")
            return BadRequest(new { error = "Estado inválido. Debe ser 'completada', 'no_completada' o 'pendiente'." });

        if (estado == "no_completada" && string.IsNullOrWhiteSpace(dto.RazonNoCompletada))
            return BadRequest(new { error = "Debe indicar la razón por la que no se completó la actividad." });

        item.Estado = estado;
        item.RazonNoCompletada = estado == "no_completada" ? dto.RazonNoCompletada?.Trim() : null;

        if (estado == "completada" || estado == "no_completada")
        {
            item.FechaCierre = DateTime.UtcNow;
            item.CerradaPorNombre = dto.CerradaPorNombre?.Trim();
        }
        else
        {
            item.FechaCierre = null;
            item.CerradaPorNombre = null;
        }

        item.FechaModificacion = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var item = await _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (item == null) return NotFound();
        _context.Set<Audit_ChecklistResponsable>().RemoveRange(item.Responsables);
        _context.Audit_Checklist_Items.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Resumen del checklist. Si no se pasa <c>mes</c>, se calcula sobre TODO
    /// el año (checklist general anual de auditoría).
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult<ResumenChecklistDTO>> GetResumen(
        [FromQuery] string? tipo, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var tipoNorm = NormalizarTipo(tipo);
        var hoy = DateTime.UtcNow;
        var a = anio ?? hoy.Year;

        var query = _context.Audit_Checklist_Items
            .Include(c => c.Responsables)
            .Where(c => c.Tipo == tipoNorm && c.Anio == a);
        if (mes.HasValue) query = query.Where(c => c.Mes == mes.Value);

        var items = await query
            .OrderBy(c => c.NumeroActividad ?? int.MaxValue)
            .ThenBy(c => c.Titulo)
            .ThenByDescending(c => c.FechaCreacion)
            .AsNoTracking()
            .ToListAsync();

        var total = items.Count;
        var completadas = items.Count(x => x.Estado == "completada");
        var noCompletadas = items.Count(x => x.Estado == "no_completada");
        var pendientes = items.Count(x => x.Estado == "pendiente");
        var pct = total == 0 ? 0.0 : Math.Round((completadas * 100.0) / total, 2);

        return Ok(new ResumenChecklistDTO
        {
            Tipo = tipoNorm,
            Total = total,
            Completadas = completadas,
            NoCompletadas = noCompletadas,
            Pendientes = pendientes,
            PorcentajeCumplimiento = pct,
            Items = items,
        });
    }

    private async Task NotificarResponsablesAsync(Audit_Checklist item, string asignadoPor, List<Audit_ChecklistResponsable>? subset = null)
    {
        try
        {
            var lista = subset ?? item.Responsables.ToList();
            foreach (var r in lista)
            {
                if (string.IsNullOrWhiteSpace(r.UsuarioEmail)) continue;
                await _email.NotifyAuditAssignmentAsync(
                    r.UsuarioEmail!,
                    r.UsuarioNombre ?? string.Empty,
                    item.Tipo,
                    item.Titulo,
                    item.Descripcion ?? string.Empty,
                    asignadoPor,
                    item.Anio,
                    item.Mes
                );
                r.NotificadoEn = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AuditChecklist] Error notificando responsables: {ex.Message}");
        }
    }
}
