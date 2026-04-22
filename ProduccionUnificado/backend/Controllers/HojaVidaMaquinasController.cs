using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class HojaVidaMaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public HojaVidaMaquinasController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<HojaVidaMaquina>>> GetHojasVida()
        {
            try
            {
                var list = await _context.HojasVidaMaquinas
                    .Where(h => h.Activo)
                    .Include(h => h.Fotos)
                    .OrderBy(h => h.Nombre)
                    .ToListAsync();
                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "DB Error on GET", message = ex.Message, inner = ex.InnerException?.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<HojaVidaMaquina>> GetHojaVida(int id)
        {
            var hoja = await _context.HojasVidaMaquinas
                .Include(h => h.Mantenimientos)
                .Include(h => h.Fotos)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (hoja == null) return NotFound();

            return hoja;
        }

        [HttpPost]
        public async Task<ActionResult<HojaVidaMaquina>> PostHojaVida(HojaVidaMaquina hoja)
        {
            try
            {
                // Limpiar Ids de navegación para evitar conflictos en creación
                if (hoja.Fotos != null)
                {
                    foreach (var foto in hoja.Fotos)
                    {
                        foto.Id = 0;
                        foto.HojaVidaId = 0;
                        foto.HojaVida = null;
                    }
                }

                if (hoja.Mantenimientos != null)
                {
                    foreach (var mant in hoja.Mantenimientos)
                    {
                        mant.Id = 0;
                        mant.HojaVidaId = 0;
                        mant.HojaVida = null;
                    }
                }

                _context.HojasVidaMaquinas.Add(hoja);
                await _context.SaveChangesAsync();

                return CreatedAtAction("GetHojaVida", new { id = hoja.Id }, hoja);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message, inner = ex.InnerException?.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutHojaVida(int id, HojaVidaMaquina hoja)
        {
            if (id != hoja.Id) return BadRequest();

            var existente = await _context.HojasVidaMaquinas
                .Include(h => h.Fotos)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (existente == null) return NotFound();

            // Actualizar campos
            _context.Entry(existente).CurrentValues.SetValues(hoja);

            // Sincronizar Fotos
            // 1. Eliminar fotos actuales
            if (existente.Fotos.Any())
            {
                _context.HojaVidaFotos.RemoveRange(existente.Fotos);
            }

            // 2. Agregar nuevas
            if (hoja.Fotos != null)
            {
                foreach (var f in hoja.Fotos)
                {
                    existente.Fotos.Add(new HojaVidaFoto
                    {
                        Url = f.Url,
                        FechaRegistro = DateTime.UtcNow
                    });
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.HojasVidaMaquinas.Any(e => e.Id == id)) return NotFound();
                throw;
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteHojaVida(int id)
        {
            var hoja = await _context.HojasVidaMaquinas.FindAsync(id);
            if (hoja == null) return NotFound();

            hoja.Activo = false; // Soft delete
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // --- ENDPOINTS MANTENIMIENTO ---

        [HttpPost("{id}/mantenimiento")]
        public async Task<ActionResult<MantenimientoHojaVida>> PostMantenimiento(int id, MantenimientoHojaVida mant)
        {
            mant.HojaVidaId = id;
            _context.MantenimientosHojaVida.Add(mant);
            await _context.SaveChangesAsync();

            return Ok(mant);
        }


        // --- UPLOAD FOTOS ---

        [HttpPost("upload-foto")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult> UploadFoto([FromForm] MaquinaFotoUploadDto dto)
        {
            var archivo = dto.Archivo;
            if (archivo == null || archivo.Length == 0)
                return BadRequest(new { message = "No se ha subido ningún archivo" });

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "maquinas");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var extension = Path.GetExtension(archivo.FileName);
            if (string.IsNullOrEmpty(extension)) extension = ".jpg";
            var uniqueFileName = Guid.NewGuid().ToString() + extension;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await archivo.CopyToAsync(stream);
            }

            var photoUrl = $"/uploads/maquinas/{uniqueFileName}";
            return Ok(new { url = photoUrl });
        }

        [AllowAnonymous]
        [HttpGet("foto/{filename}")]
        public IActionResult GetFoto(string filename)
        {
            if (string.IsNullOrEmpty(filename)) return NotFound();

            var actualFilename = Path.GetFileName(filename);
            var baseDirectory = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "maquinas");
            var filePath = Path.Combine(baseDirectory, actualFilename);

            if (!System.IO.File.Exists(filePath)) return NotFound();

            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            var contentType = extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                _ => "application/octet-stream"
            };

            var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return new FileStreamResult(fileStream, contentType);
        }
    }

    public class MaquinaFotoUploadDto
    {
        public IFormFile Archivo { get; set; } = null!;
    }
}
