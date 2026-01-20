using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RendimientoOperarioController : ControllerBase
{
    private readonly AppDbContext _context;

    public RendimientoOperarioController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Obtiene el historial de rendimiento de un operario
    /// </summary>
    [HttpGet("historial/{usuarioId}")]
    public async Task<ActionResult<IEnumerable<RendimientoOperarioMensual>>> GetHistorial(int usuarioId, int? limit = 12)
    {
        var historial = await _context.RendimientoOperariosMensual
            .Where(r => r.UsuarioId == usuarioId)
            .OrderByDescending(r => r.Anio)
            .ThenByDescending(r => r.Mes)
            .Take(limit ?? 12)
            .ToListAsync();

        return Ok(historial);
    }

    /// <summary>
    /// Calcula y guarda el rendimiento de un operario para un mes específico
    /// </summary>
    [HttpPost("calcular-y-guardar")]
    public async Task<ActionResult<RendimientoOperarioMensual>> CalcularYGuardar(int usuarioId, int mes, int anio)
    {
        try
        {
            // Obtener producción del operario para el mes
            var produccion = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .Where(p => p.UsuarioId == usuarioId && 
                           p.Fecha.Month == mes && 
                           p.Fecha.Year == anio)
                .ToListAsync();

            if (!produccion.Any())
                return NotFound(new { message = "No hay datos de producción para este operario en este período" });

            // Agrupar por máquina y calcular rendimiento por máquina
            var rendimientosPorMaquina = produccion
                .GroupBy(p => p.MaquinaId)
                .Select(g => {
                    var maquina = g.First().Maquina;
                    var tirosTotales = g.Sum(x => x.TirosDiarios);
                    var meta100 = maquina?.Meta100Porciento ?? maquina?.MetaRendimiento ?? 1;
                    var diasTrabajados = g.Select(x => x.Fecha.Date).Distinct().Count();
                    var metaTotal = meta100 * diasTrabajados;
                    var porcentaje = metaTotal > 0 ? (decimal)tirosTotales / metaTotal * 100 : 0;
                    return new { tiros = tirosTotales, porcentaje };
                })
                .ToList();

            var totalTiros = rendimientosPorMaquina.Sum(r => r.tiros);
            var totalMaquinas = rendimientosPorMaquina.Count;
            var rendimientoPromedio = totalMaquinas > 0 
                ? rendimientosPorMaquina.Average(r => r.porcentaje) 
                : 0;

            // Buscar registro existente o crear nuevo
            var existente = await _context.RendimientoOperariosMensual
                .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Mes == mes && r.Anio == anio);

            if (existente != null)
            {
                existente.RendimientoPromedio = rendimientoPromedio;
                existente.TotalTiros = totalTiros;
                existente.TotalMaquinas = totalMaquinas;
                existente.FechaCalculo = DateTime.Now;
            }
            else
            {
                existente = new RendimientoOperarioMensual
                {
                    UsuarioId = usuarioId,
                    Mes = mes,
                    Anio = anio,
                    RendimientoPromedio = rendimientoPromedio,
                    TotalTiros = totalTiros,
                    TotalMaquinas = totalMaquinas,
                    FechaCalculo = DateTime.Now
                };
                _context.RendimientoOperariosMensual.Add(existente);
            }

            await _context.SaveChangesAsync();

            return Ok(existente);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al calcular rendimiento", error = ex.Message });
        }
    }

    /// <summary>
    /// Guarda directamente el rendimiento de un operario (valor ya calculado desde el frontend)
    /// </summary>
    [HttpPost("guardar-directo")]
    public async Task<ActionResult<RendimientoOperarioMensual>> GuardarDirecto(int usuarioId, int mes, int anio, decimal rendimiento, int totalTiros, int totalMaquinas)
    {
        try
        {
            // Buscar registro existente o crear nuevo
            var existente = await _context.RendimientoOperariosMensual
                .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Mes == mes && r.Anio == anio);

            if (existente != null)
            {
                existente.RendimientoPromedio = rendimiento;
                existente.TotalTiros = totalTiros;
                existente.TotalMaquinas = totalMaquinas;
                existente.FechaCalculo = DateTime.Now;
            }
            else
            {
                existente = new RendimientoOperarioMensual
                {
                    UsuarioId = usuarioId,
                    Mes = mes,
                    Anio = anio,
                    RendimientoPromedio = rendimiento,
                    TotalTiros = totalTiros,
                    TotalMaquinas = totalMaquinas,
                    FechaCalculo = DateTime.Now
                };
                _context.RendimientoOperariosMensual.Add(existente);
            }

            await _context.SaveChangesAsync();
            return Ok(existente);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al guardar rendimiento", error = ex.Message });
        }
    }

    /// <summary>
    /// Calcula y guarda el rendimiento de TODOS los operarios para un mes
    /// </summary>
    [HttpPost("calcular-todos")]
    public async Task<ActionResult> CalcularTodos(int mes, int anio)
    {
        try
        {
            // Obtener todos los operarios que tienen producción en el mes
            var operariosConProduccion = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
                .Select(p => p.UsuarioId)
                .Distinct()
                .ToListAsync();

            var resultados = new List<object>();
            foreach (var usuarioId in operariosConProduccion)
            {
                var result = await CalcularYGuardar(usuarioId, mes, anio);
                resultados.Add(new { usuarioId, success = true });
            }

            return Ok(new { 
                message = $"Procesados {resultados.Count} operarios", 
                resultados 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al calcular rendimiento", error = ex.Message });
        }
    }
}
