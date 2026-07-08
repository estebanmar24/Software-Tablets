using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using System.Globalization;
using System.Text.RegularExpressions;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/catalogo-op")]
public class CatalogoOrdenProduccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<CatalogoOrdenProduccionController> _logger;

    public CatalogoOrdenProduccionController(AppDbContext context, ILogger<CatalogoOrdenProduccionController> logger)
    {
        _context = context;
        _logger = logger;
    }

  /// <summary>Busca OP en catálogo (periodo indicado o el más reciente).</summary>
    [HttpGet("buscar")]
    public async Task<ActionResult> Buscar([FromQuery] string numero, [FromQuery] int? mes = null, [FromQuery] int? anio = null)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return BadRequest(new { message = "Indique un número de OP válido." });

        CatalogoOrdenProduccion? row = null;
        if (mes.HasValue && anio.HasValue)
        {
            row = await _context.CatalogoOrdenesProduccion
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Numero == digits && x.Mes == mes.Value && x.Anio == anio.Value);
        }

        row ??= await _context.CatalogoOrdenesProduccion
            .AsNoTracking()
            .Where(x => x.Numero == digits)
            .OrderByDescending(x => x.Anio)
            .ThenByDescending(x => x.Mes)
            .FirstOrDefaultAsync();

        if (row == null)
            return NotFound(new { message = $"No hay datos de catálogo para OP {digits}." });

        return Ok(MapDto(row));
    }

    /// <summary>Plan (catálogo) vs tiros reportados en producción del mismo periodo.</summary>
    [HttpGet("comparacion")]
    public async Task<ActionResult> Comparacion([FromQuery] int mes, [FromQuery] int anio)
    {
        if (mes < 1 || mes > 12 || anio < 2000)
            return BadRequest(new { message = "Mes y año inválidos." });

        var catalogo = await _context.CatalogoOrdenesProduccion
            .AsNoTracking()
            .Where(x => x.Mes == mes && x.Anio == anio)
            .OrderBy(x => x.Numero)
            .ToListAsync();

        var produccion = await _context.ProduccionDiaria
            .AsNoTracking()
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Select(p => new { p.ReferenciaOP, p.RendimientoFinal, p.TirosDiarios })
            .ToListAsync();

        var filas = catalogo.Select(c =>
        {
            var needle = c.Numero;
            var tiros = produccion
                .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP)
                    && (p.ReferenciaOP == needle
                        || p.ReferenciaOP.StartsWith(needle + "-")
                        || p.ReferenciaOP.StartsWith(needle + ",")
                        || p.ReferenciaOP.Contains("-" + needle)
                        || p.ReferenciaOP.Contains(needle)))
                .Sum(p => p.TirosDiarios > 0 ? p.TirosDiarios : p.RendimientoFinal);

            var plan = c.CantidadPlanificada;
            var pct = plan > 0 ? Math.Round((tiros / plan) * 100m, 2) : (decimal?)null;
            return new
            {
                numero = c.Numero,
                cliente = c.Cliente,
                referencia = c.Referencia,
                cantidadPlanificada = plan,
                tirosProducidos = tiros,
                cumplimientoPct = pct,
                diferencia = tiros - plan
            };
        }).ToList();

        return Ok(new { mes, anio, total = filas.Count, filas });
    }

    [HttpGet("lista")]
    public async Task<ActionResult> Lista([FromQuery] int mes, [FromQuery] int anio)
    {
        if (mes < 1 || mes > 12 || anio < 2000)
            return BadRequest(new { message = "Mes y año inválidos." });

        var items = await _context.CatalogoOrdenesProduccion
            .AsNoTracking()
            .Where(x => x.Mes == mes && x.Anio == anio)
            .OrderBy(x => x.Numero)
            .Select(x => MapDto(x))
            .ToListAsync();

        return Ok(new { mes, anio, total = items.Count, items });
    }

    [HttpPost("importar")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ImportarExcel(
        IFormFile file,
        [FromForm] int mes,
        [FromForm] int anio,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No se recibió archivo." });
        if (mes < 1 || mes > 12 || anio < 2000)
            return BadRequest(new { message = "Mes y año inválidos." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not ".xlsx" and not ".xls")
            return BadRequest(new { message = "El archivo debe ser Excel (.xlsx)." });

        var importados = 0;
        var omitidos = 0;
        var errores = new List<string>();

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream, ct);
            stream.Position = 0;

            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
            using var package = new ExcelPackage(stream);
            var ws = package.Workbook.Worksheets.FirstOrDefault();
            if (ws?.Dimension == null)
                return BadRequest(new { message = "El Excel no tiene datos." });

            var headers = LeerEncabezados(ws);
            var colOp = ResolverColumna(headers, "op", "o.p", "o.p.", "orden", "orden produccion", "orden de produccion");
            var colCliente = ResolverColumna(headers, "cliente");
            var colRef = ResolverColumna(headers, "nombre del producto y ref", "nombre del producto", "referencia", "producto", "trabajo");
            var colCant = ResolverColumna(headers, "cantidad real", "cantidad", "ctd", "cantidad a producir", "ctd a producir");

            if (colOp <= 0)
                return BadRequest(new { message = "No se encontró columna de OP (O.P / Orden de producción)." });

            var existentes = await _context.CatalogoOrdenesProduccion
                .Where(x => x.Mes == mes && x.Anio == anio)
                .ToListAsync(ct);
            var mapa = existentes.ToDictionary(x => x.Numero, StringComparer.Ordinal);

            for (int row = 2; row <= ws.Dimension.Rows; row++)
            {
                try
                {
                    var opRaw = ws.Cells[row, colOp].Value?.ToString()?.Trim() ?? "";
                    var numero = SoloDigitos(opRaw);
                    if (string.IsNullOrEmpty(numero)) { omitidos++; continue; }

                    var cliente = colCliente > 0 ? Limpiar(ws.Cells[row, colCliente].Value?.ToString()) : null;
                    var referencia = colRef > 0 ? Limpiar(ws.Cells[row, colRef].Value?.ToString()) : null;
                    var cantidad = colCant > 0 ? ParseCantidad(ws.Cells[row, colCant].Value) : 0m;

                    if (mapa.TryGetValue(numero, out var entity))
                    {
                        entity.Cliente = cliente;
                        entity.Referencia = referencia;
                        entity.CantidadPlanificada = cantidad;
                        entity.Fuente = "Excel";
                        entity.FechaActualizacion = DateTime.UtcNow;
                    }
                    else
                    {
                        entity = new CatalogoOrdenProduccion
                        {
                            Numero = numero,
                            Cliente = cliente,
                            Referencia = referencia,
                            CantidadPlanificada = cantidad,
                            Mes = mes,
                            Anio = anio,
                            Fuente = "Excel",
                            FechaActualizacion = DateTime.UtcNow
                        };
                        _context.CatalogoOrdenesProduccion.Add(entity);
                        mapa[numero] = entity;
                    }
                    importados++;
                }
                catch (Exception exRow)
                {
                    errores.Add($"Fila {row}: {exRow.Message}");
                }
            }

            await _context.SaveChangesAsync(ct);
            _logger.LogInformation("Catálogo OP importado: {N} filas mes {M}/{A}", importados, mes, anio);

            return Ok(new
            {
                message = $"Se importaron/actualizaron {importados} OP para {mes}/{anio}.",
                importados,
                omitidos,
                errores
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error importando catálogo OP");
            return StatusCode(500, new { message = "Error procesando Excel.", detail = ex.Message });
        }
    }

    private static object MapDto(CatalogoOrdenProduccion x) => new
    {
        id = x.Id,
        numero = x.Numero,
        cliente = x.Cliente,
        referencia = x.Referencia,
        cantidadPlanificada = x.CantidadPlanificada,
        mes = x.Mes,
        anio = x.Anio,
        fuente = x.Fuente,
        fechaActualizacion = x.FechaActualizacion
    };

    private static string SoloDigitos(string? s) =>
        string.IsNullOrWhiteSpace(s) ? "" : Regex.Replace(s.Trim(), @"\D", "");

    private static string? Limpiar(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static decimal ParseCantidad(object? val)
    {
        if (val == null) return 0;
        if (val is double d) return (decimal)d;
        if (val is decimal dec) return dec;
        if (val is int i) return i;
        if (val is long l) return l;
        var s = val.ToString()?.Trim() ?? "";
        if (string.IsNullOrEmpty(s)) return 0;
        s = s.Replace(" ", "");
        if (Regex.IsMatch(s, @"^\d{1,3}(\.\d{3})+$"))
            s = s.Replace(".", "");
        s = s.Replace(",", ".");
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : 0;
    }

    private static Dictionary<string, int> LeerEncabezados(ExcelWorksheet ws)
    {
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int col = 1; col <= ws.Dimension.Columns; col++)
        {
            var h = ws.Cells[1, col].Value?.ToString()?.Trim().ToLowerInvariant() ?? "";
            if (!string.IsNullOrEmpty(h) && !headers.ContainsKey(h))
                headers[h] = col;
        }
        return headers;
    }

    private static int ResolverColumna(Dictionary<string, int> headers, params string[] candidatos)
    {
        foreach (var c in candidatos)
        {
            if (headers.TryGetValue(c, out var col)) return col;
            var match = headers.FirstOrDefault(kv => kv.Key.Contains(c, StringComparison.OrdinalIgnoreCase));
            if (match.Key != null) return match.Value;
        }
        return 0;
    }
}
