using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Controllers;

// [Authorize]
[ApiController]
[Route("api/[controller]")]
public class OrdenAseoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public OrdenAseoController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    // Lista de procesos disponibles
    private static readonly string[] Procesos = new[]
    {
        "PROCESO DE ALMACEN",
        "PROCESO DE COLAMINADORA",
        "PROCESO DE CONVERTIDORA",
        "PROCESO DE CORRUGADORA",
        "PROCESO DE DESPACHOS",
        "PROCESO DE DESPIQUE",
        "PROCESO DE GUILLOTINA",
        "PROCESO DE IMPRESIÓN",
        "PROCESO DE LAMINADO",
        "PROCESO DE PEGADORA",
        "PROCESO DE PLANEACIÓN",
        "PROCESO DE TERMINADOS",
        "PROCESO DE TROQUELADO",
        "PROCESO TEJEDORA"
    };

    private static readonly string[] Plantas = new[] { "PLANTA 1", "PLANTA 2" };

    [HttpGet("procesos")]
    public ActionResult<string[]> GetProcesos() => Ok(Procesos);

    [HttpGet("plantas")]
    public ActionResult<string[]> GetPlantas() => Ok(Plantas);

    [HttpGet("encuestas")]
    public async Task<ActionResult<List<object>>> GetEncuestas()
    {
        var encuestas = await _context.EncuestasOrdenAseo
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new
            {
                e.Id,
                e.ProcesoAuditado,
                e.NombreAuditado,
                e.Planta,
                e.ImplementosAseo,
                e.HerramientasLugar,
                e.TarrosRotulados,
                e.AreaDespejada,
                e.RutasEvacuacion,
                e.MesasTrabajo,
                e.FechaCreacion,
                e.CreadoPor,
                // Calcular cumplimiento total
                TotalCumple = (e.ImplementosAseo ? 1 : 0) + (e.HerramientasLugar ? 1 : 0) +
                              (e.TarrosRotulados ? 1 : 0) + (e.AreaDespejada ? 1 : 0) +
                              (e.RutasEvacuacion ? 1 : 0) + (e.MesasTrabajo ? 1 : 0)
            })
            .ToListAsync();

        return Ok(encuestas);
    }

    [HttpGet("encuestas/{id}")]
    public async Task<ActionResult<EncuestaOrdenAseo>> GetEncuesta(int id)
    {
        var encuesta = await _context.EncuestasOrdenAseo.FindAsync(id);
        if (encuesta == null) return NotFound();
        return Ok(encuesta);
    }

    [HttpPost("encuestas")]
    public async Task<ActionResult> CrearEncuesta([FromBody] EncuestaOrdenAseoDto dto)
    {
        try
        {
            var encuesta = new EncuestaOrdenAseo
            {
                ProcesoAuditado = dto.ProcesoAuditado,
                NombreAuditado = dto.NombreAuditado,
                Planta = dto.Planta,
                ImplementosAseo = dto.ImplementosAseo,
                HerramientasLugar = dto.HerramientasLugar,
                TarrosRotulados = dto.TarrosRotulados,
                AreaDespejada = dto.AreaDespejada,
                RutasEvacuacion = dto.RutasEvacuacion,
                MesasTrabajo = dto.MesasTrabajo,
                Observaciones = dto.Observaciones,
                FechaCreacion = DateTime.UtcNow,
                CreadoPor = dto.CreadoPor
            };

            // Guardar fotos
            var uploadsPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo");
            if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);

            encuesta.FotoImplementosAseo = await SavePhoto(dto.FotoImplementosAseoBase64, uploadsPath, "implementos");
            encuesta.FotoHerramientasLugar = await SavePhoto(dto.FotoHerramientasLugarBase64, uploadsPath, "herramientas");
            encuesta.FotoTarrosRotulados = await SavePhoto(dto.FotoTarrosRotuladosBase64, uploadsPath, "tarros");
            encuesta.FotoAreaDespejada = await SavePhoto(dto.FotoAreaDespejadaBase64, uploadsPath, "area");
            encuesta.FotoRutasEvacuacion = await SavePhoto(dto.FotoRutasEvacuacionBase64, uploadsPath, "rutas");
            encuesta.FotoMesasTrabajo = await SavePhoto(dto.FotoMesasTrabajoBase64, uploadsPath, "mesas");

            _context.EncuestasOrdenAseo.Add(encuesta);
            await _context.SaveChangesAsync();

            return Ok(new { id = encuesta.Id, message = "Encuesta guardada exitosamente" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OrdenAseo] Error: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("encuestas/{id}")]
    public async Task<ActionResult> ActualizarEncuesta(int id, [FromBody] EncuestaOrdenAseoDto dto)
    {
        var encuesta = await _context.EncuestasOrdenAseo.FindAsync(id);
        if (encuesta == null) return NotFound();

        try
        {
            encuesta.ProcesoAuditado = dto.ProcesoAuditado;
            encuesta.NombreAuditado = dto.NombreAuditado;
            encuesta.Planta = dto.Planta;
            encuesta.ImplementosAseo = dto.ImplementosAseo;
            encuesta.HerramientasLugar = dto.HerramientasLugar;
            encuesta.TarrosRotulados = dto.TarrosRotulados;
            encuesta.AreaDespejada = dto.AreaDespejada;
            encuesta.RutasEvacuacion = dto.RutasEvacuacion;
            encuesta.MesasTrabajo = dto.MesasTrabajo;
            encuesta.Observaciones = dto.Observaciones;

            var uploadsPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo");
            if (!Directory.Exists(uploadsPath)) Directory.CreateDirectory(uploadsPath);

            // Update photos only if new ones are provided
            if (!string.IsNullOrEmpty(dto.FotoImplementosAseoBase64))
                encuesta.FotoImplementosAseo = await SavePhoto(dto.FotoImplementosAseoBase64, uploadsPath, "implementos");
            if (!string.IsNullOrEmpty(dto.FotoHerramientasLugarBase64))
                encuesta.FotoHerramientasLugar = await SavePhoto(dto.FotoHerramientasLugarBase64, uploadsPath, "herramientas");
            if (!string.IsNullOrEmpty(dto.FotoTarrosRotuladosBase64))
                encuesta.FotoTarrosRotulados = await SavePhoto(dto.FotoTarrosRotuladosBase64, uploadsPath, "tarros");
            if (!string.IsNullOrEmpty(dto.FotoAreaDespejadaBase64))
                encuesta.FotoAreaDespejada = await SavePhoto(dto.FotoAreaDespejadaBase64, uploadsPath, "area");
            if (!string.IsNullOrEmpty(dto.FotoRutasEvacuacionBase64))
                encuesta.FotoRutasEvacuacion = await SavePhoto(dto.FotoRutasEvacuacionBase64, uploadsPath, "rutas");
            if (!string.IsNullOrEmpty(dto.FotoMesasTrabajoBase64))
                encuesta.FotoMesasTrabajo = await SavePhoto(dto.FotoMesasTrabajoBase64, uploadsPath, "mesas");

            await _context.SaveChangesAsync();
            return Ok(new { message = "Encuesta actualizada" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("encuestas/{id}")]
    public async Task<ActionResult> EliminarEncuesta(int id)
    {
        var encuesta = await _context.EncuestasOrdenAseo.FindAsync(id);
        if (encuesta == null) return NotFound();

        // Delete associated photos
        DeletePhotoFile(encuesta.FotoImplementosAseo);
        DeletePhotoFile(encuesta.FotoHerramientasLugar);
        DeletePhotoFile(encuesta.FotoTarrosRotulados);
        DeletePhotoFile(encuesta.FotoAreaDespejada);
        DeletePhotoFile(encuesta.FotoRutasEvacuacion);
        DeletePhotoFile(encuesta.FotoMesasTrabajo);

        _context.EncuestasOrdenAseo.Remove(encuesta);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Encuesta eliminada" });
    }

    [HttpGet("foto/{filename}")]
    public IActionResult GetFoto(string filename)
    {
        var path = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo", filename);
        if (!System.IO.File.Exists(path)) return NotFound();
        return PhysicalFile(path, "image/jpeg");
    }

    private async Task<string?> SavePhoto(string? base64, string uploadsPath, string prefix)
    {
        if (string.IsNullOrEmpty(base64)) return null;

        try
        {
            // Remove data URI prefix if present
            var base64Data = base64;
            if (base64.Contains(","))
                base64Data = base64.Split(',')[1];

            var bytes = Convert.FromBase64String(base64Data);
            var filename = $"{prefix}_{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}.jpg";
            var filepath = Path.Combine(uploadsPath, filename);

            await System.IO.File.WriteAllBytesAsync(filepath, bytes);
            return filename;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OrdenAseo] Error saving photo: {ex.Message}");
            return null;
        }
    }

    private void DeletePhotoFile(string? filename)
    {
        if (string.IsNullOrEmpty(filename)) return;
        try
        {
            var path = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo", filename);
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        }
        catch { /* Ignore deletion errors */ }
    }
}
