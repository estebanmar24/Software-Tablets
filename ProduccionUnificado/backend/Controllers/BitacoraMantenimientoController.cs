using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BitacoraMantenimientoController : ControllerBase
{
    private readonly AppDbContext _context;

    public BitacoraMantenimientoController(AppDbContext context)
    {
        _context = context;
    }

    private IQueryable<BitacoraMantenimientoDiaria> AplicarFiltros(
        IQueryable<BitacoraMantenimientoDiaria> query,
        DateTime? desde,
        DateTime? hasta,
        string? q)
    {
        if (desde.HasValue)
            query = query.Where(r => r.Fecha.Date >= desde.Value.Date);
        if (hasta.HasValue)
            query = query.Where(r => r.Fecha.Date <= hasta.Value.Date);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(r =>
                r.Actividad.ToLower().Contains(term) ||
                r.Descripcion.ToLower().Contains(term) ||
                r.RegistradoPor.ToLower().Contains(term));
        }
        return query;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BitacoraMantenimientoDiaria>>> GetRegistros(
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] string? q)
    {
        var query = AplicarFiltros(_context.BitacoraMantenimientoDiaria.AsNoTracking(), desde, hasta, q);
        var list = await query
            .OrderByDescending(r => r.Fecha)
            .ThenBy(r => r.HoraInicio)
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BitacoraMantenimientoDiaria>> GetRegistro(int id)
    {
        var item = await _context.BitacoraMantenimientoDiaria.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<BitacoraMantenimientoDiaria>> PostRegistro(BitacoraMantenimientoDiaria registro)
    {
        var validacion = ValidarRegistro(registro);
        if (validacion != null) return BadRequest(new { error = validacion });

        var (_, nombre) = MantenimientoTrazabilidadHelper.ObtenerUsuario(HttpContext);
        registro.RegistradoPor = string.IsNullOrWhiteSpace(registro.RegistradoPor)
            ? (nombre ?? "Usuario")
            : registro.RegistradoPor.Trim();
        registro.Fecha = registro.Fecha.Date;
        registro.HoraInicio = NormalizarHora(registro.HoraInicio);
        registro.HoraFin = NormalizarHora(registro.HoraFin);
        registro.FechaRegistro = DateTime.UtcNow;

        _context.BitacoraMantenimientoDiaria.Add(registro);
        await _context.SaveChangesAsync();

        await MantenimientoTrazabilidadHelper.RegistrarAsync(
            _context, HttpContext, "Maquinaria", "BitacoraMantenimiento", "Crear",
            registro.Id, $"{registro.Actividad} ({registro.Fecha:yyyy-MM-dd})");

        return Ok(registro);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> PutRegistro(int id, BitacoraMantenimientoDiaria registro)
    {
        if (id != registro.Id) return BadRequest();
        var existing = await _context.BitacoraMantenimientoDiaria.FindAsync(id);
        if (existing == null) return NotFound();

        var validacion = ValidarRegistro(registro);
        if (validacion != null) return BadRequest(new { error = validacion });

        existing.Fecha = registro.Fecha.Date;
        existing.HoraInicio = NormalizarHora(registro.HoraInicio);
        existing.HoraFin = NormalizarHora(registro.HoraFin);
        existing.Actividad = registro.Actividad.Trim();
        existing.Descripcion = registro.Descripcion.Trim();

        await _context.SaveChangesAsync();
        await MantenimientoTrazabilidadHelper.RegistrarAsync(
            _context, HttpContext, "Maquinaria", "BitacoraMantenimiento", "Actualizar",
            id, $"{existing.Actividad} ({existing.Fecha:yyyy-MM-dd})");

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRegistro(int id)
    {
        var item = await _context.BitacoraMantenimientoDiaria.FindAsync(id);
        if (item == null) return NotFound();

        _context.BitacoraMantenimientoDiaria.Remove(item);
        await _context.SaveChangesAsync();
        await MantenimientoTrazabilidadHelper.RegistrarAsync(
            _context, HttpContext, "Maquinaria", "BitacoraMantenimiento", "Eliminar",
            id, $"{item.Actividad} ({item.Fecha:yyyy-MM-dd})");

        return NoContent();
    }

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] string? q)
    {
        var query = AplicarFiltros(_context.BitacoraMantenimientoDiaria.AsNoTracking(), desde, hasta, q);
        var registros = await query
            .OrderByDescending(r => r.Fecha)
            .ThenBy(r => r.HoraInicio)
            .ToListAsync();

        if (registros.Count == 0)
            return NotFound(new { message = "No hay registros para exportar." });

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Bitácora");

        var headers = new[] { "Fecha", "Hora inicio", "Hora fin", "Actividad", "Descripción", "Registrado por" };
        for (var i = 0; i < headers.Length; i++)
        {
            ws.Cells[1, i + 1].Value = headers[i];
            ws.Cells[1, i + 1].Style.Font.Bold = true;
            ws.Cells[1, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(30, 64, 175));
            ws.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        var row = 2;
        foreach (var r in registros)
        {
            ws.Cells[row, 1].Value = r.Fecha;
            ws.Cells[row, 1].Style.Numberformat.Format = "dd/mm/yyyy";
            ws.Cells[row, 2].Value = r.HoraInicio;
            ws.Cells[row, 3].Value = r.HoraFin;
            ws.Cells[row, 4].Value = r.Actividad;
            ws.Cells[row, 5].Value = r.Descripcion;
            ws.Cells[row, 6].Value = r.RegistradoPor;
            row++;
        }

        ws.Cells[ws.Dimension!.Address].AutoFitColumns();
        ws.Column(5).Width = Math.Min(80, ws.Column(5).Width);

        var fileName = $"Bitacora_Mantenimiento_{DateTime.Now:yyyyMMdd_HHmm}.xlsx";
        return File(
            package.GetAsByteArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    private static string NormalizarHora(string? hora)
    {
        if (string.IsNullOrWhiteSpace(hora)) return "00:00:00";
        var t = hora.Trim();
        if (t.Length == 5) return $"{t}:00";
        return t.Length >= 8 ? t[..8] : t;
    }

    private static string? ValidarRegistro(BitacoraMantenimientoDiaria registro)
    {
        if (registro.Fecha == default)
            return "La fecha es obligatoria.";
        if (string.IsNullOrWhiteSpace(registro.Actividad))
            return "La actividad es obligatoria.";
        if (string.IsNullOrWhiteSpace(registro.Descripcion))
            return "La descripción es obligatoria.";

        var inicio = NormalizarHora(registro.HoraInicio);
        var fin = NormalizarHora(registro.HoraFin);
        if (!TimeSpan.TryParse(inicio, out var tsInicio))
            return "La hora de inicio no es válida.";
        if (!TimeSpan.TryParse(fin, out var tsFin))
            return "La hora de fin no es válida.";
        if (tsFin <= tsInicio)
            return "La hora fin debe ser posterior a la hora de inicio.";

        return null;
    }
}
