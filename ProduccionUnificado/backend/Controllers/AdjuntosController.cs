using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
[RequestSizeLimit(52_428_800)] // 50 MB
public class AdjuntosController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly AdjuntosExtractionService _extraccion;
    private readonly ILogger<AdjuntosController> _logger;

    public AdjuntosController(
        IWebHostEnvironment env,
        AdjuntosExtractionService extraccion,
        ILogger<AdjuntosController> logger)
    {
        _env = env;
        _extraccion = extraccion;
        _logger = logger;
    }

    /// <summary>Busca ficha F{n}, OP{n} y línea de troquel LT{n}.</summary>
    [HttpGet("buscar")]
    public IActionResult Buscar([FromQuery] string? numero)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return Ok(new { numero = "", ficha = (object?)null, op = (object?)null, lineaTroquel = (object?)null });

        var fichaPath = AdjuntosOpStorage.FindFile(_env, "fichas", "F", digits);
        var opPath = AdjuntosOpStorage.FindFile(_env, "op", "OP", digits);
        var ltPath = AdjuntosOpStorage.FindFile(_env, "linea_troquel", "LT", digits);
        var fichaUrl = AdjuntosOpStorage.ToPublicUrl(_env, fichaPath);
        var opUrl = AdjuntosOpStorage.ToPublicUrl(_env, opPath);
        var ltUrl = AdjuntosOpStorage.ToPublicUrl(_env, ltPath);

        return Ok(new
        {
            numero = digits,
            ficha = fichaUrl == null ? null : new { url = fichaUrl, nombre = Path.GetFileName(fichaPath!) },
            op = opUrl == null ? null : new { url = opUrl, nombre = Path.GetFileName(opPath!) },
            lineaTroquel = ltUrl == null ? null : new { url = ltUrl, nombre = Path.GetFileName(ltPath!) }
        });
    }

    /// <summary>Extrae texto (PDF + OCR) y devuelve campos estructurados.</summary>
    [HttpGet("datos")]
    public async Task<IActionResult> ObtenerDatos([FromQuery] string? numero, [FromQuery] bool forzar = false, CancellationToken ct = default)
    {
        try
        {
            var result = await _extraccion.ObtenerOExtraerAsync(numero ?? "", forzar, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en datos adjuntos OP {Numero}", numero);
            return StatusCode(500, new { message = "No se pudo leer el adjunto.", detail = ex.Message });
        }
    }

    [HttpPost("extraer")]
    public async Task<IActionResult> Extraer([FromQuery] string? numero, CancellationToken ct = default)
    {
        var result = await _extraccion.ObtenerOExtraerAsync(numero ?? "", forzar: true, ct);
        return Ok(result);
    }

    /// <summary>Listado de OPs con adjuntos y resumen de extracción en caché.</summary>
    [HttpGet("biblioteca")]
    public async Task<IActionResult> Biblioteca([FromQuery] string? q, CancellationToken ct = default)
    {
        var lista = await _extraccion.ListarBibliotecaAsync(q, ct);
        return Ok(lista);
    }

    /// <summary>Re-ejecuta OCR/texto de ficha, OP o ambos.</summary>
    [HttpPost("reextraer")]
    public async Task<IActionResult> Reextraer(
        [FromQuery] string? numero,
        [FromQuery] string? tipo,
        CancellationToken ct = default)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return BadRequest(new { message = "Indique el número de OP." });

        var t = (tipo ?? "ambos").Trim().ToLowerInvariant();
        if (t is "ambos" or "all" or "")
        {
            var result = await _extraccion.ObtenerOExtraerAsync(digits, forzar: true, ct);
            return Ok(result);
        }

        (string subfolder, string prefix, string tipoExtraccion) map;
        try
        {
            map = AdjuntosOpStorage.MapTipoDocumento(t);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var path = AdjuntosOpStorage.FindFile(_env, map.subfolder, map.prefix, digits);
        if (path == null)
            return NotFound(new { message = $"No existe archivo {map.prefix}{digits}.pdf" });

        var doc = await _extraccion.ExtraerArchivoAsync(digits, map.tipoExtraccion, path, ct);
        return Ok(new { numero = digits, tipo = map.tipoExtraccion, extraccion = doc });
    }

    /// <summary>
    /// Sube PDF de ficha u OP: renombra a F{n}.pdf u OP{n}.pdf y ejecuta OCR automáticamente.
    /// </summary>
    [HttpPost("subir")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AdjuntoSubirResponseDto>> Subir(
        [FromForm] string? numero,
        [FromForm] string? tipo,
        IFormFile? file,
        CancellationToken ct = default)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return BadRequest(new { message = "Ingrese el número de OP (solo dígitos)." });

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Seleccione un archivo PDF." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".pdf" && !string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Solo se permiten archivos PDF." });

        (string subfolder, string prefix, string tipoExtraccion) map;
        try
        {
            map = AdjuntosOpStorage.MapTipoDocumento(tipo ?? "");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        string savedPath;
        try
        {
            await using var stream = file.OpenReadStream();
            savedPath = AdjuntosOpStorage.SavePdfFile(_env, map.subfolder, map.prefix, digits, stream);
            _logger.LogInformation("Adjunto guardado: {Path}", savedPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error guardando adjunto OP {Numero}", digits);
            return StatusCode(500, new { message = "No se pudo guardar el archivo.", detail = ex.Message });
        }

        AdjuntoExtraccionDocumentoDto? extraccion = null;
        try
        {
            extraccion = await _extraccion.ExtraerArchivoAsync(digits, map.tipoExtraccion, savedPath, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Archivo guardado pero OCR falló para OP {Numero}", digits);
        }

        var url = AdjuntosOpStorage.ToPublicUrl(_env, savedPath) ?? "";
        return Ok(new AdjuntoSubirResponseDto
        {
            Numero = digits,
            Tipo = map.tipoExtraccion,
            ArchivoNombre = Path.GetFileName(savedPath),
            Url = url,
            Extraccion = extraccion
        });
    }

    /// <summary>Elimina archivos F{n}/OP{n} y registros de extracción en BD.</summary>
    [HttpDelete]
    public async Task<IActionResult> Eliminar([FromQuery] string? numero, CancellationToken ct = default)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return BadRequest(new { message = "Indique el número de OP a eliminar." });

        (int archivos, int registros, List<string> errores) result;
        try
        {
            result = await _extraccion.EliminarOpAsync(digits, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error eliminando adjuntos OP {Numero}", digits);
            return StatusCode(500, new { message = "Error al eliminar.", detail = ex.Message });
        }

        var (archivos, registros, errores) = result;
        if (archivos == 0 && registros == 0 && errores.Count == 0)
            return NotFound(new { message = $"No se encontraron adjuntos para OP {digits}." });

        if (errores.Count > 0 && archivos == 0)
        {
            return Conflict(new
            {
                message = "No se pudo borrar el archivo. Cierre el PDF si lo tiene abierto e intente de nuevo.",
                numero = digits,
                archivosEliminados = archivos,
                registrosEliminados = registros,
                errores,
            });
        }

        _logger.LogInformation(
            "Adjuntos OP {Numero} eliminados: {Archivos} archivos, {Registros} registros BD",
            digits, archivos, registros);

        return Ok(new
        {
            numero = digits,
            archivosEliminados = archivos,
            registrosEliminados = registros,
            errores = errores.Count > 0 ? errores : null,
            message = errores.Count > 0
                ? $"OP {digits}: datos borrados; revise archivos pendientes."
                : $"OP {digits} eliminada de la biblioteca.",
        });
    }

    private static string SoloDigitos(string? value) =>
        new string((value ?? "").Where(char.IsDigit).ToArray());
}
