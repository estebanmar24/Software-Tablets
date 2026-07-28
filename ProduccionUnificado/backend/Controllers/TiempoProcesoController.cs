using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class TiempoProcesoController : ControllerBase
{
    private readonly ITiempoProcesoService _service;

    public TiempoProcesoController(ITiempoProcesoService service)
    {
        _service = service;
    }

    /// <summary>
    /// Obtiene la lista de actividades disponibles
    /// </summary>
    [HttpGet("actividades")]
    public async Task<ActionResult<List<ActividadDto>>> GetActividades()
    {
        var actividades = await _service.GetActividadesAsync();
        return Ok(actividades);
    }

    /// <summary>
    /// Obtiene la lista de usuarios/operarios activos
    /// </summary>
    [HttpGet("usuarios")]
    public async Task<ActionResult<List<UsuarioDto>>> GetUsuarios()
    {
        var usuarios = await _service.GetUsuariosAsync();
        return Ok(usuarios);
    }

    /// <summary>
    /// Obtiene la lista de máquinas activas
    /// </summary>
    [HttpGet("maquinas")]
    public async Task<ActionResult<List<MaquinaDto>>> GetMaquinas()
    {
        var maquinas = await _service.GetMaquinasAsync();
        return Ok(maquinas);
    }

    /// <summary>
    /// Obtiene la lista de órdenes de producción activas
    /// </summary>
    [HttpGet("ordenes")]
    public async Task<ActionResult<List<OrdenProduccionDto>>> GetOrdenes()
    {
        var ordenes = await _service.GetOrdenesProduccionAsync();
        return Ok(ordenes);
    }

    /// <summary>
    /// Obtiene la lista de horarios/turnos disponibles
    /// </summary>
    [HttpGet("horarios")]
    public async Task<ActionResult<List<HorarioDto>>> GetHorarios()
    {
        var horarios = await _service.GetHorariosAsync();
        return Ok(horarios);
    }

    /// <summary>
    /// Obtiene la producción y historial del día
    /// </summary>
    [HttpGet("produccion-dia")]
    public async Task<ActionResult<ProduccionDiaDto>> GetProduccionDia(
        [FromQuery] DateTime? fecha,
        [FromQuery] int? maquinaId,
        [FromQuery] int? usuarioId)
    {
        try
        {
            var fechaConsulta = fecha ?? DateTime.Today;
            var produccion = await _service.GetProduccionDiaAsync(fechaConsulta, maquinaId, usuarioId);
            return Ok(produccion);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Error obteniendo produccion: {ex.Message} {ex.InnerException?.Message}" });
        }
    }

    /// <summary>
    /// Registra un nuevo tiempo de proceso/actividad
    /// </summary>
    [HttpPost("registrar")]
    public async Task<ActionResult<TiempoProcesoDto>> RegistrarTiempo([FromBody] RegistrarTiempoRequest request)
    {
        try
        {
            var resultado = await _service.RegistrarTiempoAsync(request);
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            var errorMessage = ex.Message;
            if (ex.InnerException != null)
            {
                errorMessage += " | Inner: " + ex.InnerException.Message;
            }
            return BadRequest(new { error = errorMessage });
        }
    }

    /// <summary>
    /// Finaliza un tiempo de proceso existente
    /// </summary>
    [HttpPut("finalizar/{id}")]
    public async Task<ActionResult<TiempoProcesoDto>> FinalizarTiempo(long id, [FromBody] RegistrarTiempoRequest request)
    {
        try
        {
            var resultado = await _service.FinalizarTiempoAsync(id, request);
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el historial detallado de tiempos
    /// </summary>
    [HttpGet("historial")]
    public async Task<ActionResult<List<TiempoProcesoDto>>> GetHistorial(
        [FromQuery] DateTime fechaInicio,
        [FromQuery] DateTime fechaFin,
        [FromQuery] int? maquinaId,
        [FromQuery] int? usuarioId)
    {
        try
        {
            var historial = await _service.GetHistorialDetalladoAsync(fechaInicio, fechaFin, maquinaId, usuarioId);
            return Ok(historial);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Marca un proceso "EnProgreso" como Pausado (guarda el momento de la pausa).
    /// </summary>
    [HttpPut("pausar/{id}")]
    public async Task<ActionResult<TiempoProcesoDto>> Pausar(long id)
    {
        try
        {
            var dto = await _service.PausarTiempoAsync(id);
            if (dto == null) return NotFound(new { error = $"Registro {id} no encontrado" });
            return Ok(dto);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Reanuda un proceso Pausado y acumula el tiempo en pausa.
    /// </summary>
    [HttpPut("reanudar/{id}")]
    public async Task<ActionResult<TiempoProcesoDto>> Reanudar(long id)
    {
        try
        {
            var dto = await _service.ReanudarTiempoAsync(id);
            if (dto == null) return NotFound(new { error = $"Registro {id} no encontrado" });
            return Ok(dto);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza tiros/desperdicio de un registro en curso (tablet → planeador en vivo).
    /// </summary>
    [HttpPut("progreso/{id}")]
    public async Task<ActionResult<TiempoProcesoDto>> ActualizarProgreso(long id, [FromBody] ActualizarProgresoRequest request)
    {
        try
        {
            var dto = await _service.ActualizarProgresoAsync(id, request);
            if (dto == null) return NotFound(new { error = $"Registro {id} no encontrado o ya finalizado" });
            return Ok(dto);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Ajuste administrativo de horas/tiros de un registro (corrección de errores).
    /// </summary>
    [HttpPut("ajustar/{id}")]
    public async Task<ActionResult<TiempoProcesoDto>> AjustarTiempo(long id, [FromBody] AjustarTiempoRequest request)
    {
        try
        {
            var resultado = await _service.AjustarTiempoAsync(id, request);
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Cierra procesos abiertos duplicados encadenando hora fin = inicio del siguiente.
    /// </summary>
    [HttpPost("reparar-abiertos")]
    public async Task<ActionResult<object>> RepararAbiertos(
        [FromQuery] DateTime fecha,
        [FromQuery] int? maquinaId,
        [FromQuery] int? usuarioId)
    {
        try
        {
            var cerrados = await _service.RepararProcesosAbiertosAsync(fecha, maquinaId, usuarioId);
            return Ok(new { cerrados, message = cerrados > 0
                ? $"Se cerraron {cerrados} registro(s) duplicados en curso."
                : "No había registros duplicados abiertos para reparar." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Limpia los datos del día (historial y totales)
    /// </summary>
    [HttpDelete("limpiar")]
    public async Task<ActionResult> LimpiarDatos(
        [FromQuery] DateTime? fecha,
        [FromQuery] int? maquinaId,
        [FromQuery] int? usuarioId)
    {
        var fechaLimpiar = fecha ?? DateTime.Today;
        var resultado = await _service.LimpiarDatosDelDiaAsync(fechaLimpiar, maquinaId, usuarioId);
        
        if (resultado)
            return Ok(new { message = "Datos limpiados correctamente" });
        
        return Ok(new { message = "No se encontraron datos para limpiar" });
    }
}
