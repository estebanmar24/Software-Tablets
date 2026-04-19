using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Services;
using TiempoProcesos.API.DTOs;
using System.Threading.Tasks;
using System;
using System.Linq;
using Microsoft.Extensions.DependencyInjection;
using System.IO;
using Microsoft.AspNetCore.Hosting;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlanAccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AlephEmailService _emailService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IWebHostEnvironment _env;

    public PlanAccionController(AppDbContext context, AlephEmailService emailService, IServiceScopeFactory scopeFactory, IWebHostEnvironment env)
    {
        _context = context;
        _emailService = emailService;
        _scopeFactory = scopeFactory;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetPlanes()
    {
        var planes = await _context.PlanesAccion
            .Include(p => p.Evidencias)
            .OrderByDescending(p => p.Id)
            .ToListAsync();

        var result = planes.Select(p => new
        {
            p.Id,
            p.Proceso,
            p.Hallazgo,
            p.CausaRaiz,
            p.AccionCorrectiva,
            p.Responsable,
            p.FechaInicio,
            p.FechaCompromiso,
            p.Estado,
            p.TipoTrabajo,
            p.PorcentajeAvance,
            p.Observaciones,
            p.FechaCreacion,
            Evidencias = p.Evidencias.Select(e => new { e.Id, e.FileName, e.FilePath, e.FileType }),
            DiasRestantes = (p.FechaCompromiso - DateTime.Today).Days,
            Semaforo = GetSemaforo(p)
        });

        return Ok(result);
    }

    [HttpGet("area/{area}")]
    public async Task<IActionResult> GetByArea(string area)
    {
        var planes = await _context.PlanesAccion
            .Include(p => p.Evidencias)
            .Where(p => p.Proceso != null && p.Proceso.Contains(area))
            .OrderByDescending(p => p.Id)
            .ToListAsync();

        var result = planes.Select(p => new
        {
            p.Id,
            p.Proceso,
            p.Hallazgo,
            p.CausaRaiz,
            p.AccionCorrectiva,
            p.Responsable,
            p.FechaInicio,
            p.FechaCompromiso,
            p.Estado,
            p.TipoTrabajo,
            p.PorcentajeAvance,
            p.Observaciones,
            p.FechaCreacion,
            Evidencias = p.Evidencias.Select(e => new { e.Id, e.FileName, e.FilePath, e.FileType }),
            DiasRestantes = (p.FechaCompromiso - DateTime.Today).Days,
            Semaforo = GetSemaforo(p)
        });

        return Ok(result);
    }

    [HttpGet("pendientes/area/{area}/count")]
    public async Task<IActionResult> GetPendientesCount(string area)
    {
        // Contamos solo los que NO están cerrados
        var count = await _context.PlanesAccion
            .Where(p => p.Proceso != null && p.Proceso.Contains(area) && p.Estado.ToLower() != "cerrada")
            .CountAsync();
        return Ok(count);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreatePlanAccionDto dto)
    {
        var plan = new PlanAccion
        {
            Proceso = dto.Proceso,
            Hallazgo = dto.Hallazgo,
            CausaRaiz = dto.CausaRaiz,
            AccionCorrectiva = dto.AccionCorrectiva,
            Responsable = dto.Responsable,
            FechaInicio = dto.FechaInicio,
            FechaCompromiso = dto.FechaCompromiso,
            Estado = dto.Estado,
            PorcentajeAvance = dto.PorcentajeAvance,
            Observaciones = dto.Observaciones,
            FechaCreacion = DateTime.UtcNow
        };

        _context.PlanesAccion.Add(plan);
        await _context.SaveChangesAsync();

        if (dto.NuevasEvidencias != null && dto.NuevasEvidencias.Count > 0)
        {
            var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "plan_accion", plan.Id.ToString());
            if (!Directory.Exists(folder))
            {
                Directory.CreateDirectory(folder);
            }

            foreach (var ev in dto.NuevasEvidencias)
            {
                try
                {
                    string base64 = ev.Base64Data.Contains(',') ? ev.Base64Data.Split(',')[1] : ev.Base64Data;
                    byte[] bytes = Convert.FromBase64String(base64);
                    
                    // Simple sanification of filename
                    string safeName = Path.GetFileName(ev.FileName).Replace(" ", "_");
                    string uniqueName = $"{DateTime.UtcNow.Ticks}_{safeName}";
                    string filePath = Path.Combine(folder, uniqueName);
                    
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                    var evidencia = new PlanAccionEvidencia
                    {
                        PlanAccionId = plan.Id,
                        FileName = ev.FileName,
                        FilePath = $"uploads/plan_accion/{plan.Id}/{uniqueName}",
                        FileType = ev.FileType
                    };
                    _context.PlanAccionEvidencias.Add(evidencia);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error saving file: {ex.Message}");
                }
            }
            await _context.SaveChangesAsync();
        }

        // Enviar notificación asíncrona usando IServiceScopeFactory para no bloquear el UI
        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var emailSvc = scope.ServiceProvider.GetRequiredService<AlephEmailService>();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            // Si el proceso tiene múltiples áreas separadas por coma, notificamos a cada una
            var areas = plan.Proceso.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var area in areas)
            {
                await emailSvc.SendAreaNotificationAsync(db, area, plan.Hallazgo, plan.AccionCorrectiva, plan.Responsable, plan.FechaCompromiso.ToShortDateString(), plan.Proceso);
            }
        });

        return CreatedAtAction(nameof(GetPlanes), new { id = plan.Id }, plan);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, CreatePlanAccionDto dto)
    {
        var plan = await _context.PlanesAccion.FindAsync(id);
        if (plan == null) return NotFound();

        plan.Proceso = dto.Proceso;
        plan.Hallazgo = dto.Hallazgo;
        plan.CausaRaiz = dto.CausaRaiz;
        plan.AccionCorrectiva = dto.AccionCorrectiva;
        plan.Responsable = dto.Responsable;
        plan.FechaInicio = dto.FechaInicio;
        plan.FechaCompromiso = dto.FechaCompromiso;
        plan.Estado = dto.Estado;
        plan.PorcentajeAvance = dto.PorcentajeAvance;
        plan.Observaciones = dto.Observaciones;

        if (dto.NuevasEvidencias != null && dto.NuevasEvidencias.Count > 0)
        {
            var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "plan_accion", plan.Id.ToString());
            if (!Directory.Exists(folder))
            {
                Directory.CreateDirectory(folder);
            }

            foreach (var ev in dto.NuevasEvidencias)
            {
                try
                {
                    string base64 = ev.Base64Data.Contains(',') ? ev.Base64Data.Split(',')[1] : ev.Base64Data;
                    byte[] bytes = Convert.FromBase64String(base64);
                    
                    string safeName = Path.GetFileName(ev.FileName).Replace(" ", "_");
                    string uniqueName = $"{DateTime.UtcNow.Ticks}_{safeName}";
                    string filePath = Path.Combine(folder, uniqueName);
                    
                    await System.IO.File.WriteAllBytesAsync(filePath, bytes);

                    var evidencia = new PlanAccionEvidencia
                    {
                        PlanAccionId = plan.Id,
                        FileName = ev.FileName,
                        FilePath = $"uploads/plan_accion/{plan.Id}/{uniqueName}",
                        FileType = ev.FileType
                    };
                    _context.PlanAccionEvidencias.Add(evidencia);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error saving file on update: {ex.Message}");
                }
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var plan = await _context.PlanesAccion.Include(p => p.Evidencias).FirstOrDefaultAsync(p => p.Id == id);
        if (plan == null) return NotFound();

        // Delete files
        foreach(var ev in plan.Evidencias) 
        {
            var path = Path.Combine(_env.WebRootPath ?? "wwwroot", ev.FilePath);
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        }

        // Delete parent folder if empty
        var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "plan_accion", plan.Id.ToString());
        if (Directory.Exists(folder)) Directory.Delete(folder, true);

        _context.PlanesAccion.Remove(plan);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("evidencia/{id}")]
    public async Task<IActionResult> DeleteEvidencia(int id)
    {
        var evidencia = await _context.PlanAccionEvidencias.FindAsync(id);
        if (evidencia == null) return NotFound();

        var path = Path.Combine(_env.WebRootPath ?? "wwwroot", evidencia.FilePath);
        if (System.IO.File.Exists(path)) 
        {
            System.IO.File.Delete(path);
        }

        _context.PlanAccionEvidencias.Remove(evidencia);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private string GetSemaforo(PlanAccion p)
    {
        if (p.Estado.ToLower() == "cerrada") return "Gris";
        var dias = (p.FechaCompromiso - DateTime.Today).Days;
        if (dias < 0) return "Rojo";
        if (dias <= 3) return "Amarillo";
        return "Verde";
    }
}
