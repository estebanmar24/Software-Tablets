using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PlanAccionController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public PlanAccionController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PlanAccionDto>>> GetPlanes()
        {
            var planes = await _context.PlanesAccion
                .Include(p => p.Evidencias)
                .OrderByDescending(p => p.FechaCreacion)
                .ToListAsync();

            return Ok(planes.Select(MapToDto));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<PlanAccionDto>> GetPlan(int id)
        {
            var plan = await _context.PlanesAccion
                .Include(p => p.Evidencias)
                .FirstOrDefaultAsync(p => p.Id == id);
                
            if (plan == null) return NotFound();
            return Ok(MapToDto(plan));
        }

        [HttpPost]
        public async Task<ActionResult<PlanAccionDto>> CreatePlan([FromBody] CreatePlanAccionDto dto)
        {
            try
            {
                var plan = new PlanAccion
                {
                    Proceso = dto.Proceso,
                    Hallazgo = dto.Hallazgo,
                    CausaRaiz = dto.CausaRaiz,
                    AccionCorrectiva = dto.AccionCorrectiva,
                    Responsable = dto.Responsable,
                    FechaInicio = dto.FechaInicio.ToUniversalTime(),
                    FechaCompromiso = dto.FechaCompromiso.ToUniversalTime(),
                    Estado = dto.Estado,
                    PorcentajeAvance = dto.PorcentajeAvance,
                    Observaciones = dto.Observaciones,
                    FechaCreacion = DateTime.UtcNow
                };

                foreach (var ev in dto.NuevasEvidencias)
                {
                    var filePath = await SaveFile(ev.Base64Data);
                    plan.Evidencias.Add(new PlanAccionEvidencia
                    {
                        FilePath = filePath,
                        FileName = ev.FileName,
                        FileType = ev.FileType
                    });
                }

                _context.PlanesAccion.Add(plan);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetPlan), new { id = plan.Id }, MapToDto(plan));
            }
            catch (Exception ex)
            {
                await LogError("CreatePlan", ex);
                return StatusCode(500, new { message = "Error interno al guardar el plan de acción", detail = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePlan(int id, [FromBody] CreatePlanAccionDto dto)
        {
            try
            {
                var plan = await _context.PlanesAccion
                    .Include(p => p.Evidencias)
                    .FirstOrDefaultAsync(p => p.Id == id);
                    
                if (plan == null) return NotFound();

                plan.Proceso = dto.Proceso;
                plan.Hallazgo = dto.Hallazgo;
                plan.CausaRaiz = dto.CausaRaiz;
                plan.AccionCorrectiva = dto.AccionCorrectiva;
                plan.Responsable = dto.Responsable;
                plan.FechaInicio = dto.FechaInicio.ToUniversalTime();
                plan.FechaCompromiso = dto.FechaCompromiso.ToUniversalTime();
                plan.Estado = dto.Estado;
                plan.PorcentajeAvance = dto.PorcentajeAvance;
                plan.Observaciones = dto.Observaciones;

                foreach (var ev in dto.NuevasEvidencias)
                {
                    var filePath = await SaveFile(ev.Base64Data);
                    plan.Evidencias.Add(new PlanAccionEvidencia
                    {
                        FilePath = filePath,
                        FileName = ev.FileName,
                        FileType = ev.FileType
                    });
                }

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                await LogError("UpdatePlan", ex);
                return StatusCode(500, new { message = "Error interno al actualizar el plan de acción", detail = ex.Message });
            }
        }

        private async Task LogError(string operation, Exception ex)
        {
            var logPath = Path.Combine(_env.ContentRootPath, "plan_accion_error.txt");
            var message = $"\n[{DateTime.Now}] ERROR in {operation}:\n{ex.Message}\n{ex.StackTrace}";
            if (ex.InnerException != null)
            {
                message += $"\nInner Exception: {ex.InnerException.Message}\n{ex.InnerException.StackTrace}";
            }
            await System.IO.File.AppendAllTextAsync(logPath, message);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlan(int id)
        {
            var plan = await _context.PlanesAccion.FindAsync(id);
            if (plan == null) return NotFound();

            _context.PlanesAccion.Remove(plan);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<string> SaveFile(string base64Data)
        {
            var fotosDir = Path.Combine(_env.ContentRootPath, "wwwroot", "evidencias-planes");
            if (!Directory.Exists(fotosDir)) Directory.CreateDirectory(fotosDir);

            string extension = ".jpg";
            if (base64Data.Contains("application/pdf")) extension = ".pdf";
            else if (base64Data.Contains("image/png")) extension = ".png";
            else if (base64Data.Contains("image/jpeg")) extension = ".jpg";

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(fotosDir, fileName);

            if (base64Data.Contains(",")) base64Data = base64Data.Split(',')[1];
            var fileBytes = Convert.FromBase64String(base64Data);
            await System.IO.File.WriteAllBytesAsync(filePath, fileBytes);

            return $"evidencias-planes/{fileName}";
        }

        private PlanAccionDto MapToDto(PlanAccion p) => new PlanAccionDto
        {
            Id = p.Id,
            Proceso = p.Proceso,
            Hallazgo = p.Hallazgo,
            CausaRaiz = p.CausaRaiz,
            AccionCorrectiva = p.AccionCorrectiva,
            Responsable = p.Responsable,
            FechaInicio = p.FechaInicio,
            FechaCompromiso = p.FechaCompromiso,
            Estado = p.Estado,
            PorcentajeAvance = p.PorcentajeAvance,
            Evidencias = p.Evidencias.Select(e => new PlanAccionEvidenciaDto
            {
                Id = e.Id,
                FilePath = e.FilePath,
                FileName = e.FileName,
                FileType = e.FileType
            }).ToList(),
            Observaciones = p.Observaciones,
            FechaCreacion = p.FechaCreacion
        };
    }
}
