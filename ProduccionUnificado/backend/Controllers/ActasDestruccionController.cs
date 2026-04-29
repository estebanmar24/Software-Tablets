using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using OfficeOpenXml;
using OfficeOpenXml.Style;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ActasDestruccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public ActasDestruccionController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    // Lista de procesos (reutiliza la misma de Calidad)
    private static readonly string[] Procesos = {
        "Conversión", "Corrugadora", "Guillotina", "Impresión", "Laminado",
        "Estampado", "Troquelado", "Screen", "Colaminadora", "Despique",
        "Pegadora", "Terminados", "Taller Externo", "Tejedora",
        "Diseño", "Facturación", "Despachos", "Comercial"
    };

    [AllowAnonymous]
    [HttpGet("procesos")]
    public ActionResult<IEnumerable<string>> GetProcesos()
    {
        return Ok(Procesos);
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ActaDestruccionResumenDto>>> GetActas(
        [FromQuery] int? mes, [FromQuery] int? anio)
    {
        var query = _context.ActasDestruccion.AsQueryable();

        if (mes.HasValue && anio.HasValue)
        {
            query = query.Where(a => a.Fecha.Month == mes.Value && a.Fecha.Year == anio.Value);
        }

        var actas = await query
            .OrderByDescending(a => a.FechaCreacion)
            .Select(a => new ActaDestruccionResumenDto
            {
                Id = a.Id,
                Fecha = a.Fecha,
                OrdenProduccion = a.OrdenProduccion,
                Cliente = a.Cliente,
                Producto = a.Producto,
                CantidadActaDestruccion = a.CantidadActaDestruccion,
                ProcesoReporta = a.ProcesoReporta,
                Estado = a.Estado,
                TienePdf = !string.IsNullOrEmpty(a.ArchivoPdfPath),
                FechaCreacion = a.FechaCreacion,
            })
            .ToListAsync();

        return Ok(actas);
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<ActionResult<ActaDestruccionDetalleDto>> GetActa(int id)
    {
        var acta = await _context.ActasDestruccion
            .Include(a => a.Procesos)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (acta == null) return NotFound();

        return Ok(new ActaDestruccionDetalleDto
        {
            Id = acta.Id,
            Fecha = acta.Fecha,
            OrdenProduccion = acta.OrdenProduccion,
            Cliente = acta.Cliente,
            Producto = acta.Producto,
            CantidadActaDestruccion = acta.CantidadActaDestruccion,
            Motivo = acta.Motivo,
            ProcesoReporta = acta.ProcesoReporta,
            CantidadOP = acta.CantidadOP,
            CantidadRealDespachada = acta.CantidadRealDespachada,
            Faltante = acta.Faltante,
            Estado = acta.Estado,
            ArchivoPdfUrl = !string.IsNullOrEmpty(acta.ArchivoPdfPath)
                ? $"uploads/actas-destruccion/{Path.GetFileName(acta.ArchivoPdfPath)}"
                : null,
            FechaCreacion = acta.FechaCreacion,
            Procesos = (acta.Procesos ?? new List<ActaDestruccionProceso>()).Select(p => new ActaDestruccionProcesoDto
            {
                Id = p.Id,
                Proceso = p.Proceso,
                Motivo = p.Motivo,
                Cantidad = p.Cantidad
            }).ToList()
        });
    }

    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult> CrearActa([FromBody] CrearActaDestruccionDto dto)
    {
        try
        {
            var acta = new ActaDestruccion
            {
                Fecha = dto.Fecha,
                OrdenProduccion = dto.OrdenProduccion,
                Cliente = dto.Cliente,
                Producto = dto.Producto,
                CantidadActaDestruccion = dto.CantidadActaDestruccion,
                Motivo = dto.Motivo,
                ProcesoReporta = dto.ProcesoReporta,
                CantidadOP = dto.CantidadOP,
                CantidadRealDespachada = dto.CantidadRealDespachada,
                Faltante = dto.Faltante,
                Estado = dto.Estado,
                FechaCreacion = DateTime.UtcNow
            };

            // Handling multiple processes
            if (dto.Procesos != null && dto.Procesos.Any())
            {
                acta.Procesos = dto.Procesos.Select(p => new ActaDestruccionProceso
                {
                    Proceso = p.Proceso,
                    Motivo = p.Motivo,
                    Cantidad = p.Cantidad
                }).ToList();
            }

            // Handle PDF upload as base64
            if (!string.IsNullOrEmpty(dto.ArchivoPdfBase64))
            {
                var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "actas-destruccion");
                if (!Directory.Exists(uploadsDir))
                    Directory.CreateDirectory(uploadsDir);

                var fileName = $"acta_{Guid.NewGuid()}.pdf";
                var filePath = Path.Combine(uploadsDir, fileName);

                var base64Data = dto.ArchivoPdfBase64;
                if (base64Data.Contains(","))
                    base64Data = base64Data.Split(',')[1];

                var fileBytes = Convert.FromBase64String(base64Data);
                await System.IO.File.WriteAllBytesAsync(filePath, fileBytes);

                acta.ArchivoPdfPath = fileName;
                Console.WriteLine($"[ACTAS] PDF guardado: {fileName}");
            }

            _context.ActasDestruccion.Add(acta);
            await _context.SaveChangesAsync();
            Console.WriteLine($"[ACTAS] Acta creada con ID: {acta.Id}");

            return Ok(new { id = acta.Id });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ACTAS ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al guardar el acta", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> EliminarActa(int id)
    {
        var acta = await _context.ActasDestruccion.FindAsync(id);
        if (acta == null) return NotFound();

        // Delete PDF file if exists
        if (!string.IsNullOrEmpty(acta.ArchivoPdfPath))
        {
            var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "actas-destruccion", acta.ArchivoPdfPath);
            if (System.IO.File.Exists(filePath))
            {
                try { System.IO.File.Delete(filePath); } catch { }
            }
        }

        _context.ActasDestruccion.Remove(acta);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> ActualizarActa(int id, [FromBody] CrearActaDestruccionDto dto)
    {
        try
        {
            var acta = await _context.ActasDestruccion
                .Include(a => a.Procesos)
                .FirstOrDefaultAsync(a => a.Id == id);
            
            if (acta == null) return NotFound();

            acta.Fecha = dto.Fecha;
            acta.OrdenProduccion = dto.OrdenProduccion;
            acta.Cliente = dto.Cliente;
            acta.Producto = dto.Producto;
            acta.CantidadActaDestruccion = dto.CantidadActaDestruccion;
            acta.Motivo = dto.Motivo;
            acta.ProcesoReporta = dto.ProcesoReporta;
            acta.CantidadOP = dto.CantidadOP;
            acta.CantidadRealDespachada = dto.CantidadRealDespachada;
            acta.Faltante = dto.Faltante;
            acta.Estado = dto.Estado;

            // Handle Processes update
            _context.ActaDestruccionProcesos.RemoveRange(acta.Procesos ?? new List<ActaDestruccionProceso>());
            if (dto.Procesos != null && dto.Procesos.Any())
            {
                acta.Procesos = dto.Procesos.Select(p => new ActaDestruccionProceso
                {
                    Proceso = p.Proceso,
                    Motivo = p.Motivo,
                    Cantidad = p.Cantidad
                }).ToList();
            }

            // Handle PDF update
            if (!string.IsNullOrEmpty(dto.ArchivoPdfBase64))
            {
                // Delete old file if exists
                if (!string.IsNullOrEmpty(acta.ArchivoPdfPath))
                {
                    var oldFilePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "actas-destruccion", acta.ArchivoPdfPath);
                    if (System.IO.File.Exists(oldFilePath))
                    {
                        try { System.IO.File.Delete(oldFilePath); } catch { }
                    }
                }

                var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "actas-destruccion");
                if (!Directory.Exists(uploadsDir))
                    Directory.CreateDirectory(uploadsDir);

                var fileName = $"acta_{Guid.NewGuid()}.pdf";
                var filePath = Path.Combine(uploadsDir, fileName);

                var base64Data = dto.ArchivoPdfBase64;
                if (base64Data.Contains(","))
                    base64Data = base64Data.Split(',')[1];

                var fileBytes = Convert.FromBase64String(base64Data);
                await System.IO.File.WriteAllBytesAsync(filePath, fileBytes);

                acta.ArchivoPdfPath = fileName;
                Console.WriteLine($"[ACTAS] PDF actualizado: {fileName}");
            }

            await _context.SaveChangesAsync();
            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ACTAS ERROR] {ex.Message}");
            return StatusCode(500, new { message = "Error al actualizar el acta", error = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("pdf/{fileName}")]
    public IActionResult GetPdf(string fileName)
    {
        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "actas-destruccion", fileName);
        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var bytes = System.IO.File.ReadAllBytes(filePath);
        return File(bytes, "application/pdf", fileName);
    }

    [AllowAnonymous]
    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] int? mes, [FromQuery] int? anio)
    {
        var query = _context.ActasDestruccion
            .Include(a => a.Procesos)
            .AsQueryable();

        if (mes.HasValue && anio.HasValue)
        {
            query = query.Where(a => a.Fecha.Month == mes.Value && a.Fecha.Year == anio.Value);
        }

        var actas = await query.OrderByDescending(a => a.Fecha).ToListAsync();

        if (!actas.Any())
            return NotFound(new { message = "No se encontraron actas en el rango seleccionado" });

        using var package = new ExcelPackage();
        var ws = package.Workbook.Worksheets.Add("Actas de Destrucción");

        var headers = new[] { "Fecha", "OP", "Cliente", "Producto", "Cant. Total Acta",
            "Estado", "Tiene PDF", "Proceso", "Motivo", "Cantidad Proceso" };

        for (int i = 0; i < headers.Length; i++)
        {
            ws.Cells[1, i + 1].Value = headers[i];
            ws.Cells[1, i + 1].Style.Font.Bold = true;
            ws.Cells[1, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(0, 51, 102));
            ws.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        int row = 2;
        foreach (var a in actas)
        {
            if (a.Procesos == null || !a.Procesos.Any())
            {
                ws.Cells[row, 1].Value = a.Fecha.ToString("dd/MM/yyyy");
                ws.Cells[row, 2].Value = a.OrdenProduccion;
                ws.Cells[row, 3].Value = a.Cliente;
                ws.Cells[row, 4].Value = a.Producto;
                ws.Cells[row, 5].Value = (double)a.CantidadActaDestruccion;
                ws.Cells[row, 6].Value = a.Estado;
                ws.Cells[row, 7].Value = !string.IsNullOrEmpty(a.ArchivoPdfPath) ? "Sí" : "No";
                ws.Cells[row, 8].Value = a.ProcesoReporta;
                ws.Cells[row, 9].Value = a.Motivo;
                ws.Cells[row, 10].Value = (double)a.CantidadActaDestruccion;
                row++;
            }
            else
            {
                foreach (var p in a.Procesos)
                {
                    ws.Cells[row, 1].Value = a.Fecha.ToString("dd/MM/yyyy");
                    ws.Cells[row, 2].Value = a.OrdenProduccion;
                    ws.Cells[row, 3].Value = a.Cliente;
                    ws.Cells[row, 4].Value = a.Producto;
                    ws.Cells[row, 5].Value = (double)a.CantidadActaDestruccion;
                    ws.Cells[row, 6].Value = a.Estado;
                    ws.Cells[row, 7].Value = !string.IsNullOrEmpty(a.ArchivoPdfPath) ? "Sí" : "No";
                    ws.Cells[row, 8].Value = p.Proceso;
                    ws.Cells[row, 9].Value = p.Motivo;
                    ws.Cells[row, 10].Value = (double)p.Cantidad;
                    row++;
                }
            }
        }

        ws.Cells[ws.Dimension.Address].AutoFitColumns();

        var fileName = $"ActasDestruccion_{DateTime.Now:yyyyMMdd}.xlsx";
        var content = package.GetAsByteArray();
        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }
}
