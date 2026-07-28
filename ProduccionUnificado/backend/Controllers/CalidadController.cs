using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Helpers;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using OfficeOpenXml.Drawing;

namespace TiempoProcesos.API.Controllers;

[Authorize]
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

    [AllowAnonymous]
    [HttpGet("procesos")]
    public ActionResult<IEnumerable<string>> GetProcesos()
    {
        return Ok(Procesos);
    }

    [AllowAnonymous]
    [HttpGet("novedades")]
    public ActionResult<IEnumerable<string>> GetTiposNovedad()
    {
        return Ok(TiposNovedad);
    }

    [AllowAnonymous]
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

    /// <summary>
    /// Índice de encuestas por OP: para cada OP devuelve los IDs de encuestas
    /// de calidad de planta (EncuestasCalidad) y calidad externa (EncuestasCalidadTalleres).
    /// Usado por el Historial para mostrar botones de revisión junto a cada OP.
    /// </summary>
    [HttpGet("encuestas-por-op")]
    public async Task<IActionResult> GetIndiceEncuestasPorOp()
    {
        var planta = await _context.EncuestasCalidad
            .AsNoTracking()
            .Select(e => new { e.Id, e.OrdenProduccion })
            .ToListAsync();

        var externa = await _context.EncuestasCalidadTalleres
            .AsNoTracking()
            .Select(e => new { e.Id, e.OrdenProduccion })
            .ToListAsync();

        static string NormalizarOp(string? op)
        {
            if (string.IsNullOrWhiteSpace(op)) return "";
            var digits = new string(op.Where(char.IsDigit).ToArray());
            return digits.TrimStart('0');
        }

        var indice = new Dictionary<string, (List<int> Planta, List<int> Externa)>();

        foreach (var e in planta)
        {
            var key = NormalizarOp(e.OrdenProduccion);
            if (key.Length == 0) continue;
            if (!indice.TryGetValue(key, out var entry)) entry = (new List<int>(), new List<int>());
            entry.Planta.Add(e.Id);
            indice[key] = entry;
        }

        foreach (var e in externa)
        {
            var key = NormalizarOp(e.OrdenProduccion);
            if (key.Length == 0) continue;
            if (!indice.TryGetValue(key, out var entry)) entry = (new List<int>(), new List<int>());
            entry.Externa.Add(e.Id);
            indice[key] = entry;
        }

        return Ok(indice.Select(kv => new
        {
            op = kv.Key,
            planta = kv.Value.Planta,
            externa = kv.Value.Externa,
        }));
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

    [AllowAnonymous]
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
                FechaCreacion = ColombiaTime.Now
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

    [AllowAnonymous]
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

    private static readonly string[] EstadosInformeSemanal = { "Conforme", "No conforme", "En revision" };

    /// <summary>
    /// Excel de calidad en una sola hoja (formato informe semanal).
    /// </summary>
    [HttpGet("export-excel")]
    public Task<IActionResult> ExportExcel([FromQuery] DateTime fechaInicio, [FromQuery] DateTime fechaFin)
        => GenerarExcelInformeCalidadAsync(fechaInicio, fechaFin, "Calidad");

    [HttpGet("informe-semanal")]
    public async Task<ActionResult<IEnumerable<InformeSemanalLineaDto>>> GetInformeSemanal(
        [FromQuery] DateTime fechaInicio,
        [FromQuery] DateTime fechaFin)
    {
        var lineas = await ConstruirLineasInformeSemanalAsync(fechaInicio, fechaFin);
        return Ok(lineas);
    }

    [HttpGet("informe-semanal/export-excel")]
    public Task<IActionResult> ExportInformeSemanalExcel(
        [FromQuery] DateTime fechaInicio,
        [FromQuery] DateTime fechaFin)
        => GenerarExcelInformeCalidadAsync(fechaInicio, fechaFin, "Informe_Semanal_Calidad");

    private async Task<IActionResult> GenerarExcelInformeCalidadAsync(
        DateTime fechaInicio,
        DateTime fechaFin,
        string fileNamePrefix)
    {
        try
        {
            var lineas = await ConstruirLineasInformeSemanalAsync(fechaInicio, fechaFin);
            if (lineas.Count == 0)
                return NotFound(new { message = "No se encontraron defectos en el rango de fechas seleccionado" });

            var inicio = fechaInicio.Date;
            var fin = fechaFin.Date;
            const int colCount = 8;

            using var package = new ExcelPackage();
            var ws = package.Workbook.Worksheets.Add("Informe");

            ws.Cells[1, 1, 1, colCount].Merge = true;
            ws.Cells[1, 1].Value = "INFORME DE CONTROL DE CALIDAD EN PROCESO - SEMANAL";
            ws.Cells[1, 1].Style.Font.Bold = true;
            ws.Cells[1, 1].Style.Font.Size = 14;
            ws.Cells[1, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
            ws.Cells[1, 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
            ws.Cells[1, 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(30, 58, 95));
            ws.Cells[1, 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
            ws.Row(1).Height = 28;

            ws.Cells[2, 1, 2, colCount].Merge = true;
            ws.Cells[2, 1].Value = $"Periodo: {inicio:dd/MM/yyyy} — {fin:dd/MM/yyyy}";
            ws.Cells[2, 1].Style.Font.Italic = true;
            ws.Cells[2, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;

            // Columna 8 sin título: celda libre para anotaciones manuales
            var headers = new[]
            {
                "N°", "FOTO", "REFERENCIA", "DEFECTO ENCONTRADO", "OBSERVACIONES", "CANTIDAD", "ESTADO", "ANOTACIONES"
            };
            const int headerRow = 4;
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cells[headerRow, i + 1].Value = headers[i];
                ws.Cells[headerRow, i + 1].Style.Font.Bold = true;
                ws.Cells[headerRow, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[headerRow, i + 1].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(30, 58, 95));
                ws.Cells[headerRow, i + 1].Style.Font.Color.SetColor(System.Drawing.Color.White);
                ws.Cells[headerRow, i + 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                ws.Cells[headerRow, i + 1].Style.Border.BorderAround(ExcelBorderStyle.Thin);
            }

            ws.Column(1).Width = 6;
            ws.Column(2).Width = 16;
            ws.Column(3).Width = 14;
            ws.Column(4).Width = 34;
            ws.Column(5).Width = 48;
            ws.Column(6).Width = 14;
            ws.Column(7).Width = 16;
            ws.Column(8).Width = 36;

            int row = headerRow + 1;
            // Mantener streams abiertos hasta GetAsByteArray: cerrarlos antes corrompe el xlsx.
            var imageStreams = new List<MemoryStream>();
            try
            {
                foreach (var linea in lineas)
                {
                    ws.Cells[row, 1].Value = linea.Numero;
                    ws.Cells[row, 1].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                    ws.Cells[row, 1].Style.VerticalAlignment = ExcelVerticalAlignment.Center;

                    var fotoPath = ResolverRutaFotoLocal(linea.FotoUrl);
                    var fotoOk = false;
                    if (fotoPath != null)
                    {
                        try
                        {
                            fotoOk = TryEmbedFoto(ws, $"foto_{linea.NovedadId}_{row}", fotoPath, row, imageStreams);
                        }
                        catch (Exception exFoto)
                        {
                            Console.WriteLine($"[EXCEL CALIDAD] Foto omitida {fotoPath}: {exFoto.Message}");
                        }

                        if (!fotoOk)
                            ws.Cells[row, 2].Value = "—";
                    }

                    ws.Cells[row, 3].Value = linea.Referencia;
                    ws.Cells[row, 4].Value = linea.DefectoEncontrado;
                    ws.Cells[row, 5].Value = linea.Observaciones ?? "";
                    ws.Cells[row, 6].Value = linea.Cantidad ?? "";
                    ws.Cells[row, 6].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                    ws.Cells[row, 7].Value = string.IsNullOrWhiteSpace(linea.Estado)
                        ? EstadosInformeSemanal[2]
                        : linea.Estado;
                    ws.Cells[row, 8].Value = ""; // anotaciones a mano

                    ws.Cells[row, 3, row, 8].Style.WrapText = true;
                    ws.Cells[row, 1, row, colCount].Style.VerticalAlignment = ExcelVerticalAlignment.Center;
                    for (int c = 1; c <= colCount; c++)
                        ws.Cells[row, c].Style.Border.BorderAround(ExcelBorderStyle.Thin);

                    if (row % 2 == 0)
                    {
                        ws.Cells[row, 1, row, colCount].Style.Fill.PatternType = ExcelFillStyle.Solid;
                        ws.Cells[row, 1, row, colCount].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(245, 247, 250));
                    }

                    ws.Row(row).Height = fotoOk ? 72 : 28;
                    row++;
                }

                if (row > headerRow + 1)
                {
                    var estadoRange = ws.Cells[headerRow + 1, 7, row - 1, 7];
                    var estadoValidation = ws.DataValidations.AddListValidation(estadoRange.Address);
                    estadoValidation.ShowErrorMessage = true;
                    estadoValidation.ErrorTitle = "Estado no válido";
                    estadoValidation.Error = "Seleccione: Conforme, No conforme o En revision";
                    estadoValidation.Formula.Values.Add("Conforme");
                    estadoValidation.Formula.Values.Add("No conforme");
                    estadoValidation.Formula.Values.Add("En revision");
                }

                ws.View.FreezePanes(headerRow + 1, 1);

                var fileName = $"{fileNamePrefix}_{inicio:yyyyMMdd}_{fin:yyyyMMdd}.xlsx";
                Response.Headers.Append("Cache-Control", "no-store");
                var bytes = package.GetAsByteArray();
                return File(bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    fileName);
            }
            finally
            {
                foreach (var s in imageStreams)
                {
                    try { s.Dispose(); } catch { /* ignore */ }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GenerarExcelInformeCalidad: {ex.Message}");
            return StatusCode(500, new { message = "Error al generar el Excel de calidad.", details = ex.Message });
        }
    }

    private async Task<List<InformeSemanalLineaDto>> ConstruirLineasInformeSemanalAsync(DateTime fechaInicio, DateTime fechaFin)
    {
        var inicio = fechaInicio.Date;
        var fin = fechaFin.Date.AddDays(1).AddTicks(-1);

        var novedades = await _context.EncuestaNovedades
            .AsNoTracking()
            .Include(n => n.Encuesta)
            .Where(n =>
                n.Encuesta != null &&
                n.Encuesta.FechaCreacion >= inicio &&
                n.Encuesta.FechaCreacion <= fin &&
                (n.TipoNovedad == null || n.TipoNovedad.ToLower() != "sin hallazgos"))
            .OrderBy(n => n.Encuesta!.FechaCreacion)
            .ThenBy(n => n.Id)
            .ToListAsync();

        var numerosOp = novedades
            .Select(n => ExtraerNumeroOp(n.Encuesta!.OrdenProduccion))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var referenciasCatalogo = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (numerosOp.Count > 0)
        {
            var catalogoRows = await _context.CatalogoOrdenesProduccion
                .AsNoTracking()
                .Where(c => numerosOp.Contains(c.Numero))
                .OrderByDescending(c => c.FechaActualizacion)
                .ToListAsync();

            foreach (var grupo in catalogoRows.GroupBy(c => c.Numero, StringComparer.OrdinalIgnoreCase))
                referenciasCatalogo[grupo.Key] = grupo.First().Referencia ?? grupo.Key;
        }

        var lineas = new List<InformeSemanalLineaDto>();
        var numero = 1;
        foreach (var novedad in novedades)
        {
            var encuesta = novedad.Encuesta!;
            var opNum = ExtraerNumeroOp(encuesta.OrdenProduccion);
            var referencia = !string.IsNullOrWhiteSpace(opNum) && referenciasCatalogo.TryGetValue(opNum!, out var refCat)
                ? refCat
                : (string.IsNullOrWhiteSpace(opNum) ? encuesta.OrdenProduccion : opNum!);

            // En el informe histórico la columna REFERENCIA muestra el código corto (OP / ref. catálogo).
            // Si el catálogo trae texto largo, preferimos el número de OP para que coincida con el formato semanal.
            if (!string.IsNullOrWhiteSpace(opNum) && referencia.Length > 12)
                referencia = opNum!;

            lineas.Add(new InformeSemanalLineaDto
            {
                NovedadId = novedad.Id,
                Numero = numero++,
                FotoUrl = novedad.FotoPath != null ? $"fotos-calidad/{Path.GetFileName(novedad.FotoPath)}" : null,
                Referencia = referencia,
                DefectoEncontrado = novedad.TipoNovedad,
                Observaciones = ResolverObservacionesInforme(encuesta, novedad),
                Cantidad = FormatearCantidadInforme(encuesta),
                Estado = string.IsNullOrWhiteSpace(novedad.InformeEstado) ? null : novedad.InformeEstado.Trim(),
                FechaEncuesta = encuesta.FechaCreacion,
                OrdenProduccion = encuesta.OrdenProduccion,
            });
        }

        return lineas;
    }

    private static string? ResolverObservacionesInforme(EncuestaCalidad encuesta, EncuestaNovedad novedad)
    {
        if (!string.IsNullOrWhiteSpace(novedad.InformeObservaciones))
            return novedad.InformeObservaciones.Trim();

        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(encuesta.Observacion))
            partes.Add(encuesta.Observacion.Trim());
        if (!string.IsNullOrWhiteSpace(novedad.Descripcion))
            partes.Add(novedad.Descripcion.Trim());

        return partes.Count == 0 ? null : string.Join(" | ", partes);
    }

    private static string FormatearCantidadInforme(EncuestaCalidad encuesta)
    {
        // Formato histórico del informe: producir/evaluada (ej. 2200/2025)
        var producir = encuesta.CantidadProducir % 1 == 0
            ? ((long)encuesta.CantidadProducir).ToString()
            : encuesta.CantidadProducir.ToString("0.##");
        var evaluada = encuesta.CantidadEvaluada % 1 == 0
            ? ((long)encuesta.CantidadEvaluada).ToString()
            : encuesta.CantidadEvaluada.ToString("0.##");
        return $"{producir}/{evaluada}";
    }

    private static string? ExtraerNumeroOp(string? ordenProduccion)
    {
        if (string.IsNullOrWhiteSpace(ordenProduccion)) return null;
        var parte = ordenProduccion
            .Split(new[] { '-', '/', ' ', '_' }, StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault()
            ?.Trim();
        if (string.IsNullOrWhiteSpace(parte)) return null;
        var digits = new string(parte.Where(char.IsDigit).ToArray());
        return string.IsNullOrEmpty(digits) ? parte : digits;
    }

    private static bool TryEmbedFoto(
        ExcelWorksheet ws,
        string pictureName,
        string fotoPath,
        int row,
        List<MemoryStream> keepAliveStreams)
    {
        var bytes = System.IO.File.ReadAllBytes(fotoPath);
        if (bytes.Length < 24)
            return false;

        var pictureType = DetectPictureType(bytes);
        if (pictureType == null)
            return false;

        var ms = new MemoryStream(bytes);
        keepAliveStreams.Add(ms);
        ms.Position = 0;

        var picture = ws.Drawings.AddPicture(pictureName, ms, pictureType.Value);
        picture.SetPosition(row - 1, 4, 1, 4);
        picture.SetSize(90, 90);
        return true;
    }

    private static ePictureType? DetectPictureType(byte[] bytes)
    {
        // JPEG
        if (bytes.Length > 2 && bytes[0] == 0xFF && bytes[1] == 0xD8)
            return ePictureType.Jpg;
        // PNG
        if (bytes.Length > 7 &&
            bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            return ePictureType.Png;
        // GIF
        if (bytes.Length > 5 && bytes[0] == (byte)'G' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F')
            return ePictureType.Gif;
        // BMP
        if (bytes.Length > 1 && bytes[0] == (byte)'B' && bytes[1] == (byte)'M')
            return ePictureType.Bmp;
        // WEBP (RIFF....WEBP)
        if (bytes.Length > 11 &&
            bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F' &&
            bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
            return ePictureType.WebP;

        return null;
    }

    private string? ResolverRutaFotoLocal(string? fotoPath)
    {
        if (string.IsNullOrWhiteSpace(fotoPath)) return null;

        var fileName = Path.GetFileName(fotoPath.Replace('\\', '/').Split('/').Last());
        if (string.IsNullOrEmpty(fileName)) return null;

        var candidatos = new List<string>();

        if (!string.IsNullOrWhiteSpace(_env.WebRootPath))
            candidatos.Add(Path.Combine(_env.WebRootPath, "fotos-calidad", fileName));

        candidatos.Add(Path.Combine(_env.ContentRootPath, "wwwroot", "fotos-calidad", fileName));
        candidatos.Add(Path.Combine(_env.ContentRootPath, "publish", "wwwroot", "fotos-calidad", fileName));

        if (Path.IsPathRooted(fotoPath))
            candidatos.Add(fotoPath);

        return candidatos.FirstOrDefault(System.IO.File.Exists);
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
