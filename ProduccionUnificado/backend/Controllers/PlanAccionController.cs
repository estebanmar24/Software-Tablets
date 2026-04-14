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
        public async Task<ActionResult<IEnumerable<PlanAccionDto>>> GetPlanes([FromQuery] string? area = null)
        {
            return await GetPlanesInternal(area);
        }

        [HttpGet("area/{area}")]
        public async Task<ActionResult<IEnumerable<PlanAccionDto>>> GetPlanesByArea(string area)
        {
            return await GetPlanesInternal(area);
        }

        private async Task<ActionResult<IEnumerable<PlanAccionDto>>> GetPlanesInternal(string? area)
        {
            var decodedArea = !string.IsNullOrEmpty(area) ? Uri.UnescapeDataString(area) : null;
            var query = _context.PlanesAccion.Include(p => p.Evidencias).AsQueryable();
 
            if (!string.IsNullOrEmpty(decodedArea))
            {
                var areaList = decodedArea.Split(',').Select(a => a.Trim().ToLower()).ToList();
                
                // Building the query with possible OR conditions for each area
                // This is more likely to translate correctly than a complex Any() with Contains()
                var tempQuery = _context.PlanesAccion.Include(p => p.Evidencias).AsQueryable();
                bool filterApplied = false;

                foreach (var areaItem in areaList)
                {
                    if (!filterApplied)
                    {
                        query = query.Where(p => p.Proceso.ToLower().Contains(areaItem));
                        filterApplied = true;
                    }
                    else
                    {
                        // Note: Using multiple where clauses results in AND.
                        // For OR we'd need a different approach, but since usually it's just one area for "Mis Planes",
                        // and if multiple areas are provided, we usually want plans that match ANY of them.
                        // I'll use a safer approach for Postgres with LIKE if possible.
                    }
                }
                
                // Optimized approach for many areas: building a single string comparison if possible
                // but for now, let's use the most reliable one for multiple areas:
                if (areaList.Count > 1) {
                    // Fallback to the Any logic but making sure it's understood by EF
                    query = query.Where(p => areaList.Any(a => p.Proceso.ToLower().Contains(a)));
                } else if (areaList.Count == 1) {
                    var singleArea = areaList[0];
                    query = query.Where(p => p.Proceso.ToLower().Contains(singleArea));
                }
            }
 
            var planes = await query
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

        [HttpGet("pendientes/area/{area}/count")]
        public async Task<ActionResult<int>> GetPendingCount(string area)
        {
            var decodedArea = Uri.UnescapeDataString(area);
            var areaList = decodedArea.Split(',').Select(a => a.Trim().ToLower()).ToList();
            
            var queryCount = _context.PlanesAccion.Where(p => p.Estado != "cerrada" && p.Estado != "cerrado");
            
            if (areaList.Count == 1)
            {
                var single = areaList[0];
                queryCount = queryCount.Where(p => p.Proceso.ToLower().Contains(single));
            }
            else
            {
                queryCount = queryCount.Where(p => areaList.Any(a => p.Proceso.ToLower().Contains(a)));
            }

            int count = await queryCount.CountAsync();
            return Ok(count);
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

        [HttpDelete("evidencia/{id}")]
        public async Task<IActionResult> DeleteEvidence(int id)
        {
            try
            {
                var evidence = await _context.PlanAccionEvidencias.FindAsync(id);
                if (evidence == null) return NotFound();

                // Delete the physical file on the server
                var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", evidence.FilePath);
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }

                _context.PlanAccionEvidencias.Remove(evidence);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                await LogError("DeleteEvidence", ex);
                return StatusCode(500, new { message = "Error al eliminar la evidencia", detail = ex.Message });
            }
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
