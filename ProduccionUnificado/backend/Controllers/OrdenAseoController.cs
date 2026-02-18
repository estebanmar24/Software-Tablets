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
        "PROCESO TEJEDORA",
        "PROCESO DE PRODUCCIÓN",
        "PROCESO DE ESTAMPADORA",
        "PROCESO DE BARNIZADORA"
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

            encuesta.FotoImplementosAseo = await SavePhotos(dto.FotoImplementosAseoBase64, uploadsPath, "implementos");
            encuesta.FotoHerramientasLugar = await SavePhotos(dto.FotoHerramientasLugarBase64, uploadsPath, "herramientas");
            encuesta.FotoTarrosRotulados = await SavePhotos(dto.FotoTarrosRotuladosBase64, uploadsPath, "tarros");
            encuesta.FotoAreaDespejada = await SavePhotos(dto.FotoAreaDespejadaBase64, uploadsPath, "area");
            encuesta.FotoRutasEvacuacion = await SavePhotos(dto.FotoRutasEvacuacionBase64, uploadsPath, "rutas");
            encuesta.FotoMesasTrabajo = await SavePhotos(dto.FotoMesasTrabajoBase64, uploadsPath, "mesas");

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
            if (dto.FotoImplementosAseoBase64 != null)
                encuesta.FotoImplementosAseo = await SavePhotos(dto.FotoImplementosAseoBase64, uploadsPath, "implementos");
            if (dto.FotoHerramientasLugarBase64 != null)
                encuesta.FotoHerramientasLugar = await SavePhotos(dto.FotoHerramientasLugarBase64, uploadsPath, "herramientas");
            if (dto.FotoTarrosRotuladosBase64 != null)
                encuesta.FotoTarrosRotulados = await SavePhotos(dto.FotoTarrosRotuladosBase64, uploadsPath, "tarros");
            if (dto.FotoAreaDespejadaBase64 != null)
                encuesta.FotoAreaDespejada = await SavePhotos(dto.FotoAreaDespejadaBase64, uploadsPath, "area");
            if (dto.FotoRutasEvacuacionBase64 != null)
                encuesta.FotoRutasEvacuacion = await SavePhotos(dto.FotoRutasEvacuacionBase64, uploadsPath, "rutas");
            if (dto.FotoMesasTrabajoBase64 != null)
                encuesta.FotoMesasTrabajo = await SavePhotos(dto.FotoMesasTrabajoBase64, uploadsPath, "mesas");

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
        DeletePhotoFiles(encuesta.FotoImplementosAseo);
        DeletePhotoFiles(encuesta.FotoHerramientasLugar);
        DeletePhotoFiles(encuesta.FotoTarrosRotulados);
        DeletePhotoFiles(encuesta.FotoAreaDespejada);
        DeletePhotoFiles(encuesta.FotoRutasEvacuacion);
        DeletePhotoFiles(encuesta.FotoMesasTrabajo);

        _context.EncuestasOrdenAseo.Remove(encuesta);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Encuesta eliminada" });
    }

    [HttpGet("foto/{filename}")]
    public IActionResult GetFoto(string filename)
    {
        var path = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo", filename);
        if (!System.IO.File.Exists(path)) return NotFound();
        
        // Explicitly add CORS header to allow canvas usage on frontend
        Response.Headers.Append("Access-Control-Allow-Origin", "*");
        
        return PhysicalFile(path, "image/jpeg");
    }

    private async Task<string?> SavePhotos(List<string>? base64List, string uploadsPath, string prefix)
    {
        if (base64List == null || !base64List.Any()) return null;

        var uploadedFiles = new List<string>();

        foreach (var base64 in base64List)
        {
            if (string.IsNullOrEmpty(base64)) continue;

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
                uploadedFiles.Add(filename);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrdenAseo] Error saving photo: {ex.Message}");
            }
        }
        
        return uploadedFiles.Any() ? string.Join("|", uploadedFiles) : null;
    }

    private void DeletePhotoFiles(string? filenames)
    {
        if (string.IsNullOrEmpty(filenames)) return;

        var files = filenames.Split('|');
        foreach (var filename in files)
        {
            try
            {
                var path = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "ordenaseo", filename);
                if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            }
            catch { /* Ignore deletion errors */ }
        }
    }
}
