using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/gastos-autorizacion")]
public class GastoAutorizacionController : ControllerBase
{
    private readonly GastoAutorizacionService _service;

    public GastoAutorizacionController(GastoAutorizacionService service)
    {
        _service = service;
    }

    private (int? id, string nombre, string role) UsuarioActual()
    {
        var idClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        var nombre = User.Claims.FirstOrDefault(c => c.Type == "NombreMostrar")?.Value
            ?? User.Identity?.Name
            ?? "";
        var role = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? "";
        int? id = idClaim != null && int.TryParse(idClaim.Value, out var parsed) ? parsed : null;
        return (id, nombre.Trim(), role.Trim());
    }

    [HttpGet("consolidado")]
    public async Task<ActionResult<IEnumerable<GastoAutorizacionSolicitudDto>>> ListarConsolidado(
        [FromQuery] int? anio,
        [FromQuery] int? mes,
        [FromQuery] string? modulo = null,
        [FromQuery] string? estado = null,
        [FromQuery] string? search = null,
        [FromQuery] string? proveedor = null,
        [FromQuery] string? fechaFiltro = null,
        [FromQuery] bool soloPendientesRevision = false)
    {
        var u = UsuarioActual();
        var esAutorizador = GastoAutorizacionHelper.EsAutorizador(u.nombre, u.role);
        var list = await _service.ListarConsolidadoAsync(
            anio, mes, modulo, estado, search, proveedor, fechaFiltro, u.id, u.nombre, esAutorizador, soloPendientesRevision);
        return Ok(list);
    }

    /// <summary>
    /// Sincroniza solicitudes autorizadas sin gasto → movimientos en Contabilidad.
    /// </summary>
    [HttpPost("materializar-movimientos")]
    public async Task<ActionResult<object>> MaterializarMovimientos()
    {
        var creados = await _service.MaterializarAutorizadasSinGastoAsync();
        return Ok(new { materializados = creados });
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GastoAutorizacionSolicitudDto>>> Listar(
        [FromQuery] string modulo,
        [FromQuery] int? anio,
        [FromQuery] int? mes,
        [FromQuery] string? estado = null)
    {
        try
        {
            var u = UsuarioActual();
            var esAutorizador = GastoAutorizacionHelper.EsAutorizador(u.nombre, u.role);
            var list = await _service.ListarAsync(modulo, anio, mes, estado, u.id, u.nombre, esAutorizador);
            return Ok(list);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<GastoAutorizacionSolicitudDto>> Crear([FromBody] GastoAutorizacionWriteDto dto)
    {
        try
        {
            var u = UsuarioActual();
            var created = await _service.CrearAsync(dto, u.id, u.nombre);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/autorizar")]
    public async Task<ActionResult<GastoAutorizacionSolicitudDto>> Autorizar(int id)
    {
        try
        {
            var u = UsuarioActual();
            var result = await _service.AutorizarAsync(id, u.id, u.nombre, u.role);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/rechazar")]
    public async Task<ActionResult<GastoAutorizacionSolicitudDto>> Rechazar(
        int id,
        [FromBody] GastoAutorizacionRechazoDto dto)
    {
        try
        {
            var u = UsuarioActual();
            var result = await _service.RechazarAsync(id, dto, u.id, u.nombre, u.role);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<GastoAutorizacionSolicitudDto>> Actualizar(
        int id,
        [FromBody] GastoAutorizacionWriteDto dto)
    {
        try
        {
            var u = UsuarioActual();
            var result = await _service.ActualizarAsync(id, dto, u.id, u.nombre);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        try
        {
            var u = UsuarioActual();
            await _service.EliminarAsync(id, u.id, u.nombre, u.role);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}/comentarios")]
    public async Task<ActionResult<IEnumerable<GastoAutorizacionComentarioDto>>> ListarComentarios(int id)
    {
        var list = await _service.ListarComentariosAsync(id);
        return Ok(list);
    }

    [HttpPost("{id:int}/comentarios")]
    public async Task<ActionResult<GastoAutorizacionComentarioDto>> AgregarComentario(
        int id,
        [FromBody] GastoAutorizacionComentarioWriteDto dto)
    {
        try
        {
            var u = UsuarioActual();
            var comentario = await _service.AgregarComentarioAsync(id, dto, u.id, u.nombre);
            return Ok(comentario);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
