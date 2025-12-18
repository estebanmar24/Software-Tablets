using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProduccionController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProduccionController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> RegistrarDia([FromBody] ProduccionDiaria registro)
    {
        if (registro == null) return BadRequest();

        try
        {
            // Recalcular Totales para asegurar consistencia
            registro.TotalHorasAuxiliares = registro.HorasMantenimiento + registro.HorasDescanso + registro.HorasOtrosAux;
            registro.TotalTiemposMuertos = registro.TiempoFaltaTrabajo + registro.TiempoReparacion + registro.TiempoOtroMuerto;
            registro.TotalHoras = registro.TotalHorasProductivas + registro.TotalHorasAuxiliares + registro.TotalTiemposMuertos;

            // Verificar si ya existe registro para ese día, operario y máquina
            var existente = await _context.ProduccionDiaria
                .FirstOrDefaultAsync(p => p.Fecha.Date == registro.Fecha.Date && p.UsuarioId == registro.UsuarioId && p.MaquinaId == registro.MaquinaId);

            if (existente != null)
            {
                // Actualizar campos
                existente.HoraInicio = registro.HoraInicio;
                existente.HoraFin = registro.HoraFin;
                existente.HorasOperativas = registro.HorasOperativas;
                existente.RendimientoFinal = registro.RendimientoFinal;
                existente.Cambios = registro.Cambios;
                existente.TiempoPuestaPunto = registro.TiempoPuestaPunto;
                existente.TirosDiarios = registro.TirosDiarios;
                existente.TotalHorasProductivas = registro.TotalHorasProductivas;
                existente.PromedioHoraProductiva = registro.PromedioHoraProductiva;
                existente.ValorTiroSnapshot = registro.ValorTiroSnapshot;
                existente.ValorAPagar = registro.ValorAPagar;
                existente.HorasMantenimiento = registro.HorasMantenimiento;
                existente.HorasDescanso = registro.HorasDescanso;
                existente.HorasOtrosAux = registro.HorasOtrosAux;
                existente.TotalHorasAuxiliares = registro.TotalHorasAuxiliares;
                existente.TiempoFaltaTrabajo = registro.TiempoFaltaTrabajo;
                existente.TiempoReparacion = registro.TiempoReparacion;
                existente.TiempoOtroMuerto = registro.TiempoOtroMuerto;
                existente.TotalTiemposMuertos = registro.TotalTiemposMuertos;
                existente.TotalHoras = registro.TotalHoras;
                existente.ReferenciaOP = registro.ReferenciaOP;
                existente.Novedades = registro.Novedades;
                existente.Desperdicio = registro.Desperdicio;
                existente.DiaLaborado = registro.DiaLaborado;
            }
            else
            {
                _context.ProduccionDiaria.Add(registro);
            }

            await _context.SaveChangesAsync();
            return Ok(existente ?? registro);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("detalles")]
    public async Task<ActionResult<IEnumerable<ProduccionDiaria>>> GetDetalles(int mes, int anio, int maquinaId, int usuarioId)
    {
        var data = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();

        return Ok(data);
    }

    [HttpGet("operarios-con-datos")]
    public async Task<ActionResult> GetOperariosConDatos(int mes, int anio)
    {
        try
        {
            var operariosConDatos = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
                .Include(p => p.Usuario)
                .Include(p => p.Maquina)
                .GroupBy(p => new { p.UsuarioId, UsuarioNombre = p.Usuario!.Nombre, p.MaquinaId, MaquinaNombre = p.Maquina!.Nombre })
                .Select(g => new {
                    UsuarioId = g.Key.UsuarioId,
                    UsuarioNombre = g.Key.UsuarioNombre,
                    MaquinaId = g.Key.MaquinaId,
                    MaquinaNombre = g.Key.MaquinaNombre,
                    DiasRegistrados = g.Count()
                })
                .ToListAsync();
            return Ok(operariosConDatos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Query Failed", details = ex.Message });
        }
    }

    [HttpDelete("borrar")]
    public async Task<IActionResult> BorrarDatos([FromQuery] int mes, [FromQuery] int anio, [FromQuery] int? usuarioId, [FromQuery] int? maquinaId)
    {
        try
        {
            var query = _context.ProduccionDiaria.AsQueryable();
            query = query.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

            if (usuarioId.HasValue)
                query = query.Where(p => p.UsuarioId == usuarioId.Value);

            if (maquinaId.HasValue)
                query = query.Where(p => p.MaquinaId == maquinaId.Value);

            var recordsToDelete = await query.ToListAsync();
            if (!recordsToDelete.Any())
                return NotFound(new { message = "No se encontraron registros para eliminar con los filtros proporcionados." });

            _context.ProduccionDiaria.RemoveRange(recordsToDelete);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Se eliminaron {recordsToDelete.Count} registros correctamente." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult> GetMaquinasConDatos(int mes, int anio)
    {
        var maquinasConDatos = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Include(p => p.Maquina)
            .GroupBy(p => new { p.MaquinaId, MaquinaNombre = p.Maquina!.Nombre })
            .Select(g => new {
                MaquinaId = g.Key.MaquinaId,
                MaquinaNombre = g.Key.MaquinaNombre,
                DiasRegistrados = g.Count(),
                OperariosDistintos = g.Select(x => x.UsuarioId).Distinct().Count()
            })
            .ToListAsync();

        return Ok(maquinasConDatos);
    }

    [HttpGet("detalles-maquina")]
    public async Task<ActionResult<IEnumerable<ProduccionDiaria>>> GetDetallesPorMaquina(int mes, int anio, int maquinaId)
    {
        var data = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
            .OrderBy(p => p.Fecha)
            .ThenBy(p => p.UsuarioId)
            .ToListAsync();

        return Ok(data);
    }

    [HttpGet("periodos-disponibles")]
    public async Task<ActionResult> GetPeriodosDisponibles()
    {
        var periodos = await _context.ProduccionDiaria
            .GroupBy(p => new { Mes = p.Fecha.Month, Anio = p.Fecha.Year })
            .Select(g => new {
                Mes = g.Key.Mes,
                Anio = g.Key.Anio,
                TotalRegistros = g.Count()
            })
            .OrderByDescending(p => p.Anio)
            .ThenByDescending(p => p.Mes)
            .ToListAsync();

        return Ok(periodos);
    }

    [HttpGet("historial")]
    public async Task<ActionResult<IEnumerable<ProduccionDiaria>>> GetHistorial(DateTime? fechaInicio, DateTime? fechaFin, int? usuarioId, int? maquinaId)
    {
        var query = _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .AsQueryable();

        if (fechaInicio.HasValue)
            query = query.Where(p => p.Fecha >= fechaInicio.Value.Date);

        if (fechaFin.HasValue)
            query = query.Where(p => p.Fecha <= fechaFin.Value.Date);

        if (usuarioId.HasValue && usuarioId.Value > 0)
            query = query.Where(p => p.UsuarioId == usuarioId.Value);

        if (maquinaId.HasValue && maquinaId.Value > 0)
            query = query.Where(p => p.MaquinaId == maquinaId.Value);

        var result = await query
            .OrderByDescending(p => p.Fecha)
            .ThenBy(p => p.Usuario!.Nombre)
            .ToListAsync();

        return Ok(result);
    }

    [HttpGet("resumen")]
    public async Task<ActionResult<ResumenMensualDto>> GetResumen(int mes, int anio, int? diaInicio = null, int? diaFin = null)
    {
        var query = _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (diaInicio.HasValue)
            query = query.Where(p => p.Fecha.Day >= diaInicio.Value);
        
        if (diaFin.HasValue)
            query = query.Where(p => p.Fecha.Day <= diaFin.Value);

        List<ProduccionDiaria> data;
        try
        {
            data = await query.ToListAsync();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Database Query Failed", details = ex.Message });
        }

        var resultado = new ResumenMensualDto();

        // 1. Resumen por Operario-Maquina
        var gruposOperario = data.GroupBy(d => new { d.UsuarioId, d.Usuario?.Nombre, d.MaquinaId, MaquinaNombre = d.Maquina?.Nombre });

        foreach (var grupo in gruposOperario)
        {
            var maqu = await _context.Maquinas.FindAsync(grupo.Key.MaquinaId);
            
            // Lógica de Promedio ignorando ceros
            var horasProdNoCero = grupo.Where(x => x.PromedioHoraProductiva > 0).Select(x => x.PromedioHoraProductiva);
            var promedio = horasProdNoCero.Any() ? horasProdNoCero.Average() : 0;
            
            var totalTiros = grupo.Sum(x => x.TirosConEquivalencia);
            var diasTrabajados = grupo.Sum(x => x.DiaLaborado);
            var diasNaturales = grupo.Count();
            
            if (diasTrabajados == 0) diasTrabajados = diasNaturales;

            decimal metaEsperada = 0;
            decimal eficiencia = 0;
            string color = "Gris";
            decimal metaBonif = 0;

            if (maqu != null && diasTrabajados > 0)
            {
                metaEsperada = diasTrabajados * maqu.MetaRendimiento;
                metaBonif = metaEsperada; 
                eficiencia = metaEsperada > 0 ? (totalTiros / metaEsperada) : 0;

                if (eficiencia >= 1.0m) color = "Verde";
                else color = "Rojo";
            }

            resultado.ResumenOperarios.Add(new ResumenOperarioDto
            {
                UsuarioId = grupo.Key.UsuarioId,
                MaquinaId = grupo.Key.MaquinaId,
                Operario = grupo.Key.Nombre ?? "Desc",
                Maquina = grupo.Key.MaquinaNombre ?? "Desc",
                TotalTiros = totalTiros,
                TotalHorasProductivas = grupo.Sum(x => x.TotalHorasProductivas),
                ValorAPagar = eficiencia >= 1.0m ? grupo.Sum(x => x.ValorAPagar) : 0,
                PromedioHoraProductiva = promedio,
                TotalHoras = grupo.Sum(x => x.TotalHoras),
                SemaforoColor = color,
                DiasLaborados = diasTrabajados,
                MetaBonificacion = metaBonif,
                Eficiencia = eficiencia
            });
        }

        // 2. Resumen por Máquina
        var todasLasMaquinas = await _context.Maquinas.OrderBy(m => m.Nombre).ToListAsync();
        
        foreach (var maquina in todasLasMaquinas)
        {
            var grupo = data.Where(d => d.MaquinaId == maquina.Id).ToList();

            if (grupo.Any())
            {
                var tirosTotales = grupo.Sum(x => x.TirosConEquivalencia);
                var diasUnicos = grupo.Select(x => x.Fecha.Date).Distinct().Count();
                var metaEsperada = diasUnicos * maquina.MetaRendimiento;
                var porcentaje = metaEsperada > 0 ? ((decimal)tirosTotales / metaEsperada) : 0;

                string color = "Rojo";
                if (porcentaje >= 0.75m) color = "Verde";

                resultado.ResumenMaquinas.Add(new ResumenMaquinaDto
                {
                    MaquinaId = maquina.Id,
                    Maquina = maquina.Nombre,
                    TirosTotales = tirosTotales,
                    RendimientoEsperado = metaEsperada,
                    PorcentajeRendimiento = porcentaje,
                    SemaforoColor = color,
                    TotalTiemposMuertos = grupo.Sum(x => x.TotalTiemposMuertos),
                    TotalTiempoReparacion = grupo.Sum(x => x.TiempoReparacion),
                    TotalTiempoFaltaTrabajo = grupo.Sum(x => x.TiempoFaltaTrabajo),
                    TotalTiempoOtro = grupo.Sum(x => x.TiempoOtroMuerto)
                });
            }
            else
            {
                resultado.ResumenMaquinas.Add(new ResumenMaquinaDto
                {
                    MaquinaId = maquina.Id,
                    Maquina = maquina.Nombre,
                    TirosTotales = 0,
                    RendimientoEsperado = 0,
                    PorcentajeRendimiento = 0,
                    SemaforoColor = "Rojo",
                    TotalTiemposMuertos = 0,
                    TotalTiempoReparacion = 0,
                    TotalTiempoFaltaTrabajo = 0,
                    TotalTiempoOtro = 0
                });
            }
        }

        // Ordenar por Rendimiento
        resultado.ResumenMaquinas = resultado.ResumenMaquinas
            .OrderByDescending(x => x.PorcentajeRendimiento)
            .ThenBy(x => {
                var match = System.Text.RegularExpressions.Regex.Match(x.Maquina, @"^\d+");
                return match.Success ? int.Parse(match.Value) : 9999;
            })
            .ThenBy(x => x.Maquina)
            .ToList();

        // 3. Tendencia Diaria
        var gruposFecha = data.GroupBy(d => d.Fecha.Date);
        foreach (var g in gruposFecha.OrderBy(x => x.Key))
        {
            resultado.TendenciaDiaria.Add(new ResumenDiarioDto
            {
                Fecha = g.Key,
                Tiros = g.Sum(x => x.TirosConEquivalencia),
                Desperdicio = g.Sum(x => x.Desperdicio)
            });
        }

        return Ok(resultado);
    }
}
