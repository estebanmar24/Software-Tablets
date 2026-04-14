using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;
using OfficeOpenXml;
using OfficeOpenXml.Style;

using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;

// [Authorize]
[ApiController]
[Route("api/[controller]")]
public class CalidadController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public CalidadController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    // Lista de procesos disponibles
    private static readonly string[] Procesos = {
        "Conversión", "Corrugadora", "Guillotina", "Impresión", "Laminado",
        "Estampado", "Troquelado", "Screen", "Colaminadora", "Despique",
        "Pegadora", "Terminados", "Taller Externo", "Tejedora",
        "Diseño", "Facturación", "Despachos", "Comercial"
    };

    // Lista de novedades disponibles
    private static readonly string[] TiposNovedad = {
        "Variación en el tono", "Descasque", "Mancha o velo", "Impresión lavada",
        "Ojos de pescado", "Desregistro impresión - troquel", "Grafado roto y/o falta de corte",
        "Rasgado de despique", "Marcas superficiales", "Material pandeado o arqueado",
        "Contaminación cruzada", "Encocamiento", "Calibres diferentes",
        "Sin diligenciar documentos"
    };

    // Estados de proceso
    private static readonly string[] EstadosProceso = { "En proceso", "Terminado" };

    [HttpGet("procesos")]
    public ActionResult<IEnumerable<string>> GetProcesos()
    {
        return Ok(Procesos);
    }

    [HttpGet("novedades")]
    public ActionResult<IEnumerable<string>> GetTiposNovedad()
    {
        return Ok(TiposNovedad);
    }

    [HttpGet("estados")]
    public ActionResult<IEnumerable<string>> GetEstadosProceso()
    {
        return Ok(EstadosProceso);
    }

    [HttpGet("encuestas")]
    public async Task<ActionResult<IEnumerable<EncuestaCalidadResumenDto>>> GetEncuestas(int? mes, int? anio)
    {
        var query = _context.EncuestasCalidad
            .Include(e => e.Operario)
            .Include(e => e.Auxiliar)
            .Include(e => e.Maquina)
            .Include(e => e.Novedades)
            .AsQueryable();

        if (mes.HasValue && anio.HasValue)
        {
            query = query.Where(e => e.FechaCreacion.Month == mes.Value && e.FechaCreacion.Year == anio.Value);
        }

        var encuestas = await query
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new EncuestaCalidadResumenDto
            {
                Id = e.Id,
                Operario = e.Operario!.Nombre,
                Auxiliar = e.Auxiliar != null ? e.Auxiliar.Nombre : null,
                OrdenProduccion = e.OrdenProduccion,
                Maquina = e.Maquina!.Nombre,
                Proceso = e.Proceso,
                EstadoProceso = e.EstadoProceso,
                FechaCreacion = e.FechaCreacion,
                TotalNovedades = e.Novedades.Count,
                TotalFotos = e.Novedades.Count(n => !string.IsNullOrEmpty(n.FotoPath)),
                TiposNovedad = e.Novedades.Select(n => n.TipoNovedad).ToList()
            })
            .ToListAsync();

        return Ok(encuestas);
    }

    [HttpGet("encuestas/{id}")]
    public async Task<ActionResult<EncuestaCalidadDetalleDto>> GetEncuesta(int id)
    {
        var encuesta = await _context.EncuestasCalidad
            .Include(e => e.Operario)
            .Include(e => e.Auxiliar)
            .Include(e => e.Maquina)
            .Include(e => e.Novedades)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (encuesta == null)
            return NotFound();

        var baseUrl = $"{Request.Scheme}://{Request.Host}";

        return Ok(new EncuestaCalidadDetalleDto
        {
            Id = encuesta.Id,
            OperarioId = encuesta.OperarioId,
            Operario = encuesta.Operario!.Nombre,
            AuxiliarId = encuesta.AuxiliarId,
            Auxiliar = encuesta.Auxiliar?.Nombre,
            OrdenProduccion = encuesta.OrdenProduccion,
            CantidadProducir = encuesta.CantidadProducir,
            MaquinaId = encuesta.MaquinaId,
            Maquina = encuesta.Maquina!.Nombre,
            Proceso = encuesta.Proceso,
            CantidadEvaluada = encuesta.CantidadEvaluada,
            EstadoProceso = encuesta.EstadoProceso,
            TieneFichaTecnica = encuesta.TieneFichaTecnica,
            CorrectoRegistroFormatos = encuesta.CorrectoRegistroFormatos,
            AprobacionArranque = encuesta.AprobacionArranque,
            Observacion = encuesta.Observacion,
            ContieneMuestraFisica = encuesta.ContieneMuestraFisica,
            FechaCreacion = encuesta.FechaCreacion,
            Novedades = encuesta.Novedades.Select(n => new NovedadDetalleDto
            {
                Id = n.Id,
                TipoNovedad = n.TipoNovedad,
                FotoUrl = n.FotoPath != null ? $"fotos-calidad/{Path.GetFileName(n.FotoPath)}" : null,
                Descripcion = n.Descripcion,
                CantidadDefectuosa = n.CantidadDefectuosa
            }).ToList()
        });
    }

    [HttpPost("encuestas")]
    public async Task<ActionResult<EncuestaCalidadDetalleDto>> CrearEncuesta([FromBody] CrearEncuestaCalidadDto dto)
    {
        try 
        {
            Console.WriteLine($"[SAVE CALIDAD] Iniciando guardado para OP: {dto.OrdenProduccion}");
            Console.WriteLine($"[SAVE CALIDAD] Operario: {dto.OperarioId}, Maquina: {dto.MaquinaId}, Novedades: {dto.Novedades?.Count ?? 0}");
            Console.WriteLine($"[SAVE CALIDAD] CantidadProducir={dto.CantidadProducir}, CantidadEvaluada={dto.CantidadEvaluada}");
            Console.WriteLine($"[SAVE CALIDAD] ContieneMuestraFisica={dto.ContieneMuestraFisica}");

            // Crear la encuesta
            var encuesta = new EncuestaCalidad
            {
                OperarioId = dto.OperarioId,
                AuxiliarId = dto.AuxiliarId,
                OrdenProduccion = dto.OrdenProduccion,
                CantidadProducir = dto.CantidadProducir,
                MaquinaId = dto.MaquinaId,
                Proceso = dto.Proceso,
                CantidadEvaluada = dto.CantidadEvaluada,
                EstadoProceso = dto.EstadoProceso,
                TieneFichaTecnica = dto.TieneFichaTecnica,
                CorrectoRegistroFormatos = dto.CorrectoRegistroFormatos,
                AprobacionArranque = dto.AprobacionArranque,
                Observacion = dto.Observacion,
                ContieneMuestraFisica = dto.ContieneMuestraFisica,
                FechaCreacion = DateTime.UtcNow
            };

            _context.EncuestasCalidad.Add(encuesta);
            Console.WriteLine("[SAVE CALIDAD] Guardando encuesta principal...");
            await _context.SaveChangesAsync();
            Console.WriteLine($"[SAVE CALIDAD] Encuesta creada con ID: {encuesta.Id}");

            // Procesar novedades con fotos
            var fotosDir = Path.Combine(_env.ContentRootPath, "wwwroot", "fotos-calidad");
            if (!Directory.Exists(fotosDir))
                Directory.CreateDirectory(fotosDir);

            foreach (var novedadDto in dto.Novedades ?? new List<NovedadDto>())
            {
                var fileName = string.Empty;

                if (!string.IsNullOrEmpty(novedadDto.FotoBase64))
                {
                    try
                    {
                        fileName = $"{Guid.NewGuid()}.jpg";
                        var filePath = Path.Combine(fotosDir, fileName);
                        
                        var base64Data = novedadDto.FotoBase64;
                        if (base64Data.Contains(","))
                            base64Data = base64Data.Split(',')[1];
                        
                        var imageBytes = Convert.FromBase64String(base64Data);
                        await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);
                        Console.WriteLine($"[SAVE CALIDAD] Foto guardada: {fileName}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[SAVE CALIDAD] Error guardando foto: {ex.Message}");
                        fileName = string.Empty; // Reset on failure so we don't store a bad path
                    }
                }
                else if (!string.IsNullOrEmpty(novedadDto.FotoUrl))
                {
                    try
                    {
                        // Simple and safe: just take the last segment of the URL
                        var url = novedadDto.FotoUrl;
                        // Remove query strings if any
                        var urlWithoutQuery = url.Split('?')[0];
                        fileName = urlWithoutQuery.Split('/').LastOrDefault(s => !string.IsNullOrEmpty(s)) ?? "";
                        // Only keep if it looks like a file name (has an extension)
                        if (!Path.HasExtension(fileName)) fileName = "";
                        if (!string.IsNullOrEmpty(fileName))
                            Console.WriteLine($"[SAVE CALIDAD] Foto preservada: {fileName}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[SAVE CALIDAD] Error preservando foto: {ex.Message}");
                    }
                }

                var novedad = new EncuestaNovedad
                {
                    EncuestaId = encuesta.Id,
                    TipoNovedad = novedadDto.TipoNovedad ?? "",
                    Descripcion = novedadDto.Descripcion,
                    CantidadDefectuosa = novedadDto.CantidadDefectuosa,
                    FotoPath = string.IsNullOrEmpty(fileName) ? null : fileName
                };

                _context.EncuestaNovedades.Add(novedad);
            }

            await _context.SaveChangesAsync();
            Console.WriteLine("[SAVE CALIDAD] Todo guardado exitosamente");

            return CreatedAtAction(nameof(GetEncuesta), new { id = encuesta.Id }, new { id = encuesta.Id });
        }
        catch (Exception ex)
        {
            var fullMsg = $"[SAVE CALIDAD ERROR] {ex.GetType().Name}: {ex.Message}\nStack: {ex.StackTrace}";
            if (ex.InnerException != null)
                fullMsg += $"\nInner ({ex.InnerException.GetType().Name}): {ex.InnerException.Message}\nInner Stack: {ex.InnerException.StackTrace}";
            
            Console.WriteLine(fullMsg);
            // Write to file so we can read it
            try { System.IO.File.AppendAllText("calidad_error.txt", $"{DateTime.Now}: {fullMsg}\n\n"); } catch {}
            
            return StatusCode(500, new { message = "Error interno al guardar la encuesta", details = ex.Message, inner = ex.InnerException?.Message, type = ex.GetType().Name });
        }
    }

    [HttpDelete("encuestas/{id}")]
    public async Task<IActionResult> EliminarEncuesta(int id, [FromQuery] bool preserveFotos = false)
    {
        try
        {
            var encuesta = await _context.EncuestasCalidad
                .Include(e => e.Novedades)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (encuesta == null)
                return NotFound(new { message = $"Encuesta con ID {id} no encontrada" });

            // Solo eliminar fotos del disco si NO se preservan (borrado real, no actualización)
            if (!preserveFotos)
            {
                foreach (var novedad in encuesta.Novedades)
                {
                    if (!string.IsNullOrEmpty(novedad.FotoPath) && System.IO.File.Exists(novedad.FotoPath))
                    {
                        try 
                        { 
                            System.IO.File.Delete(novedad.FotoPath);
                            Console.WriteLine($"Foto eliminada: {novedad.FotoPath}");
                        }
                        catch (Exception ex)
                        {
                            // Log el error pero continúa con la eliminación
                            Console.WriteLine($"Error eliminando foto {novedad.FotoPath}: {ex.Message}");
                        }
                    }
                }
            }
            else
            {
                Console.WriteLine($"Preservando fotos para encuesta {id} (es una actualización)");
            }

            // Eliminar la encuesta (las novedades se eliminarán en cascada)
            _context.EncuestasCalidad.Remove(encuesta);
            await _context.SaveChangesAsync();

            Console.WriteLine($"Encuesta {id} eliminada exitosamente");
            return NoContent();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error eliminando encuesta {id}: {ex.Message}");
            Console.WriteLine($"StackTrace: {ex.StackTrace}");
            return StatusCode(500, new { message = "Error al eliminar la encuesta", error = ex.Message });
        }
    }

    [HttpGet("foto/{fileName}")]
    public IActionResult GetFoto(string fileName)
    {
        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "fotos-calidad", fileName);
        
        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var bytes = System.IO.File.ReadAllBytes(filePath);
        return File(bytes, "image/jpeg");
    }

    [HttpDelete("encuestas/{encuestaId}/novedades/{novedadId}/foto")]
    public async Task<IActionResult> EliminarFotoNovedad(int encuestaId, int novedadId)
    {
        var novedad = await _context.EncuestaNovedades
            .FirstOrDefaultAsync(n => n.EncuestaId == encuestaId && n.Id == novedadId);

        if (novedad == null)
            return NotFound(new { message = "Novedad no encontrada" });

        if (string.IsNullOrEmpty(novedad.FotoPath))
            return Ok(new { message = "No hay foto para eliminar" });

        // Eliminar archivo del disco
        if (System.IO.File.Exists(novedad.FotoPath))
        {
            try 
            { 
                System.IO.File.Delete(novedad.FotoPath); 
            }
            catch (Exception ex) 
            { 
                return StatusCode(500, new { message = "Error al eliminar archivo", error = ex.Message }); 
            }
        }

        // Limpiar referencia en BD
        novedad.FotoPath = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Foto eliminada correctamente" });
    }

    [HttpDelete("novedades/{novedadId}/foto")]
    public async Task<IActionResult> EliminarFotoNovedadDirecto(int novedadId)
    {
        var novedad = await _context.EncuestaNovedades.FindAsync(novedadId);

        if (novedad == null)
            return NotFound(new { message = "Novedad no encontrada" });

        if (string.IsNullOrEmpty(novedad.FotoPath))
            return Ok(new { message = "No hay foto para eliminar" });

        // Eliminar archivo del disco
        if (System.IO.File.Exists(novedad.FotoPath))
        {
            try 
            { 
                System.IO.File.Delete(novedad.FotoPath); 
            }
            catch { /* Ignorar errores */ }
        }

        // Limpiar referencia en BD
        novedad.FotoPath = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Foto eliminada correctamente" });
    }

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] DateTime fechaInicio, [FromQuery] DateTime fechaFin)
    {
        // Ajustar fechaFin al final del día
        fechaFin = fechaFin.Date.AddDays(1).AddTicks(-1);

        var encuestas = await _context.EncuestasCalidad
            .Include(e => e.Operario)
            .Include(e => e.Auxiliar)
            .Include(e => e.Maquina)
            .Include(e => e.Novedades)
            .Where(e => e.FechaCreacion >= fechaInicio && e.FechaCreacion <= fechaFin)
            .OrderByDescending(e => e.FechaCreacion)
            .ToListAsync();

        if (!encuestas.Any())
            return NotFound(new { message = "No se encontraron encuestas en el rango de fechas seleccionado" });

        using var package = new ExcelPackage();

        // ===== HOJA 1: ENCUESTAS =====
        var wsEncuestas = package.Workbook.Worksheets.Add("Encuestas");
        var encHeaders = new[] { "Fecha", "Operario", "Auxiliar", "Máquina", "OP", "Proceso",
            "Cant. Producir", "Cant. Evaluada", "Estado", "Ficha Técnica", "Registro Formatos", "Arranque",
            "Observación", "N° Novedades", "Tipos de Novedad", "Cant. Defectuosa Total" };

        for (int i = 0; i < encHeaders.Length; i++)
        {
            wsEncuestas.Cells[1, i + 1].Value = encHeaders[i];
            wsEncuestas.Cells[1, i + 1].Style.Font.Bold = true;
            wsEncuestas.Cells[1, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            wsEncuestas.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(0, 51, 102));
            wsEncuestas.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        int row = 2;
        foreach (var e in encuestas)
        {
            wsEncuestas.Cells[row, 1].Value = e.FechaCreacion.ToString("dd/MM/yyyy HH:mm");
            wsEncuestas.Cells[row, 2].Value = e.Operario?.Nombre ?? "";
            wsEncuestas.Cells[row, 3].Value = e.Auxiliar?.Nombre ?? "";
            wsEncuestas.Cells[row, 4].Value = e.Maquina?.Nombre ?? "";
            wsEncuestas.Cells[row, 5].Value = e.OrdenProduccion;
            wsEncuestas.Cells[row, 6].Value = e.Proceso;
            wsEncuestas.Cells[row, 7].Value = (double)e.CantidadProducir;
            wsEncuestas.Cells[row, 8].Value = (double)e.CantidadEvaluada;
            wsEncuestas.Cells[row, 9].Value = e.EstadoProceso;
            wsEncuestas.Cells[row, 10].Value = e.TieneFichaTecnica ? "Sí" : "No";
            wsEncuestas.Cells[row, 11].Value = e.CorrectoRegistroFormatos ? "Sí" : "No";
            wsEncuestas.Cells[row, 12].Value = e.AprobacionArranque ? "Sí" : "No";
            wsEncuestas.Cells[row, 13].Value = e.Observacion ?? "";
            wsEncuestas.Cells[row, 14].Value = e.Novedades.Count;
            wsEncuestas.Cells[row, 15].Value = e.Novedades.Any() 
                ? string.Join(", ", e.Novedades.Select(n => n.TipoNovedad)) 
                : "Sin novedades";
            wsEncuestas.Cells[row, 16].Value = e.Novedades.Sum(n => n.CantidadDefectuosa);

            // Color de fondo alterno
            if (row % 2 == 0)
            {
                for (int i = 1; i <= encHeaders.Length; i++)
                {
                    wsEncuestas.Cells[row, i].Style.Fill.PatternType = ExcelFillStyle.Solid;
                    wsEncuestas.Cells[row, i].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(245, 247, 250));
                }
            }
            row++;
        }

        wsEncuestas.Cells[wsEncuestas.Dimension.Address].AutoFitColumns();

        // ===== HOJA 2: NOVEDADES (DETALLE) =====
        var wsNovedades = package.Workbook.Worksheets.Add("Novedades");
        var novHeaders = new[] { "Fecha Encuesta", "Operario", "Máquina", "OP", "Proceso",
            "Estado", "Cant. Producir", "Tipo Novedad", "Descripción", "Cant. Defectuosa", "Observación Encuesta" };

        for (int i = 0; i < novHeaders.Length; i++)
        {
            wsNovedades.Cells[1, i + 1].Value = novHeaders[i];
            wsNovedades.Cells[1, i + 1].Style.Font.Bold = true;
            wsNovedades.Cells[1, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            wsNovedades.Cells[1, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(200, 0, 0));
            wsNovedades.Cells[1, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        row = 2;
        foreach (var e in encuestas)
        {
            foreach (var n in e.Novedades)
            {
                wsNovedades.Cells[row, 1].Value = e.FechaCreacion.ToString("dd/MM/yyyy HH:mm");
                wsNovedades.Cells[row, 2].Value = e.Operario?.Nombre ?? "";
                wsNovedades.Cells[row, 3].Value = e.Maquina?.Nombre ?? "";
                wsNovedades.Cells[row, 4].Value = e.OrdenProduccion;
                wsNovedades.Cells[row, 5].Value = e.Proceso;
                wsNovedades.Cells[row, 6].Value = e.EstadoProceso;
                wsNovedades.Cells[row, 7].Value = (double)e.CantidadProducir;
                wsNovedades.Cells[row, 8].Value = n.TipoNovedad;
                wsNovedades.Cells[row, 9].Value = n.Descripcion ?? "";
                wsNovedades.Cells[row, 10].Value = n.CantidadDefectuosa;
                wsNovedades.Cells[row, 11].Value = e.Observacion ?? "";

                if (row % 2 == 0)
                {
                    for (int i = 1; i <= novHeaders.Length; i++)
                    {
                        wsNovedades.Cells[row, i].Style.Fill.PatternType = ExcelFillStyle.Solid;
                        wsNovedades.Cells[row, i].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(255, 245, 245));
                    }
                }
                row++;
            }
        }

        wsNovedades.Cells[wsNovedades.Dimension.Address].AutoFitColumns();

        var fileName = $"Calidad_{fechaInicio:yyyyMMdd}_{fechaFin:yyyyMMdd}.xlsx";
        var content = package.GetAsByteArray();

        return File(content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    [HttpGet("detalles-op")]
    public async Task<IActionResult> DetallesOP(int mes, int anio)
    {
        // 1. Total OPs trabajadas en el mes - combinar TODAS las fuentes

        // Fuente 1: TiemposProceso (timer)
        var opsTimer = await _context.TiemposProceso
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio && t.OrdenProduccionId != null)
            .Select(t => t.OrdenProduccion!.Numero)
            .ToListAsync();

        // Fuente 2: ProduccionDiaria (reporte diario)
        var opsProduccion = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio 
                && !string.IsNullOrEmpty(p.ReferenciaOP))
            .Select(p => p.ReferenciaOP!)
            .ToListAsync();

        // Fuente 3: ProduccionDiariaDetalle (detalle granular)
        var opsDetalle = await _context.ProduccionDiariaDetalles
            .Include(d => d.ProduccionDiaria)
            .Where(d => d.ProduccionDiaria!.Fecha.Month == mes 
                && d.ProduccionDiaria.Fecha.Year == anio 
                && !string.IsNullOrEmpty(d.ReferenciaOP))
            .Select(d => d.ReferenciaOP!)
            .ToListAsync();

        // Combine all sources, split compound OPs (e.g. "7439-7440-7422"), 
        // exclude OP 460 (internal use only), and deduplicate
        var todasLasOPs = opsTimer
            .Union(opsProduccion)
            .Union(opsDetalle)
            .SelectMany(op => op.Contains("-") 
                ? op.Split('-', StringSplitOptions.RemoveEmptyEntries) 
                : new[] { op })
            .Select(op => op.Trim())
            .Where(op => !string.IsNullOrEmpty(op) && op != "460")
            .Distinct()
            .OrderBy(op => op)
            .ToList();

        // Build the list for the PDF table
        var listaOPsTrabajadas = todasLasOPs
            .Select(op => new { op })
            .ToList();

        // 2. OPs inspeccionadas (de EncuestasCalidad)
        var opsInspeccionadas = await _context.EncuestasCalidad
            .Where(e => e.FechaCreacion.Month == mes && e.FechaCreacion.Year == anio)
            .GroupBy(e => e.OrdenProduccion)
            .Select(g => new { OP = g.Key, CantidadInspecciones = g.Count() })
            .OrderByDescending(x => x.CantidadInspecciones)
            .ToListAsync();

        var opsInspeccionadasUnicas = opsInspeccionadas.Select(x => x.OP).Distinct().Count();

        return Ok(new
        {
            totalOPsTrabajadas = todasLasOPs.Count,
            totalOPsInspeccionadas = opsInspeccionadasUnicas,
            detalleOPs = opsInspeccionadas,
            listaOPsTrabajadas = listaOPsTrabajadas
        });
    }

}
