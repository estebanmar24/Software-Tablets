using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using System.Text.Json;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CalificacionController : ControllerBase
{
    private readonly AppDbContext _context;

    public CalificacionController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Obtiene el historial de calificaciones mensuales
    /// </summary>
    [HttpGet("historial")]
    public async Task<ActionResult<IEnumerable<CalificacionMensual>>> GetHistorial(int? limite = 12)
    {
        var calificaciones = await _context.CalificacionesMensuales
            .OrderByDescending(c => c.Anio)
            .ThenByDescending(c => c.Mes)
            .Take(limite ?? 12)
            .ToListAsync();

        return Ok(calificaciones);
    }

    /// <summary>
    /// Obtiene la calificación de un mes específico
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<CalificacionMensual>> GetCalificacion(int mes, int anio)
    {
        var calificacion = await _context.CalificacionesMensuales
            .FirstOrDefaultAsync(c => c.Mes == mes && c.Anio == anio);

        if (calificacion == null)
            return NotFound(new { message = "No hay calificación guardada para este período" });

        return Ok(calificacion);
    }

    /// <summary>
    /// Guarda o actualiza la calificación de un mes
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<CalificacionMensual>> GuardarCalificacion([FromBody] CalificacionMensualDto dto)
    {
        try
        {
            // Buscar si ya existe una calificación para este mes/año
            var existente = await _context.CalificacionesMensuales
                .FirstOrDefaultAsync(c => c.Mes == dto.Mes && c.Anio == dto.Anio);

            if (existente != null)
            {
                // Actualizar existente
                existente.CalificacionTotal = dto.CalificacionTotal;
                existente.FechaCalculo = DateTime.Now;
                existente.Notas = dto.Notas;
                existente.DesgloseMaquinas = dto.DesgloseMaquinas;
            }
            else
            {
                // Crear nueva
                var nueva = new CalificacionMensual
                {
                    Mes = dto.Mes,
                    Anio = dto.Anio,
                    CalificacionTotal = dto.CalificacionTotal,
                    FechaCalculo = DateTime.Now,
                    Notas = dto.Notas,
                    DesgloseMaquinas = dto.DesgloseMaquinas
                };
                _context.CalificacionesMensuales.Add(nueva);
                existente = nueva;
            }

            await _context.SaveChangesAsync();
            return Ok(existente);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Calcula y guarda automáticamente la calificación del mes actual basándose en los datos de producción
    /// </summary>
    [HttpPost("calcular-y-guardar")]
    public async Task<ActionResult<CalificacionMensual>> CalcularYGuardar(int mes, int anio)
    {
        try
        {
            // Obtener datos de producción para calcular la calificación
            var produccion = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
                .ToListAsync();

            if (!produccion.Any())
                return NotFound(new { message = "No hay datos de producción para este período" });

            var maquinas = await _context.Maquinas.ToListAsync();
            var desglose = new List<object>();
            decimal calificacionTotal = 0;

            foreach (var maquina in maquinas)
            {
                var grupoMaquina = produccion.Where(p => p.MaquinaId == maquina.Id).ToList();
                
                if (grupoMaquina.Any())
                {
                    var tirosTotales = grupoMaquina.Sum(x => x.TirosConEquivalencia);
                    var diasUnicos = grupoMaquina.Select(x => x.Fecha.Date).Distinct().Count();
                    var meta100 = diasUnicos * maquina.Meta100Porciento;
                    
                    var porcentaje100 = meta100 > 0 ? ((decimal)tirosTotales / meta100) * 100 : 0;
                    var calificacion = porcentaje100 * ((decimal)maquina.Importancia / 100);
                    
                    calificacionTotal += calificacion;
                    
                    desglose.Add(new
                    {
                        MaquinaId = maquina.Id,
                        Maquina = maquina.Nombre,
                        Importancia = maquina.Importancia,
                        PorcentajeRendimiento100 = Math.Round(porcentaje100, 2),
                        Calificacion = Math.Round(calificacion, 2)
                    });
                }
            }

            // Guardar o actualizar
            var existente = await _context.CalificacionesMensuales
                .FirstOrDefaultAsync(c => c.Mes == mes && c.Anio == anio);

            if (existente != null)
            {
                existente.CalificacionTotal = Math.Round(calificacionTotal, 2);
                existente.FechaCalculo = DateTime.Now;
                existente.DesgloseMaquinas = JsonSerializer.Serialize(desglose);
            }
            else
            {
                existente = new CalificacionMensual
                {
                    Mes = mes,
                    Anio = anio,
                    CalificacionTotal = Math.Round(calificacionTotal, 2),
                    FechaCalculo = DateTime.Now,
                    DesgloseMaquinas = JsonSerializer.Serialize(desglose)
                };
                _context.CalificacionesMensuales.Add(existente);
            }

            await _context.SaveChangesAsync();
            return Ok(existente);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, details = ex.InnerException?.Message });
        }
    }
}

public class CalificacionMensualDto
{
    public int Mes { get; set; }
    public int Anio { get; set; }
    public decimal CalificacionTotal { get; set; }
    public string? Notas { get; set; }
    public string? DesgloseMaquinas { get; set; }
}
