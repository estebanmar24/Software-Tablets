using Microsoft.AspNetCore.Mvc;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

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
