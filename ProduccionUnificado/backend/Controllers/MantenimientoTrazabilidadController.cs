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
[Route("api/mantenimiento/trazabilidad")]
public class MantenimientoTrazabilidadController : ControllerBase
{
    private readonly AppDbContext _context;

    public MantenimientoTrazabilidadController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetTrazabilidad(
        [FromQuery] string? modulo,
        [FromQuery] string? accion,
        [FromQuery] string? q,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        if (!MantenimientoTrazabilidadHelper.EsAdministrador(User))
            return Forbid();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);

        var query = AplicarFiltros(_context.Mantenimiento_Trazabilidad.AsNoTracking(), modulo, accion, q, desde, hasta);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Modulo,
                t.Entidad,
                t.Accion,
                t.EntidadId,
                t.Descripcion,
                t.UsuarioId,
                t.UsuarioNombre,
                t.Fecha,
                t.EsHistorico,
            })
            .ToListAsync();

        var modulos = await _context.Mantenimiento_Trazabilidad.AsNoTracking()
            .Select(t => t.Modulo)
            .Distinct()
            .OrderBy(m => m)
            .ToListAsync();

        return Ok(new
        {
            items,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize),
            modulos,
        });
    }

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? modulo,
        [FromQuery] string? accion,
        [FromQuery] string? q,
        [FromQuery] DateTime? desde,
        [FromQuery] DateTime? hasta)
    {
        if (!MantenimientoTrazabilidadHelper.EsAdministrador(User))
            return Forbid();

        var query = AplicarFiltros(_context.Mantenimiento_Trazabilidad.AsNoTracking(), modulo, accion, q, desde, hasta);

        var registros = await query
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.Id)
            .Take(50000)
            .ToListAsync();

        if (registros.Count == 0)
            return NotFound(new { message = "No hay registros para exportar con los filtros actuales." });

        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Trazabilidad");

        var headers = new[]
        {
            "ID", "Fecha", "Módulo", "Entidad", "Acción", "ID Entidad",
            "Descripción", "Usuario", "Histórico"
        };

        for (var i = 0; i < headers.Length; i++)
        {
            ws.Cells[1, i + 1].Value = headers[i];
            ws.Cells[1, i + 1].Style.Font.Bold = true;
            ws.Cells[1, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(30, 64, 175));
            ws.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        var row = 2;
        foreach (var t in registros)
        {
            ws.Cells[row, 1].Value = t.Id;
            ws.Cells[row, 2].Value = t.Fecha;
            ws.Cells[row, 2].Style.Numberformat.Format = "dd/mm/yyyy hh:mm";
            ws.Cells[row, 3].Value = t.Modulo;
            ws.Cells[row, 4].Value = t.Entidad;
            ws.Cells[row, 5].Value = t.Accion;
            ws.Cells[row, 6].Value = t.EntidadId;
            ws.Cells[row, 7].Value = t.Descripcion;
            ws.Cells[row, 8].Value = t.UsuarioNombre ?? "—";
            ws.Cells[row, 9].Value = t.EsHistorico ? "Sí" : "No";
            row++;
        }

        ws.Cells[ws.Dimension!.Address].AutoFitColumns();
        ws.Column(7).Width = Math.Min(80, ws.Column(7).Width);

        var sufijo = !string.IsNullOrWhiteSpace(modulo) ? $"_{modulo}" : "";
        var fileName = $"Trazabilidad_Mantenimiento{sufijo}_{DateTime.Now:yyyyMMdd_HHmm}.xlsx";
        return File(
            package.GetAsByteArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    [HttpPost("backfill")]
    public async Task<ActionResult> EjecutarBackfill()
    {
        if (!MantenimientoTrazabilidadHelper.EsAdministrador(User))
            return Forbid();

        var antes = await _context.Mantenimiento_Trazabilidad.CountAsync();
        if (antes > 0)
            return BadRequest(new { message = "Ya existen registros de trazabilidad. El backfill solo corre cuando la tabla está vacía." });

        await MantenimientoTrazabilidadHelper.BackfillSiVacioAsync(_context);
        var despues = await _context.Mantenimiento_Trazabilidad.CountAsync();
        return Ok(new { message = $"Backfill completado: {despues} registros.", total = despues });
    }

    private static IQueryable<Mantenimiento_Trazabilidad> AplicarFiltros(
        IQueryable<Mantenimiento_Trazabilidad> query,
        string? modulo,
        string? accion,
        string? q,
        DateTime? desde,
        DateTime? hasta)
    {
        if (!string.IsNullOrWhiteSpace(modulo))
            query = query.Where(t => t.Modulo == modulo);

        if (!string.IsNullOrWhiteSpace(accion))
            query = query.Where(t => t.Accion == accion);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(t =>
                t.Descripcion.ToLower().Contains(term) ||
                (t.UsuarioNombre != null && t.UsuarioNombre.ToLower().Contains(term)) ||
                (t.Entidad != null && t.Entidad.ToLower().Contains(term)));
        }

        if (desde.HasValue)
            query = query.Where(t => t.Fecha >= desde.Value.Date);

        if (hasta.HasValue)
            query = query.Where(t => t.Fecha < hasta.Value.Date.AddDays(1));

        return query;
    }
}
