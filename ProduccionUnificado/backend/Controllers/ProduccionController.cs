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

    [HttpPost("mensual")]
    public async Task<IActionResult> GuardarMensual([FromBody] List<ProduccionDiaria> registros)
    {
        if (registros == null || !registros.Any()) 
            return BadRequest(new { message = "No hay datos para guardar" });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Tomamos referencia del primer registro para saber Mes, Año y Máquina
            var first = registros.First();
            var mes = first.Fecha.Month;
            var anio = first.Fecha.Year;
            var maquinaId = first.MaquinaId;

            // 1. Eliminar TODOS los registros DE ESA MÁQUINA en ESE MES
            //    Esto asegura que si el usuario borró un día en el grid, se borre de la BD.
            var existentes = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
                .ToListAsync();

            if (existentes.Any())
            {
                _context.ProduccionDiaria.RemoveRange(existentes);
                await _context.SaveChangesAsync();
            }

            // 2. Insertar los nuevos registros
            foreach (var reg in registros)
            {
                // Calcular totales auxiliares por si acaso
                reg.TotalHorasAuxiliares = reg.HorasMantenimiento + reg.HorasDescanso + reg.HorasOtrosAux;
                reg.TotalTiemposMuertos = reg.TiempoFaltaTrabajo + reg.TiempoReparacion + reg.TiempoOtroMuerto;
                reg.TotalHoras = reg.TotalHorasProductivas + reg.TotalHorasAuxiliares + reg.TotalTiemposMuertos;
                
                // Asegurar ID es 0 para que sea insert
                reg.Id = 0; 
                _context.ProduccionDiaria.Add(reg);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { message = $"Se guardaron {registros.Count} registros correctamente." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { error = ex.Message, inner = ex.InnerException?.Message });
        }
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
                // Campos bonificables
                existente.TirosBonificables = registro.TirosBonificables;
                existente.DesperdicioBonificable = registro.DesperdicioBonificable;
                existente.ValorAPagarBonificable = registro.ValorAPagarBonificable;
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
            // Obtener datos y agrupar en memoria para contar días distintos
            var datos = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
                .Include(p => p.Usuario)
                .Include(p => p.Maquina)
                .Select(p => new { 
                    p.UsuarioId, 
                    UsuarioNombre = p.Usuario!.Nombre, 
                    p.MaquinaId, 
                    MaquinaNombre = p.Maquina!.Nombre,
                    Fecha = p.Fecha.Date
                })
                .ToListAsync();
            
            var operariosConDatos = datos
                .GroupBy(p => new { p.UsuarioId, p.UsuarioNombre, p.MaquinaId, p.MaquinaNombre })
                .Select(g => new {
                    UsuarioId = g.Key.UsuarioId,
                    UsuarioNombre = g.Key.UsuarioNombre,
                    MaquinaId = g.Key.MaquinaId,
                    MaquinaNombre = g.Key.MaquinaNombre,
                    // Contar días distintos, no registros
                    DiasRegistrados = g.Select(x => x.Fecha).Distinct().Count()
                })
                .ToList();
                
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
            // 1. ProduccionDiaria
            var query = _context.ProduccionDiaria.AsQueryable();
            query = query.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

            if (usuarioId.HasValue) query = query.Where(p => p.UsuarioId == usuarioId.Value);
            if (maquinaId.HasValue) query = query.Where(p => p.MaquinaId == maquinaId.Value);

            var recordsToDelete = await query.ToListAsync();

            // 2. TiempoProcesos (Historial Detallado)
            var queryTP = _context.TiemposProceso.AsQueryable();
            queryTP = queryTP.Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio);

            if (usuarioId.HasValue) queryTP = queryTP.Where(t => t.UsuarioId == usuarioId.Value);
            if (maquinaId.HasValue) queryTP = queryTP.Where(t => t.MaquinaId == maquinaId.Value);

            var recordsTPToDelete = await queryTP.ToListAsync();

            if (!recordsToDelete.Any() && !recordsTPToDelete.Any())
                return NotFound(new { message = "No se encontraron registros para eliminar con los filtros proporcionados." });

            if (recordsToDelete.Any()) _context.ProduccionDiaria.RemoveRange(recordsToDelete);
            if (recordsTPToDelete.Any()) _context.TiemposProceso.RemoveRange(recordsTPToDelete);

            await _context.SaveChangesAsync();

            return Ok(new { message = $"Se eliminaron {recordsToDelete.Count} registros diarios y {recordsTPToDelete.Count} detalles de historial." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("borrar-huerfanos")]
    public async Task<IActionResult> BorrarHuerfanos([FromQuery] int mes, [FromQuery] int anio, [FromQuery] string usuarioNombre, [FromQuery] string maquinaNombre)
    {
        try
        {
            var query = _context.TiemposProceso
                .Include(t => t.Usuario)
                .Include(t => t.Maquina)
                .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio);

            if (!string.IsNullOrEmpty(usuarioNombre))
                query = query.Where(t => t.Usuario!.Nombre.Contains(usuarioNombre));
            
            if (!string.IsNullOrEmpty(maquinaNombre))
                query = query.Where(t => t.Maquina!.Nombre.Contains(maquinaNombre));

            var records = await query.ToListAsync();

            if (!records.Any()) return NotFound(new { message = "No se encontraron registros huérfanos." });

            _context.TiemposProceso.RemoveRange(records);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Eliminados {records.Count} registros huérfanos del Historial." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult> GetMaquinasConDatos(int mes, int anio)
    {
        // Obtener datos y agrupar en memoria para contar días distintos (solo máquinas activas)
        var datos = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Include(p => p.Maquina)
            .Where(p => p.Maquina != null && p.Maquina.Activo) // Exclude inactive machines
            .Select(p => new { 
                p.MaquinaId, 
                MaquinaNombre = p.Maquina!.Nombre,
                Fecha = p.Fecha.Date,
                p.UsuarioId
            })
            .ToListAsync();
        
        var maquinasConDatos = datos
            .GroupBy(p => new { p.MaquinaId, p.MaquinaNombre })
            .Select(g => new {
                MaquinaId = g.Key.MaquinaId,
                MaquinaNombre = g.Key.MaquinaNombre,
                // Contar días distintos, no registros
                DiasRegistrados = g.Select(x => x.Fecha).Distinct().Count(),
                OperariosDistintos = g.Select(x => x.UsuarioId).Distinct().Count()
            })
            .ToList();

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
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Where(p => p.Maquina != null && p.Maquina.Activo); // Exclude inactive machines

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
            
            // Calculate total values
            var totalTiros = grupo.Sum(x => x.TirosConEquivalencia);
            var totalHorasProd = grupo.Sum(x => x.TotalHorasProductivas);
            var totalHorasOp = grupo.Sum(x => x.HorasOperativas);
            
            // Calculate Promedio/H correctly: Tiros / Horas (using best available hours)
            decimal horasParaPromedio = totalHorasProd > 0 ? totalHorasProd : totalHorasOp;
            decimal promedio = horasParaPromedio > 0 ? (totalTiros / horasParaPromedio) : 0;
            
            // Contar días ÚNICOS del operario (si tiene 2 registros el mismo día, cuenta como 1)
            var diasTrabajados = grupo.Select(x => x.Fecha.Date).Distinct().Count();
            var diasNaturales = diasTrabajados;

            decimal metaEsperada = 0;
            decimal eficiencia = 0;
            string color = "Gris";
            string color100 = "Gris";
            decimal metaBonif = 0;
            decimal meta100 = 0;
            decimal porcentaje75 = 0;
            decimal porcentaje100 = 0;

            if (maqu != null && diasTrabajados > 0)
            {
                metaEsperada = diasTrabajados * maqu.MetaRendimiento;
                metaBonif = metaEsperada; // Meta 75%
                meta100 = diasTrabajados * maqu.Meta100Porciento; // Meta 100%
                eficiencia = meta100 > 0 ? (totalTiros / meta100) : 0;
                
                // Calcular porcentajes
                porcentaje75 = metaBonif > 0 ? (totalTiros / metaBonif) * 100 : 0;
                porcentaje100 = meta100 > 0 ? (totalTiros / meta100) * 100 : 0;

                // Semáforo 75% (Rojo si < 100% de la metaBonif, Verde si >= 100% de la metaBonif)
                // Nota: metaBonif ya es el 75% de la meta total. Eficiencia es sobre metaBonif.
                if (eficiencia >= 1.0m) color = "Verde";
                else color = "Rojo";
                
                // Semáforo 100% (Rojo 0-74%, Amarillo 75-99%, Verde >= 100%)
                if (porcentaje100 >= 100) color100 = "Verde";
                else if (porcentaje100 >= 75) color100 = "Amarillo";
                else color100 = "Rojo";
            }

            // Calcular TirosBonificables (solo días laborales, excluye domingos y festivos)
            var tirosBonif = grupo.Sum(x => x.TirosBonificables);
            
            // FALLBACK: Si TirosBonificables es 0 (datos antiguos sin este campo), usar totalTiros
            if (tirosBonif == 0 && totalTiros > 0) {
                tirosBonif = (int)totalTiros;
            }
            
            // Calcular Bonificación Diaria Real (Sumando día a día, no globalmente)
            decimal bonificacionReal = 0;
            decimal valorPorTiro = maqu?.ValorPorTiro ?? 0;
            
            foreach(var dia in grupo)
            {
                // La bonificación se paga si supera la meta diaria
                var metaDiaria = maqu?.MetaRendimiento ?? 0;
                var tirosBonificablesDia = dia.TirosBonificables; // Este campo ya debe estar correcto en BD
                
                // Fallback para datos viejos
                if (tirosBonificablesDia == 0 && dia.TirosConEquivalencia > 0)
                     tirosBonificablesDia = dia.TirosConEquivalencia;

                var bonoDia = Math.Max(0, tirosBonificablesDia - metaDiaria);
                bonificacionReal += (bonoDia * valorPorTiro);
            }

            // Usar el ValorAPagar que viene de la base de datos (calculado por el frontend)
            // Esto asegura consistencia total entre lo que ve el admin al guardar y el reporte
            decimal valorAPagarReal = grupo.Sum(x => x.ValorAPagar);
            
            // Si por alguna razón es 0 (datos viejos), usar cálculo aproximado
            if (valorAPagarReal == 0 && totalTiros > 0)
            {
                // Fallback a lógica anterior pero diaria
                valorAPagarReal = grupo.Sum(d => Math.Max(0, d.TirosConEquivalencia - (maqu?.MetaRendimiento ?? 0)) * valorPorTiro);
            }

            resultado.ResumenOperarios.Add(new ResumenOperarioDto
            {
                UsuarioId = grupo.Key.UsuarioId,
                MaquinaId = grupo.Key.MaquinaId,
                Operario = grupo.Key.Nombre ?? "Desc",
                Maquina = grupo.Key.MaquinaNombre ?? "Desc",
                TotalTiros = totalTiros,
                TotalHorasProductivas = totalHorasProd > 0 ? totalHorasProd : totalHorasOp,
                ValorAPagar = valorAPagarReal,
                TirosBonificables = grupo.Sum(x => x.TirosBonificables),
                ValorAPagarBonificable = bonificacionReal,
                PromedioHoraProductiva = promedio,
                TotalHoras = grupo.Sum(x => x.TotalHoras),
                SemaforoColor = color,
                SemaforoColor100 = color100,
                PorcentajeRendimiento75 = porcentaje75,
                PorcentajeRendimiento100 = porcentaje100,
                DiasLaborados = diasTrabajados,
                MetaBonificacion = metaBonif,
                Meta100Porciento = meta100,
                Eficiencia = eficiencia
            });
        }

        // 2. Resumen por Máquina (solo activas)
        var todasLasMaquinas = await _context.Maquinas
            .Where(m => m.Activo)
            .OrderBy(m => m.Nombre)
            .ToListAsync();
        
        foreach (var maquina in todasLasMaquinas)
        {
            var grupo = data.Where(d => d.MaquinaId == maquina.Id).ToList();

            if (grupo.Any())
            {
                var tirosTotales = grupo.Sum(x => x.TirosConEquivalencia);
                var diasUnicos = grupo.Select(x => x.Fecha.Date).Distinct().Count();
                var metaEsperada = diasUnicos * maquina.MetaRendimiento;
                var meta100 = diasUnicos * maquina.Meta100Porciento;
                var porcentaje = metaEsperada > 0 ? ((decimal)tirosTotales / metaEsperada) : 0;
                
                // Calcular Sem 100% (porcentaje vs meta 100%)
                var porcentaje100 = meta100 > 0 ? ((decimal)tirosTotales / meta100) * 100 : 0;
                
                // Calificación = Sem100% × (Importancia / 100)
                var calificacion = porcentaje100 * ((decimal)maquina.Importancia / 100);

                string color = "Rojo";
                if (porcentaje >= 0.75m) color = "Verde";

                resultado.ResumenMaquinas.Add(new ResumenMaquinaDto
                {
                    MaquinaId = maquina.Id,
                    Maquina = maquina.Nombre,
                    TirosTotales = tirosTotales,
                    RendimientoEsperado = metaEsperada,
                    Meta75Porciento = metaEsperada,
                    Meta100Porciento = meta100,
                    PorcentajeRendimiento = porcentaje,
                    SemaforoColor = color,
                    TotalTiemposMuertos = grupo.Sum(x => x.TotalTiemposMuertos),
                    TotalTiempoReparacion = grupo.Sum(x => x.TiempoReparacion),
                    TotalTiempoFaltaTrabajo = grupo.Sum(x => x.TiempoFaltaTrabajo),
                    TotalTiempoOtro = grupo.Sum(x => x.TiempoOtroMuerto),
                    // Nuevos campos para calificación
                    Importancia = maquina.Importancia,
                    PorcentajeRendimiento100 = porcentaje100,
                    Calificacion = calificacion
                });
            }
            else
            {
                // Aunque no haya datos, mostramos las metas configuradas de la máquina
                resultado.ResumenMaquinas.Add(new ResumenMaquinaDto
                {
                    MaquinaId = maquina.Id,
                    Maquina = maquina.Nombre,
                    TirosTotales = 0,
                    RendimientoEsperado = 0,
                    Meta75Porciento = maquina.MetaRendimiento, // Meta 75% de la máquina
                    Meta100Porciento = maquina.Meta100Porciento, // Meta 100% de la máquina
                    PorcentajeRendimiento = 0,
                    SemaforoColor = "Rojo",
                    TotalTiemposMuertos = 0,
                    TotalTiempoReparacion = 0,
                    TotalTiempoFaltaTrabajo = 0,
                    TotalTiempoOtro = 0,
                    // Máquina sin datos = 0 puntos, pero mantener importancia
                    Importancia = maquina.Importancia,
                    PorcentajeRendimiento100 = 0,
                    Calificacion = 0
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
        
        // Calcular Calificación Total de la Planta (suma de todas las calificaciones)
        resultado.CalificacionTotalPlanta = resultado.ResumenMaquinas.Sum(m => m.Calificacion);

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
