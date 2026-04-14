using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Services;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

// [Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProduccionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITiempoProcesoService _tiempoProcesoService;
    private readonly IWebHostEnvironment _env;

    public ProduccionController(AppDbContext context, ITiempoProcesoService tiempoProcesoService, IWebHostEnvironment env)
    {
        _context = context;
        _tiempoProcesoService = tiempoProcesoService;
        _env = env;
    }

    [HttpGet("maestros")]
    public async Task<ActionResult> GetMaestros()
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var proveedores = await _context.Produccion_Proveedores.Where(p => p.Activo).ToListAsync();
        var tiposHora = await _context.Produccion_TiposHora.Where(t => t.Activo).ToListAsync();
        var tiposRecargo = await _context.Produccion_TiposRecargo.Where(t => t.Activo).ToListAsync();
        
        // Existing tables
        var maquinas = await _context.Maquinas.Where(m => m.Activo && m.Nombre != null && !m.Nombre.Contains("TERMINADOS")).Select(m => new { m.Id, m.Nombre }).ToListAsync();
        
        // Ordenamiento Natural (1, 2, ... 10)
        maquinas = maquinas.OrderBy(m => 
        {
            var match = System.Text.RegularExpressions.Regex.Match(m.Nombre ?? "", @"^\d+");
            return match.Success ? int.Parse(match.Value) : int.MaxValue;
        })
        .ThenBy(m => m.Nombre ?? "")
        .ToList();

        var usuarios = await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new { u.Id, u.Nombre, u.Salario, u.Documento }) // Include Salario and Documento
            .ToListAsync();

        return Ok(new
        {
            rubros,
            proveedores,
            tiposHora,
            tiposRecargo,
            maquinas,
            usuarios
        });
    }









    /// <summary>
    /// Get available periods (month/year combinations) with production data
    /// </summary>
    [HttpGet("periodos-disponibles")]
    public async Task<ActionResult> GetPeriodosDisponibles()
    {
        var periodos = await _context.ProduccionDiaria
            .Select(p => new { Mes = p.Fecha.Month, Anio = p.Fecha.Year })
            .Distinct()
            .OrderByDescending(p => p.Anio)
            .ThenByDescending(p => p.Mes)
            .ToListAsync();
        return Ok(periodos);
    }

    /// <summary>
    /// Get operators that have production data for a given month/year
    /// Returns grouped by usuario+maquina with days count for CaptureGridScreen modal
    /// </summary>
    [HttpGet("operarios-con-datos")]
    public async Task<ActionResult> GetOperariosConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => new {
                usuarioId = g.Key.UsuarioId,
                usuarioNombre = g.First().Usuario != null ? g.First().Usuario.Nombre : "Desconocido",
                maquinaId = g.Key.MaquinaId,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.usuarioNombre)
            .ThenBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get machines that have production data for a given month/year
    /// Returns with maquinaId, maquinaNombre, and diasRegistrados for CaptureGridScreen modal
    /// </summary>
    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult> GetMaquinasConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => p.MaquinaId)
            .Select(g => new {
                maquinaId = g.Key,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get detailed daily production records for a specific operator and machine
    /// Used by CaptureGridScreen to populate the grid
    /// </summary>
    [HttpGet("detalles")]
    public async Task<ActionResult> GetDetalles(int mes, int anio, int maquinaId, int usuarioId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }

    /// <summary>
    /// Get detailed daily production records for a specific machine (all operators)
    /// Used by CaptureGridScreen when filtered by machine
    /// </summary>
    [HttpGet("detalles-maquina")]
    public async Task<ActionResult> GetDetallesMaquina(int mes, int anio, int maquinaId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }


    /// <summary>
    /// Delete production data for a specific period, optionally filtered by user or machine
    /// </summary>
    [HttpDelete("borrar")]
    public async Task<IActionResult> BorrarProduccion(int mes, int anio, int? usuarioId = null, int? maquinaId = null)
    {
        // 1. Borrar de ProduccionDiaria
        var query = _context.ProduccionDiaria.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        // Queries para TiemposProceso y RegistrosDesperdicio
        var queryTiempos = _context.TiemposProceso.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);
        var queryDesperdicios = _context.RegistrosDesperdicio.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (usuarioId.HasValue)
        {
            query = query.Where(p => p.UsuarioId == usuarioId.Value);
            queryTiempos = queryTiempos.Where(p => p.UsuarioId == usuarioId.Value);
            queryDesperdicios = queryDesperdicios.Where(p => p.UsuarioId == usuarioId.Value);
        }

        if (maquinaId.HasValue)
        {
            query = query.Where(p => p.MaquinaId == maquinaId.Value);
            queryTiempos = queryTiempos.Where(p => p.MaquinaId == maquinaId.Value);
            queryDesperdicios = queryDesperdicios.Where(p => p.MaquinaId == maquinaId.Value);
        }

        var records = await query.ToListAsync();
        var tiempos = await queryTiempos.ToListAsync();
        var desperdicios = await queryDesperdicios.ToListAsync();

        if (!records.Any() && !tiempos.Any())
        {
            return NotFound("No se encontraron registros para borrar con los filtros proporcionados.");
        }

        _context.ProduccionDiaria.RemoveRange(records);
        _context.TiemposProceso.RemoveRange(tiempos);
        _context.RegistrosDesperdicio.RemoveRange(desperdicios);

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Se eliminaron {records.Count} de resumen, {tiempos.Count} detalles y {desperdicios.Count} desperdicios." });
    }

    [HttpPost("importar-excel")]
    public async Task<IActionResult> ImportarExcel(IFormFile file, [FromForm] int? maquinaId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No se ha subido ningún archivo" });

        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "El archivo debe ser un Excel (.xlsx)" });

        try
        {
            using (var stream = new MemoryStream())
            {
                await file.CopyToAsync(stream);
                OfficeOpenXml.ExcelPackage.License.SetNonCommercialOrganization("AlephImpresores");
                using (var package = new OfficeOpenXml.ExcelPackage(stream))
                {
                    var worksheet = package.Workbook.Worksheets[0]; // Leer la primera hoja
                    
                    if (worksheet.Dimension == null)
                        return BadRequest(new { error = "El archivo Excel no tiene un área con datos definida (hoja vacía)" });

                    var rowCount = worksheet.Dimension.Rows;
                    var colCount = worksheet.Dimension.Columns;

                    if (rowCount < 2) 
                        return BadRequest(new { error = "El archivo Excel está vacío o no tiene datos" });

                    // 1. Pre-cargar maestros para optimizar y permitir búsqueda flexible
                    var usuarios = await _context.Usuarios.ToListAsync();
                    var maquinas = await _context.Maquinas.ToListAsync();
                    var actividades = await _context.Actividades.ToListAsync();

                    var headers = new Dictionary<string, int>();
                    for (int col = 1; col <= colCount; col++)
                    {
                        var cabecera = worksheet.Cells[1, col].Value?.ToString()?.ToLower().Trim() ?? "";
                        if (!string.IsNullOrEmpty(cabecera)) headers[cabecera] = col;
                    }

                    // 2. Validar columnas mínimas
                    bool hasMaquina = headers.ContainsKey("maquina") || headers.ContainsKey("máquina");
                    if (!headers.ContainsKey("fecha") || (!hasMaquina && maquinaId == null))
                        return BadRequest(new { error = "El Excel debe contener la columna 'Fecha'. La columna 'Maquina' es necesaria si no se selecciona una en la pantalla." });

                    var filasExcel = new List<ProduccionDiariaDetalleDto>();
                    var agrupaciones = new Dictionary<string, ProduccionDiariaDto>();

                    // Procesar filas
                    for (int row = 2; row <= rowCount; row++)
                    {
                        try 
                        {
                            var fechaVal = worksheet.Cells[row, headers.ContainsKey("fecha") ? headers["fecha"] : 1].Value;
                            if (fechaVal == null) continue;

                            DateTime fecha;
                            if (fechaVal is DateTime dt) fecha = dt;
                            else if (!DateTime.TryParse(fechaVal.ToString(), out fecha)) continue;

                             // Obtener Máquina
                            var maquina = maquinas.FirstOrDefault(m => m.Id == maquinaId); // Prioridad al fallback si se pasa explícitamente y no hay columna
                            
                            if (hasMaquina)
                            {
                                string maquinaNombre = (headers.ContainsKey("maquina") ? worksheet.Cells[row, headers["maquina"]].Value?.ToString() : null)
                                                     ?? (headers.ContainsKey("máquina") ? worksheet.Cells[row, headers["máquina"]].Value?.ToString() : "") ?? "";
                                
                                var maquinaExt = maquinas.FirstOrDefault(m => string.Equals(m.Nombre, maquinaNombre, StringComparison.OrdinalIgnoreCase))
                                              ?? maquinas.FirstOrDefault(m => m.Nombre.ToLower().Contains(maquinaNombre.ToLower()) && maquinaNombre.Length > 3);
                                
                                if (maquinaExt != null) maquina = maquinaExt;
                            }

                            if (maquina == null) continue;

                            // Obtener Operario (Fuzzy Match)
                            string operarioExcel = (headers.ContainsKey("operario") ? worksheet.Cells[row, headers["operario"]].Value?.ToString() : null)
                                                   ?? (headers.ContainsKey("nombre") ? worksheet.Cells[row, headers["nombre"]].Value?.ToString() : "") ?? "";
                            
                            var usuario = BusquedaFuzzyUsuario(usuarios, operarioExcel);
                            if (usuario == null) usuario = usuarios.FirstOrDefault(u => u.Nombre == "Operario General");

                            // Obtener Actividad
                            string actividadExcel = GetStringFromCell(worksheet, row, headers, "actividad") ?? "";
                            string actLower = actividadExcel.ToLower();
                            Actividad actividad = null;

                            // 1. Intentar hacer match por el código numérico si existe al inicio de la cadena (ej. "08 - Tiempo Muerto")
                            var matchCode = System.Text.RegularExpressions.Regex.Match(actividadExcel, @"^(\d{1,2})\b");
                            if (matchCode.Success)
                            {
                                string potentialCode = matchCode.Groups[1].Value.PadLeft(2, '0');
                                actividad = actividades.FirstOrDefault(a => a.Codigo == potentialCode);
                            }

                            // 2. Si no hay match por código, intentar por nombre contenido completo
                            if (actividad == null)
                            {
                                actividad = actividades.FirstOrDefault(a => actLower.Contains(a.Nombre.ToLower()));
                            }

                            // 3. Match flexible por palabras clave comunes si el nombre exacto falló
                            if (actividad == null)
                            {
                                if (actLower.Contains("tiempo muerto") || actLower.Contains("otros muertos")) actividad = actividades.FirstOrDefault(a => a.Codigo == "08");
                                else if (actLower.Contains("falta") && actLower.Contains("trabajo")) actividad = actividades.FirstOrDefault(a => a.Codigo == "13");
                                else if (actLower.Contains("reparacion") || actLower.Contains("reparación")) actividad = actividades.FirstOrDefault(a => a.Codigo == "03");
                                else if (actLower.Contains("mantenimiento")) actividad = actividades.FirstOrDefault(a => a.Codigo == "10");
                                else if (actLower.Contains("descanso") || actLower.Contains("alimento")) actividad = actividades.FirstOrDefault(a => a.Codigo == "04");
                                else if (actLower.Contains("puesta a punto")) actividad = actividades.FirstOrDefault(a => a.Codigo == "01");
                                else if (actLower.Contains("auxiliar") || actLower.Contains("otros tiempo")) actividad = actividades.FirstOrDefault(a => a.Codigo == "14");
                            }

                            // 4. Default: Producción
                            if (actividad == null)
                            {
                                actividad = actividades.FirstOrDefault(a => a.Nombre == "Producción" || a.Codigo == "02");
                            }

                            // Crear Detalle
                            var detalle = new ProduccionDiariaDetalleDto
                            {
                                HoraInicio = GetStringFromCell(worksheet, row, headers, "inicio") ?? "",
                                HoraFin = GetStringFromCell(worksheet, row, headers, "final") ?? "",
                                ActividadId = actividad?.Id ?? 2,
                                ReferenciaOP = GetStringFromCell(worksheet, row, headers, "orden"),
                                Tiros = (int)(GetDecimalFromCell(worksheet, row, headers, "tiros") ?? 0),
                                Observaciones = GetStringFromCell(worksheet, row, headers, "observacio")
                            };

                            // Agrupar por Fecha, Máquina y Usuario
                            string key = $"{fecha:yyyy-MM-dd}_{maquina.Id}_{usuario?.Id}";
                            if (!agrupaciones.ContainsKey(key))
                            {
                                agrupaciones[key] = new ProduccionDiariaDto
                                {
                                    Fecha = fecha.ToString("yyyy-MM-dd"),
                                    MaquinaId = maquina.Id,
                                    UsuarioId = usuario?.Id ?? 0,
                                    DiaLaborado = 1,
                                    Detalles = new List<ProduccionDiariaDetalleDto>(),
                                    Novedades = "" // Se llenará con la suma de observaciones
                                };
                            }

                            agrupaciones[key].Detalles.Add(detalle);
                            
                            // --- AGREGACIÓN DE TOTALES PARA EL HEADER ---
                            TimeSpan rowStart = ParseTime(detalle.HoraInicio);
                            TimeSpan rowEnd = ParseTime(detalle.HoraFin);
                            double duration = (rowEnd - rowStart).TotalHours;
                            if (duration < 0) duration += 24; // Cruce de medianoche

                            decimal dDuration = (decimal)duration;
                            string actName = actividad?.Nombre.ToLower() ?? "";

                            // Mapeo similar al del frontend
                            if (actName.Contains("producc")) agrupaciones[key].HorasOperativas += dDuration;
                            else if (actName.Contains("puesta a punto")) agrupaciones[key].TiempoPuestaPunto += dDuration;
                            else if (actName.Contains("mantenimiento")) agrupaciones[key].HorasMantenimiento += dDuration;
                            else if (actName.Contains("descanso") || actName.Contains("alimento")) agrupaciones[key].HorasDescanso += dDuration;
                            else if (actName.Contains("falta de trabajo")) agrupaciones[key].TiempoFaltaTrabajo += dDuration;
                            else if (actName.Contains("reparacion") || actName.Contains("reparación")) agrupaciones[key].TiempoReparacion += dDuration;
                            else if (actName.Contains("tiempo muerto")) agrupaciones[key].TiempoOtroMuerto += dDuration;
                            else if (actName.Contains("otros tiempo") || actName.Contains("otros auxiliar")) agrupaciones[key].HorasOtrosAux += dDuration;

                            if (maquina.Id == 11 && (actName.Contains("muert") || actividadExcel.Contains("08")))
                            {
                                Console.WriteLine($"[MAQ11 DEBUG] Fecha: {fecha:yyyy-MM-dd} | ActOrig: {actividadExcel} -> ActMatch: {actName} (Code: {actividad?.Codigo}) | Ini: {detalle.HoraInicio} Fin: {detalle.HoraFin} -> Dur: {duration}hs");
                            }

                            agrupaciones[key].TirosDiarios += detalle.Tiros;
                            agrupaciones[key].RendimientoFinal = agrupaciones[key].TirosDiarios;
                            agrupaciones[key].Desperdicio += (decimal)(GetDecimalFromCell(worksheet, row, headers, "desperdicio") ?? 0);

                            // Cambios (Incrementar si es Puesta a Punto con OP nueva)
                            if (actName.Contains("puesta a punto"))
                            {
                                string opActual = (detalle.ReferenciaOP ?? "").Trim();
                                // Si es el primer detalle o la OP cambió respecto al último registro de este grupo (simplificado)
                                // En el excel granular, solemos contar un cambio por cada bloque de puesta a punto con OP válida.
                                if (!string.IsNullOrEmpty(opActual) && opActual != "460") {
                                    // Para no sobre-contar, comparamos con la última OP agregada a la lista de OPs del grupo
                                    if (!agrupaciones[key].ReferenciaOP?.Contains(opActual) ?? true) {
                                        agrupaciones[key].Cambios++;
                                    }
                                }
                            }

                            // Concatenar OPs (únicas y ordenadas por aparición)
                            if (!string.IsNullOrEmpty(detalle.ReferenciaOP) && detalle.ReferenciaOP != "460")
                            {
                                if (string.IsNullOrEmpty(agrupaciones[key].ReferenciaOP)) 
                                    agrupaciones[key].ReferenciaOP = detalle.ReferenciaOP;
                                else if (!agrupaciones[key].ReferenciaOP.Contains(detalle.ReferenciaOP))
                                    agrupaciones[key].ReferenciaOP += "-" + detalle.ReferenciaOP;
                            }

                            // Rango de horas del día
                            // Agregación inteligente: 
                            // 1. HoraInicio: El menor valor que sea mayor a 00:00.
                            // 2. HoraFin: El mayor valor encontrado.
                            
                            TimeSpan currentStart = string.IsNullOrEmpty(agrupaciones[key].HoraInicio) ? TimeSpan.Zero : ParseTime(agrupaciones[key].HoraInicio);
                            TimeSpan currentFin = string.IsNullOrEmpty(agrupaciones[key].HoraFin) ? TimeSpan.Zero : ParseTime(agrupaciones[key].HoraFin);

                            // Si el nuevo rowStart es > 0, y (el actual es 0 o el nuevo es menor), actualizar.
                            if (rowStart != TimeSpan.Zero) {
                                if (currentStart == TimeSpan.Zero || rowStart < currentStart) {
                                    agrupaciones[key].HoraInicio = detalle.HoraInicio;
                                }
                            }

                            // Si el nuevo rowEnd es mayor al actual, actualizar.
                            if (rowEnd > currentFin) {
                                agrupaciones[key].HoraFin = detalle.HoraFin;
                            }



                            if (!string.IsNullOrEmpty(detalle.Observaciones) && !agrupaciones[key].Novedades.Contains(detalle.Observaciones))
                            {
                                agrupaciones[key].Novedades += (string.IsNullOrEmpty(agrupaciones[key].Novedades) ? "" : "; ") + detalle.Observaciones;
                            }

                            // Totales Productivos
                            agrupaciones[key].TotalHorasProductivas = agrupaciones[key].HorasOperativas + agrupaciones[key].TiempoPuestaPunto;
                            if (agrupaciones[key].TotalHorasProductivas > 0)
                                agrupaciones[key].PromedioHoraProductiva = (agrupaciones[key].RendimientoFinal + (agrupaciones[key].Cambios * maquina.TirosReferencia)) / agrupaciones[key].TotalHorasProductivas;
                            
                            Console.WriteLine($"[IMPORT DEBUG] Key: {key}, Op: {usuario.Nombre}, HorasOp: {agrupaciones[key].HorasOperativas}, Tiros: {agrupaciones[key].TirosDiarios}, Inicio: {agrupaciones[key].HoraInicio}");

                        }
                        catch (Exception exRow)
                        {
                            Console.WriteLine($"Error procesando fila {row}: {exRow.Message}");
                        }
                    }

                    if (agrupaciones.Any())
                    {
                        // Retornar para previsualización
                        var res = agrupaciones.Values.Select(v => new {
                            v.Fecha,
                            v.MaquinaId,
                            MaquinaNombre = maquinas.FirstOrDefault(m => m.Id == v.MaquinaId)?.Nombre,
                            v.UsuarioId,
                            UsuarioNombre = usuarios.FirstOrDefault(u => u.Id == v.UsuarioId)?.Nombre,
                            FilasDetalle = v.Detalles.Count,
                            Data = v // El objeto completo para enviar de vuelta
                        }).OrderBy(x => x.Fecha).ThenBy(x => x.UsuarioNombre).ToList();

                        return Ok(new { 
                            message = $"Se encontraron {res.Count} grupos de registros para cargar.",
                            preview = res
                        });
                    }
                    else
                    {
                        return BadRequest(new { error = "No se pudieron extraer registros válidos del Excel. Verifique que los nombres de columnas coincidan (Fecha, Maquina, Operario, Orden, Inicio, Final, Actividad, Tiros)." });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            var errorDetail = $"Error importando Excel: {ex.Message}\nStack: {ex.StackTrace}";
            if (ex.InnerException != null) errorDetail += $"\nInner Exception: {ex.InnerException.Message}";
            
            Console.WriteLine($"[CRITICAL IMPORT ERROR] {errorDetail}");
            System.IO.File.WriteAllText("import_crash_full.txt", errorDetail);
            
            return StatusCode(500, new { 
                error = "Error interno procesando el archivo Excel.", 
                message = ex.Message,
                details = errorDetail 
            });
        }
    }

    private Usuario BusquedaFuzzyUsuario(List<Usuario> lista, string nombreBusqueda)
    {
        if (string.IsNullOrWhiteSpace(nombreBusqueda)) return null;
        
        string normalizado = nombreBusqueda.ToLower().Trim();
        
        // 1. Coincidencia Exacta
        var exacto = lista.FirstOrDefault(u => u.Nombre.ToLower() == normalizado);
        if (exacto != null) return exacto;

        // 2. Coincidencia por palabras (Fuzzy)
        // Dividimos el nombre buscado en fragmentos de al menos 3 letras
        var palabras = normalizado.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                  .Where(p => p.Length > 2)
                                  .ToList();

        if (!palabras.Any()) return null;

        // Buscamos usuarios que contengan TODAS las palabras clave (sin importar el orden)
        var coincide = lista.FirstOrDefault(u => {
            string uNombre = u.Nombre.ToLower();
            return palabras.All(p => uNombre.Contains(p));
        });

        if (coincide != null)
        {
            Console.WriteLine($"[USER MATCH] Excel: '{nombreBusqueda}' -> Match: '{coincide.Nombre}' (ID: {coincide.Id})");
            return coincide;
        }

        // 3. Coincidencia parcial (al menos 2 palabras clave coinciden)
        if (palabras.Count >= 2)
        {
            return lista.FirstOrDefault(u => {
                string uNombre = u.Nombre.ToLower();
                return palabras.Count(p => uNombre.Contains(p)) >= 2;
            });
        }

        return null;
    }

    private string GetStringFromCell(OfficeOpenXml.ExcelWorksheet ws, int row, Dictionary<string, int> headers, string keySnippet)
    {
        var entry = headers.FirstOrDefault(h => h.Key.Contains(keySnippet));
        if (entry.Key == null || entry.Value <= 0) return null;
        
        var val = ws.Cells[row, entry.Value].Value;
        if (val == null) return null;

        if (val is DateTime dt)
        {
            // Si es un tiempo solo de Excel, suele venir con fecha 1899-12-30
            if (dt.Year == 1899) return dt.ToString("HH:mm:ss"); // Usar 24h para evitar líos de AM/PM
            return dt.ToString("yyyy-MM-dd HH:mm:ss");
        }

        return val.ToString();
    }

    private decimal? GetDecimalFromCell(OfficeOpenXml.ExcelWorksheet ws, int row, Dictionary<string, int> headers, string keySnippet)
    {
        var entry = headers.FirstOrDefault(h => h.Key.Contains(keySnippet));
        if (entry.Key == null || entry.Value <= 0) return null;
        
        var val = ws.Cells[row, entry.Value].Value;
        if (val == null) return null;

        if (decimal.TryParse(val.ToString(), out decimal result))
            return result;
        
        return null;
    }

    /// <summary>
    /// Guarda o actualiza registros de producción diaria para un mes completo.
    /// Soporta múltiples registros en un solo request (sincronización).
    /// </summary>
    /// <summary>
    /// Guarda o actualiza registros de producción diaria para un mes completo o parcial.
    /// OBSOLETO el borrado total. Ahora usa Upsert para preservar IDs y detalles.
    /// </summary>
    [HttpPost("mensual")]
    public async Task<IActionResult> GuardarProduccionMensual([FromBody] List<ProduccionDiariaDto> registros, [FromQuery] bool isPartial = false)
    {
        try
        {
            if (registros == null || !registros.Any())
            {
                return BadRequest("No hay registros para guardar");
            }

            // Obtener el contexto (Mes/Año/Máquina) del primer registro
            var primerRegistro = registros.First();
            var fecha = DateTime.Parse(primerRegistro.Fecha);
            var mes = fecha.Month;
            var anio = fecha.Year;
            var maquinaId = primerRegistro.MaquinaId;

            // Obtener registros existentes para este contexto
            var existentes = await _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
                .ToListAsync();

            // Lista para seguimiento de procesados (para saber cuáles borrar si no es partial)
            var procesadosIds = new HashSet<long>();
            var processedEntities = new List<ProduccionDiaria>();

            foreach (var dto in registros)
            {
                var fechaRegistro = DateTime.Parse(dto.Fecha);
                var horaInicio = ParseTime(dto.HoraInicio);
                var horaFin = ParseTime(dto.HoraFin);

                // --- FALLBACK REQUERIDO POR EL USUARIO ---
                // Si la cabecera no trae horas, tomar el inicio del primer detalle y el fin del último.
                if ((horaInicio == TimeSpan.Zero || horaFin == TimeSpan.Zero) && dto.Detalles != null && dto.Detalles.Any())
                {
                    var validTimes = dto.Detalles
                        .Select(d => new { i = ParseTime(d.HoraInicio), f = ParseTime(d.HoraFin) })
                        .Where(t => t.i != TimeSpan.Zero || t.f != TimeSpan.Zero)
                        .ToList();

                    if (validTimes.Any())
                    {
                        if (horaInicio == TimeSpan.Zero) {
                            var minI = validTimes.Where(t => t.i != TimeSpan.Zero).Select(t => t.i).DefaultIfEmpty(TimeSpan.Zero).Min();
                            if (minI != TimeSpan.Zero) horaInicio = minI;
                        }
                        if (horaFin == TimeSpan.Zero) {
                            horaFin = validTimes.Max(t => t.f);
                        }
                    }
                }

                // SIEMPRE sincronizar con detalles si existen, para asegurar la cabecera coincida con el modal
                if (dto.Detalles != null && dto.Detalles.Any()) {
                    var detTimes = dto.Detalles
                        .Select(d => new { i = ParseTime(d.HoraInicio), f = ParseTime(d.HoraFin) })
                        .Where(t => t.i != TimeSpan.Zero || t.f != TimeSpan.Zero)
                        .ToList();
                    
                    if (detTimes.Any()) {
                        var minDet = detTimes.Where(t => t.i != TimeSpan.Zero).Select(t => t.i).DefaultIfEmpty(TimeSpan.Zero).Min();
                        var maxDet = detTimes.Max(t => t.f);
                        if (minDet != TimeSpan.Zero) horaInicio = minDet;
                        if (maxDet != TimeSpan.Zero) horaFin = maxDet;
                    }
                }


                ProduccionDiaria produccion = null;

                // Intentar encontrar existente por ID
                if (dto.Id > 0)
                {
                    produccion = existentes.FirstOrDefault(e => e.Id == dto.Id);
                }
                
                // Si no se encuentra por Id (o Id es 0), intentar por Fecha+Maquina+Usuario (Soft Match)
                // Para evitar duplicados si se envía Id 0 pero el registro ya existe conceptualmente
                if (produccion == null)
                {
                    produccion = existentes.FirstOrDefault(e => e.Fecha.Date == fechaRegistro.Date && e.MaquinaId == dto.MaquinaId && e.UsuarioId == dto.UsuarioId && !procesadosIds.Contains(e.Id));
                }

                if (produccion != null)
                {
                    // UPDATE
                    produccion.UsuarioId = dto.UsuarioId;
                    produccion.HoraInicio = horaInicio;
                    produccion.HoraFin = horaFin;
                    produccion.HorasOperativas = dto.HorasOperativas;
                    produccion.RendimientoFinal = dto.RendimientoFinal;
                    produccion.Cambios = dto.Cambios;
                    produccion.TiempoPuestaPunto = dto.TiempoPuestaPunto;
                    produccion.TirosDiarios = (int)dto.TirosDiarios;
                    produccion.TotalHorasProductivas = dto.TotalHorasProductivas;
                    produccion.PromedioHoraProductiva = dto.PromedioHoraProductiva;
                    produccion.ValorTiroSnapshot = dto.ValorTiroSnapshot;
                    produccion.ValorAPagar = dto.ValorAPagar;
                    produccion.ValorAPagarBonificable = dto.ValorAPagarBonificable;
                    produccion.HorasMantenimiento = dto.HorasMantenimiento;
                    produccion.HorasDescanso = dto.HorasDescanso;
                    produccion.HorasOtrosAux = dto.HorasOtrosAux;
                    produccion.TiempoFaltaTrabajo = dto.TiempoFaltaTrabajo;
                    produccion.TiempoReparacion = dto.TiempoReparacion;
                    produccion.TiempoOtroMuerto = dto.TiempoOtroMuerto;
                    produccion.ReferenciaOP = dto.ReferenciaOP ?? "";
                    produccion.Novedades = dto.Novedades ?? "";
                    produccion.Desperdicio = dto.Desperdicio;
                    produccion.DiaLaborado = dto.DiaLaborado;
                    produccion.HorarioId = dto.HorarioId;

                    // Recalcular totales
                    produccion.TotalHorasAuxiliares = dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux;
                    produccion.TotalTiemposMuertos = dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto;
                    produccion.TotalHoras = dto.TotalHorasProductivas + dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux + dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto;

                    Console.WriteLine($"[SAVE DEBUG] Updating record {produccion.Id}. Date: {produccion.Fecha}, User: {produccion.UsuarioId}, Inicio: {produccion.HoraInicio}, RFinal: {produccion.RendimientoFinal}");

                    _context.Entry(produccion).State = EntityState.Modified;
                    procesadosIds.Add(produccion.Id);

                    // Sincronizar Detalles si vienen en el DTO
                    if (dto.Detalles != null)
                    {
                        var existentesDetalles = await _context.ProduccionDiariaDetalles
                            .Where(d => d.ProduccionDiariaId == produccion.Id)
                            .ToListAsync();
                        _context.ProduccionDiariaDetalles.RemoveRange(existentesDetalles);

                        foreach (var detDto in dto.Detalles)
                        {
                            _context.ProduccionDiariaDetalles.Add(new ProduccionDiariaDetalle
                            {
                                ProduccionDiariaId = produccion.Id,
                                HoraInicio = ParseTime(detDto.HoraInicio),
                                HoraFin = ParseTime(detDto.HoraFin),
                                ActividadId = detDto.ActividadId,
                                Tiros = detDto.Tiros,
                                ReferenciaOP = detDto.ReferenciaOP ?? "",
                                Observaciones = detDto.Observaciones ?? ""
                            });
                        }
                    }
                }
                else
                {
                    // INSERT
                    var nueva = new ProduccionDiaria
                    {
                        Fecha = fechaRegistro,
                        UsuarioId = dto.UsuarioId,
                        MaquinaId = dto.MaquinaId,
                        HoraInicio = horaInicio,
                        HoraFin = horaFin,
                        HorasOperativas = dto.HorasOperativas,
                        RendimientoFinal = dto.RendimientoFinal,
                        Cambios = dto.Cambios,
                        TiempoPuestaPunto = dto.TiempoPuestaPunto,
                        TirosDiarios = (int)dto.TirosDiarios,
                        TotalHorasProductivas = dto.TotalHorasProductivas,
                        PromedioHoraProductiva = dto.PromedioHoraProductiva,
                        ValorTiroSnapshot = dto.ValorTiroSnapshot,
                        ValorAPagar = dto.ValorAPagar,
                        ValorAPagarBonificable = dto.ValorAPagarBonificable,
                        HorasMantenimiento = dto.HorasMantenimiento,
                        HorasDescanso = dto.HorasDescanso,
                        HorasOtrosAux = dto.HorasOtrosAux,
                        TiempoFaltaTrabajo = dto.TiempoFaltaTrabajo,
                        TiempoReparacion = dto.TiempoReparacion,
                        TiempoOtroMuerto = dto.TiempoOtroMuerto,
                        ReferenciaOP = dto.ReferenciaOP ?? "",
                        Novedades = dto.Novedades ?? "",
                        Desperdicio = dto.Desperdicio,
                        DiaLaborado = dto.DiaLaborado,
                        HorarioId = dto.HorarioId,
                        // Totales
                        TotalHorasAuxiliares = dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux,
                        TotalTiemposMuertos = dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto,
                        TotalHoras = dto.TotalHorasProductivas + dto.HorasMantenimiento + dto.HorasDescanso + dto.HorasOtrosAux + dto.TiempoFaltaTrabajo + dto.TiempoReparacion + dto.TiempoOtroMuerto
                    };

                    Console.WriteLine($"[SAVE DEBUG] Inserting NEW record. Date: {nueva.Fecha}, User: {nueva.UsuarioId}, Inicio: {nueva.HoraInicio}, RFinal: {nueva.RendimientoFinal}");
                    
                    _context.ProduccionDiaria.Add(nueva);
                    produccion = nueva;

                    // Si es nuevo y trae detalles, guardarlos (necesitamos el ID generado después de SaveChanges o usar el objeto)
                    if (dto.Detalles != null)
                    {
                        foreach (var detDto in dto.Detalles)
                        {
                            _context.ProduccionDiariaDetalles.Add(new ProduccionDiariaDetalle
                            {
                                ProduccionDiaria = nueva, // EF manejará el ID
                                HoraInicio = ParseTime(detDto.HoraInicio),
                                HoraFin = ParseTime(detDto.HoraFin),
                                ActividadId = detDto.ActividadId,
                                Tiros = detDto.Tiros,
                                ReferenciaOP = detDto.ReferenciaOP ?? "",
                                Observaciones = detDto.Observaciones ?? ""
                            });
                        }
                    }
                }
                processedEntities.Add(produccion);
            }

            // Si NO es partial, borrar los que no vinieron en el payload (Sincronización completa)
            if (!isPartial)
            {
                var paraBorrar = existentes.Where(e => !procesadosIds.Contains(e.Id)).ToList();
                if (paraBorrar.Any())
                {
                    // CRITICAL FIX: Also delete TiemposProceso (History Logs) for these deleted dailies
                    // Otherwise History view remains populated while Capture Grid is empty
                    foreach (var del in paraBorrar)
                    {
                        var logs = await _context.TiemposProceso
                            .Where(t => t.Fecha.Date == del.Fecha.Date && t.MaquinaId == del.MaquinaId && t.UsuarioId == del.UsuarioId)
                            .ToListAsync();
                        
                        if (logs.Any())
                        {
                            _context.TiemposProceso.RemoveRange(logs);
                            Console.WriteLine($"[SYNC DELETE] Deleted {logs.Count} history logs for {del.Fecha:yyyy-MM-dd} Maq:{del.MaquinaId}");
                        }
                    }

                    _context.ProduccionDiaria.RemoveRange(paraBorrar);
                }

                // EXTRA SAFETY: Clean up orphaned logs (TiemposProceso) for days NOT in the payload OR empty days
                // This handles cases where ProduccionDiaria was already gone but logs remained
                // We trust "registros" as the Full Truth for this Machine/Month
                
                // Identify valid dates: Must be present AND have actual content (Hours > 0 or OP or meaningful data)
                // If a record exists but has 0 hours/content (e.g. just Operator set), we treat it as "Empty" and clear history.
                var validDates = registros
                    .Where(r => (r.TotalHorasProductivas + r.HorasMantenimiento + r.HorasDescanso + 
                                 r.HorasOtrosAux + r.TiempoFaltaTrabajo + r.TiempoReparacion + 
                                 r.TiempoOtroMuerto + r.Desperdicio) > 0 
                                || !string.IsNullOrWhiteSpace(r.ReferenciaOP) 
                                || !string.IsNullOrWhiteSpace(r.Novedades))
                    .Select(r => DateTime.Parse(r.Fecha).Date)
                    .ToHashSet();
                
                var allLogsThisMonth = await _context.TiemposProceso
                    .Where(t => t.Fecha.Month == mes && t.Fecha.Year == anio && t.MaquinaId == maquinaId)
                    .ToListAsync();
                
                var orphanedLogs = allLogsThisMonth.Where(t => !validDates.Contains(t.Fecha.Date)).ToList();
                
                if (orphanedLogs.Any())
                {
                    _context.TiemposProceso.RemoveRange(orphanedLogs);
                    Console.WriteLine($"[SYNC CLEANUP] Removing {orphanedLogs.Count} orphaned logs for M:{mes}/A:{anio} Maq:{maquinaId}");
                }
            }

            Console.WriteLine($"[DEBUG] GuardarProduccionMensual: Processing {registros.Count} records. isPartial: {isPartial}");
            await _context.SaveChangesAsync();

            var results = processedEntities.Select(p => new {
                id = p.Id,
                fecha = p.Fecha.ToString("yyyy-MM-dd"),
                usuarioId = p.UsuarioId,
                maquinaId = p.MaquinaId
            }).ToList();
            
            Console.WriteLine($"[DEBUG] GuardarProduccionMensual: Returning {results.Count} results.");
            if (results.Any()) {
                Console.WriteLine($"[DEBUG] First Result ID: {results.First().id}");
            }
            
            return Ok(new { 
                message = $"Se procesaron {registros.Count} registros exitosamente.",
                results = results
            });
        }
        catch (Exception ex)
        {
            var errorDetail = $"Error en GuardarProduccionMensual: {ex.Message}\nStackTrace: {ex.StackTrace}\nInner: {ex.InnerException?.Message}";
            System.IO.File.WriteAllText("debug_save_error.txt", errorDetail);
            Console.WriteLine(errorDetail);
            return StatusCode(500, new { error = ex.Message, details = ex.InnerException?.Message });
        }
    }

    [HttpPost("recalcular-mes")]
    public async Task<IActionResult> RecalcularMes([FromQuery] int anio, [FromQuery] int mes)
    {
        try
        {
            await _tiempoProcesoService.RecalcularProduccionMesAsync(anio, mes);
            return Ok(new { message = $"Recálculo completado para {mes}/{anio}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int anio, int? mes = null)
    {
        try 
        {
            var query = _context.Produccion_Gastos
                .Include(g => g.Rubro)
                .Include(g => g.Proveedor)
                .Include(g => g.Usuario)
                .Include(g => g.CreadoPor) // Include creator info
                .Include(g => g.Maquina)
                .Include(g => g.TipoHora)
                .Include(g => g.TipoRecargo)
                .Where(g => g.Anio == anio);

            if (mes.HasValue)
            {
                query = query.Where(g => g.Mes == mes.Value);
            }

            var gastos = await query
                .OrderByDescending(g => g.Fecha)
                .ToListAsync();

            // Calculate Summary
            var resumen = new
            {
                Total = gastos.Sum(g => g.Precio),
                PorRubro = gastos.GroupBy(g => g.Rubro?.Nombre ?? "Sin Rubro")
                                 .Select(g => new { Rubro = g.Key, Total = g.Sum(x => x.Precio) })
                                 .ToDictionary(k => k.Rubro, v => v.Total)
            };

            return Ok(new { gastos, resumen });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] GetGastos failure: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
            if (ex.InnerException != null) Console.WriteLine($"[INNER] {ex.InnerException.Message}");
            return StatusCode(500, new { message = "Error interno del servidor", details = ex.Message });
        }
    }

    [HttpPost("gastos")]
    public async Task<ActionResult<Produccion_Gasto>> CreateGasto(Produccion_Gasto gasto)
    {
        // Basic validations
        if (gasto.RubroId <= 0) return BadRequest("Rubro es requerido");

        // Set Creator
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
        {
            gasto.CreadoPorId = adminId;
        }

        // Helper: Validate logic based on Rubro
        var rubro = await _context.Produccion_Rubros.FindAsync(gasto.RubroId);
        if (rubro != null)
        {
            if (rubro.Nombre == "Horas Extras" || rubro.Nombre == "Recargo")
            {
                bool isRecargo = rubro.Nombre == "Recargo";
                if (gasto.UsuarioId == null) return BadRequest("Usuario es requerido");
                if (!isRecargo && gasto.TipoHoraId == null) return BadRequest("Tipo de Hora es requerido");
                if (isRecargo && gasto.TipoRecargoId == null) return BadRequest("Tipo de Recargo es requerido");
                if (gasto.CantidadHoras == null || gasto.CantidadHoras <= 0) return BadRequest("Cantidad de Horas invalidas");

                // Server-side calculation to ensure integrity
                var usuario = await _context.Usuarios.FindAsync(gasto.UsuarioId);
                decimal factor = 0;
                
                if (isRecargo)
                {
                    var tipoRec = await _context.Produccion_TiposRecargo.FindAsync(gasto.TipoRecargoId);
                    factor = tipoRec?.Factor ?? 0;
                }
                else
                {
                    var tipoHora = await _context.Produccion_TiposHora.FindAsync(gasto.TipoHoraId);
                    factor = tipoHora?.Factor ?? 0;
                }

                if (usuario == null || factor <= 0) return BadRequest("Referencia no encontrada o factor inválido");

                // Formula: (Salario / 220) * Factor * Horas
                decimal hourlyRate = usuario.Salario / 220m;
                gasto.Precio = hourlyRate * factor * (gasto.CantidadHoras ?? 0);
                gasto.Precio = Math.Round(gasto.Precio, 2);
                
                gasto.NumeroFactura = null;
                gasto.FacturaPdfUrl = null;
            }
            else
            {
                // Non-Horas Extras rubros require invoice number
                // BUT: If it's a pending expense, we allow empty invoice
                if (!gasto.EsPendiente && string.IsNullOrWhiteSpace(gasto.NumeroFactura))
                    return BadRequest("Número de Factura es requerido para este tipo de rubro");
            }
            // Add more if needed
        }

        gasto.Fecha = gasto.Fecha.ToUniversalTime(); // Postgres timestamp handling
        gasto.FechaCreacion = DateTime.UtcNow;
        _context.Produccion_Gastos.Add(gasto);
        await _context.SaveChangesAsync();

        return Ok(gasto);
    }



    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Produccion_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        gasto.Fecha = gasto.Fecha.ToUniversalTime();

        // Preserve FechaCreacion
        var existingEntry = await _context.Produccion_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;

        gasto.FechaModificacion = DateTime.UtcNow;
        _context.Entry(gasto).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Produccion_Gastos.Any(e => e.Id == id))
                return NotFound();
            else
                throw;
        }

        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.Produccion_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();

        _context.Produccion_Gastos.Remove(gasto);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ===================== HORAS EXTRAS REPORT =====================
    /// <summary>
    /// Get overtime (Horas Extras) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/horas-extras-report")]
    public async Task<ActionResult<List<object>>> GetHorasExtrasReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Horas Extras" rubro ID
        var rubroHE = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        if (rubroHE == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Produccion_Gastos
            .Where(g => g.RubroId == rubroHE.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Usuario)
            .Include(g => g.TipoHora)
            .OrderByDescending(g => g.Fecha)
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario != null ? g.Usuario.Nombre : "N/A",
                UsuarioDocumento = g.Usuario != null ? g.Usuario.Documento : "",
                Salario = g.Usuario != null ? g.Usuario.Salario : 0,
                ValorHora = g.Usuario != null ? (g.Usuario.Salario / 220m) : 0,
                NumeroOP = g.NumeroOP ?? "",
                TipoHoraNombre = g.TipoHora != null ? g.TipoHora.Nombre : "N/A",
                Factor = g.TipoHora != null ? g.TipoHora.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Nota ?? ""
            })
            .ToListAsync();

        return Ok(gastos);
    }

    // ===================== RECARGOS REPORT =====================
    /// <summary>
    /// Get surcharge (Recargo) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/recargos-report")]
    public async Task<ActionResult<List<object>>> GetRecargosReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Recargo" rubro ID
        var rubroRecargo = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");
        if (rubroRecargo == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Produccion_Gastos
            .Where(g => g.RubroId == rubroRecargo.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Usuario)
            .Include(g => g.TipoRecargo)
            .OrderByDescending(g => g.Fecha)
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                UsuarioNombre = g.Usuario != null ? g.Usuario.Nombre : "N/A",
                UsuarioDocumento = g.Usuario != null ? g.Usuario.Documento : "",
                Salario = g.Usuario != null ? g.Usuario.Salario : 0,
                ValorHora = g.Usuario != null ? (g.Usuario.Salario / 220m) : 0,
                NumeroOP = g.NumeroOP ?? "",
                TipoRecargoNombre = g.TipoRecargo != null ? g.TipoRecargo.Nombre : "N/A",
                Factor = g.TipoRecargo != null ? g.TipoRecargo.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Nota ?? ""
            })
            .ToListAsync();
        
        Console.WriteLine($"[DEBUG] Found {gastos.Count} recargos records");
        foreach(var g in gastos) {
             Console.WriteLine($"[DEBUG] Recargo User: {g.UsuarioNombre}, ID: '{g.UsuarioDocumento}'");
        }

        return Ok(gastos);
    }


    // ===================== PRESUPUESTOS (Budgets) =====================

    /// <summary>
    /// Get all budgets for a given month/year
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult> GetPresupuestos(int anio, int mes)
    {
        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .Include(p => p.Rubro)
            .ToListAsync();

        return Ok(presupuestos);
    }

    /// <summary>
    /// Set a single budget for a Rubro/Month/Year (create or update)
    /// </summary>
    [HttpPost("presupuesto")]
    public async Task<ActionResult<Produccion_PresupuestoMensual>> SetPresupuesto([FromBody] Produccion_PresupuestoMensual presupuesto)
    {
        var existing = await _context.Produccion_PresupuestosMensuales
            .FirstOrDefaultAsync(p => p.RubroId == presupuesto.RubroId && p.Anio == presupuesto.Anio && p.Mes == presupuesto.Mes);

        if (existing != null)
        {
            existing.Presupuesto = presupuesto.Presupuesto;
            await _context.SaveChangesAsync();
            return Ok(existing);
        }
        else
        {
            _context.Produccion_PresupuestosMensuales.Add(presupuesto);
            await _context.SaveChangesAsync();
            return Ok(presupuesto);
        }
    }

    /// <summary>
    /// Bulk set budgets for a month/year (create or update multiple)
    /// </summary>
    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<Produccion_PresupuestoMensual> presupuestos)
    {
        foreach (var presupuesto in presupuestos)
        {
            var existing = await _context.Produccion_PresupuestosMensuales
                .FirstOrDefaultAsync(p => p.RubroId == presupuesto.RubroId && p.Anio == presupuesto.Anio && p.Mes == presupuesto.Mes);

            if (existing != null)
            {
                existing.Presupuesto = presupuesto.Presupuesto;
            }
            else
            {
                _context.Produccion_PresupuestosMensuales.Add(presupuesto);
            }
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Get production summary (Tiros) filtered by machine, date, user, and OP (string match)
    /// Used for Waste Report percentage calculation.
    /// Supports filtering by exact Date OR by Month/Year.
    /// </summary>
    [HttpGet("resumen-produccion")]
    public async Task<ActionResult<IEnumerable<object>>> GetProduccionSummary(
        [FromQuery] int? maquinaId, 
        [FromQuery] DateTime? fecha, 
        [FromQuery] int? usuarioId, 
        [FromQuery] string? ordenProduccion,
        [FromQuery] int? mes,
        [FromQuery] int? anio)
    {
        // 1. Base query on TiemposProceso (Source valid shots)
        var query = _context.TiemposProceso
            .Include(t => t.OrdenProduccion)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Where(t => t.Actividad.Codigo == "02") // Only Production (02) counts
            .AsQueryable();

        // 2. Apply filters
        if (maquinaId.HasValue) 
            query = query.Where(t => t.MaquinaId == maquinaId.Value);

        if (fecha.HasValue) 
        {
            // Exact date priority
            query = query.Where(t => t.Fecha.Date == fecha.Value.Date);
        }
        else if (mes.HasValue && anio.HasValue)
        {
            // Monthly filter if no exact date
            query = query.Where(t => t.Fecha.Month == mes.Value && t.Fecha.Year == anio.Value);
        }

        if (usuarioId.HasValue) 
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrEmpty(ordenProduccion)) 
            query = query.Where(t => t.OrdenProduccion != null && t.OrdenProduccion.Numero.Contains(ordenProduccion));

        // 3. Group and Sum

        if (usuarioId.HasValue) 
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrEmpty(ordenProduccion)) 
            query = query.Where(t => t.OrdenProduccion != null && t.OrdenProduccion.Numero.Contains(ordenProduccion));

        // 3. Group and Sum
        var summary = await query
            .GroupBy(t => new { t.MaquinaId, t.Maquina.Nombre })
            .Select(g => new
            {
                MaquinaId = g.Key.MaquinaId,
                MaquinaNombre = g.Key.Nombre,
                Tiros = g.Sum(t => t.Tiros)
            })
            .ToListAsync();

        return Ok(summary);
    }

    /// <summary>
    /// Get production summary with operators and machines data for a month
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen(int mes, int anio, int? diaInicio = null, int? diaFin = null)
    {
        // Get all production data for the month
        var query = _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        // Apply day range filter if provided (for weekly reports)
        if (diaInicio.HasValue && diaFin.HasValue)
        {
            query = query.Where(p => p.Fecha.Day >= diaInicio.Value && p.Fecha.Day <= diaFin.Value);
        }

        var produccion = await query.ToListAsync();

        // Get machine metadata for importance and meta calculations
        var maquinas = await _context.Maquinas.Where(m => m.Activo && (m.Nombre == null || !m.Nombre.Contains("TERMINADOS"))).ToListAsync();

        // Load monthly meta snapshots for this period
        var metaSnapshots = await _context.MetasMensuales
            .Where(s => s.Mes == mes && s.Anio == anio)
            .ToListAsync();

        // Count working days in period
        var diasLaborados = produccion
            .Select(p => p.Fecha.Date)
            .Distinct()
            .Count();

        // Group by Operario + Maquina combination - ALIGNED WITH CalificacionController
        var resumenOperarios = produccion
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => {
                var maq = maquinas.FirstOrDefault(m => m.Id == g.Key.MaquinaId);
                var first = g.First();
                var tirosReferencia = maq?.TirosReferencia ?? 0;
                
                // Usar todos los registros del grupo (datos Jan 1-12 2026 ya fueron eliminados de BD)
                var filteredGroup = g.AsEnumerable();
                
                // FIXED: Usar RendimientoFinal (decimal) con redondeo para coincidir con frontend
                var totalTiros = filteredGroup.Sum(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal));
                var tirosBonificables = filteredGroup.Sum(p => p.TirosBonificables);
                // DiasLaborados: Filter days to only those with actual activity
                var diasOp = filteredGroup.Where(p => 
                    (p.TotalHoras > 0 || p.RendimientoFinal > 0 || p.Cambios > 0)
                ).Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use Meta100Porciento like CalificacionController
                var meta100PorcientoBase = maq?.Meta100Porciento ?? maq?.MetaRendimiento ?? 7500;
                
                // REVERTED: Use TotalHoras to prorate Meta100 for general dashboard
                // Meta100 = TotalHoras * (Meta100PorcientoBase / 8)
                decimal totalHorasOp = filteredGroup.Sum(p => p.TotalHoras);
                decimal metaPorHora = (decimal)meta100PorcientoBase / 8;
                decimal meta100 = totalHorasOp * metaPorHora;

                var meta75 = meta100 * 0.75m;
                
                var pct75 = meta75 > 0 ? (decimal)totalTiros / meta75 * 100 : 0;
                var pct100 = meta100 > 0 ? (decimal)totalTiros / meta100 * 100 : 0;
                
                string sem75 = pct75 >= 100 ? "Verde" : pct75 >= 75 ? "Amarillo" : "Rojo";
                string sem100 = pct100 >= 100 ? "Verde" : pct100 >= 75 ? "Amarillo" : "Rojo";

                // Apply 75% threshold: Only pay bonificación if operario achieved >= 75% of Meta100
                var valorBonifSum = filteredGroup.Sum(p => p.ValorAPagarBonificable);
                var valorAPagarBonificableFinal = pct100 >= 75 ? valorBonifSum : 0;
                
                // Bonif Potencial: Es el valor ganado ANTES de aplicar el filtro del 75% (lo que podría haber ganado)
                // O mejor dicho, sumamos el ValorAPagar completo (total bonus earned) para reporte
                var valorTotalGanado = filteredGroup.Sum(p => p.ValorAPagar);

                return new ResumenOperarioDTO {
                    UsuarioId = g.Key.UsuarioId,
                    MaquinaId = g.Key.MaquinaId,
                    Operario = first.Usuario?.Nombre ?? "Desconocido",
                    Maquina = first.Maquina?.Nombre ?? "Desconocida",
                    TirosReportados = (int)Math.Round(filteredGroup.Sum(p => p.RendimientoFinal)),
                    TirosEquivalentes = filteredGroup.Sum(p => p.Cambios * tirosReferencia),
                    TotalCambios = filteredGroup.Sum(p => p.Cambios),
                    TotalTiros = totalTiros,
                    TirosBonificables = tirosBonificables,
                    TotalHorasProductivas = filteredGroup.Sum(p => p.TotalHorasProductivas),
                    TotalHorasAuxiliares = filteredGroup.Sum(p => p.HorasMantenimiento + p.HorasOtrosAux),
                    PromedioHoraProductiva = filteredGroup.Any() ? filteredGroup.Average(p => p.PromedioHoraProductiva) : 0,
                    TotalHoras = filteredGroup.Sum(p => p.TotalHoras),
                    ValorAPagar = valorTotalGanado,
                    ValorAPagarBonificable = valorAPagarBonificableFinal,
                    ValorBonifPotencial = valorBonifSum, 
                    DiasLaborados = diasOp,
                    MetaBonificacion = meta75,
                    Meta100Porciento = meta100,
                    Eficiencia = pct100 / 100,
                    PorcentajeRendimiento75 = pct75,
                    PorcentajeRendimiento100 = pct100,
                    SemaforoColor = sem75,
                    SemaforoColor100 = sem100,
                    UltimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy"),
                };
            })
            .Where(r => r.DiasLaborados > 0)
            .OrderBy(r => r.Operario)
            .ThenBy(r => r.Maquina)
            .ToList();

        // Group by Maquina based on ALL Active Machines to include 0 performance ones
        var resumenMaquinas = maquinas.Select(maq => 
        {
            var g = produccion.Where(p => p.MaquinaId == maq.Id).ToList();
            
            if (g.Any())
            {
                var tirosReferencia = maq.TirosReferencia;
                
                // Usar todos los registros (datos Jan 1-12 2026 ya fueron eliminados de BD)
                var filteredGroup = g;

                // FIXED: Usar RendimientoFinal (decimal) con redondeo
                var tirosTotales = filteredGroup.Sum(p => (p.Cambios * tirosReferencia) + (int)Math.Round(p.RendimientoFinal));
                // Filter days to only those with actual activity
                var diasMaq = filteredGroup.Where(p => 
                    (p.TotalHoras > 0 || p.RendimientoFinal > 0 || p.Cambios > 0)
                ).Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use monthly meta snapshot if available, otherwise fallback to current machine values
                var snapshot = metaSnapshots.FirstOrDefault(s => s.MaquinaId == maq.Id);
                var meta100PorcientoBase = snapshot != null 
                    ? (snapshot.Meta100Porciento > 0 ? snapshot.Meta100Porciento.Value : (snapshot.MetaRendimiento ?? 0))
                    : (maq.Meta100Porciento > 0 ? maq.Meta100Porciento : maq.MetaRendimiento);
                
                // REVERTED: Use TotalHoras to prorate Meta100 for general dashboard
                // Meta100 = TotalHoras * (Meta100PorcientoBase / 8)
                decimal totalHorasMaq = filteredGroup.Sum(p => p.TotalHoras);
                decimal metaPorHora = (decimal)meta100PorcientoBase / 8;
                decimal meta100 = totalHorasMaq * metaPorHora;

                var meta75 = meta100 * 0.75m;
                
                var pct = meta100 > 0 ? (decimal)tirosTotales / meta100 * 100 : 0;
                string sem = pct >= 100 ? "Verde" : pct >= 75 ? "Amarillo" : "Rojo";
                
                var importancia = snapshot?.Importancia ?? maq.Importancia;
                var calificacion = pct * importancia / 100;
                var tarifaVal = snapshot?.Tarifa ?? maq.Tarifa;

                return new ResumenMaquinaDTO {
                    MaquinaId = maq.Id,
                    Maquina = maq.Nombre,
                    TirosReportados = (int)Math.Round(filteredGroup.Sum(p => p.RendimientoFinal)),
                    TirosEquivalentes = filteredGroup.Sum(p => p.Cambios * tirosReferencia),
                    TotalCambios = filteredGroup.Sum(p => p.Cambios),
                    TotalTiempoPuestaPunto = filteredGroup.Sum(p => p.TiempoPuestaPunto),
                    TotalHorasDescanso = filteredGroup.Sum(p => p.HorasDescanso),
                    TotalHorasProductivas = filteredGroup.Sum(p => p.TotalHorasProductivas),
                    TotalHorasAuxiliares = filteredGroup.Sum(p => p.HorasMantenimiento + p.HorasOtrosAux),
                    TirosTotales = tirosTotales,
                    RendimientoEsperado = meta100,
                    Meta75Porciento = meta75,
                    Meta100Porciento = meta100,
                    PorcentajeRendimiento = pct / 100,
                    PorcentajeRendimiento100 = pct,
                    SemaforoColor = sem,
                    TotalTiemposMuertos = g.Sum(p => p.TotalTiemposMuertos),
                    TotalTiempoReparacion = g.Sum(p => p.TiempoReparacion),
                    TotalTiempoFaltaTrabajo = g.Sum(p => p.TiempoFaltaTrabajo),
                    TotalTiempoOtro = g.Sum(p => p.TiempoOtroMuerto),
                    TotalHoras = g.Sum(p => p.TotalHoras),
                    Importancia = importancia,
                    Calificacion = Math.Round(calificacion, 2),
                    DiasLaborados = diasMaq,
                    UltimaFecha = g.Max(p => p.Fecha).ToString("dd/MM/yyyy"),
                    Tarifa = tarifaVal,
                    MetaDiariaBase = meta100PorcientoBase
                };
            }
            else
            {
                // Zero performance case for active machine with no production
                return new ResumenMaquinaDTO {
                    MaquinaId = maq.Id,
                    Maquina = maq.Nombre,
                    TirosReportados = 0,
                    TirosEquivalentes = 0,
                    TotalCambios = 0,
                    TotalTiempoPuestaPunto = 0m,
                    TotalHorasDescanso = 0m,
                    TotalHorasProductivas = 0m,
                    TotalHorasAuxiliares = 0m,
                    TirosTotales = 0,
                    RendimientoEsperado = 0m,
                    Meta75Porciento = 0m,
                    Meta100Porciento = 0m,
                    PorcentajeRendimiento = 0m,
                    PorcentajeRendimiento100 = 0m,
                    SemaforoColor = "Rojo",
                    TotalTiemposMuertos = 0m,
                    TotalTiempoReparacion = 0m,
                    TotalTiempoFaltaTrabajo = 0m,
                    TotalTiempoOtro = 0m,
                    TotalHoras = 0m,
                    Importancia = maq.Importancia,
                    Calificacion = 0m,
                    DiasLaborados = 0,
                    UltimaFecha = "",
                    Tarifa = maq.Tarifa,
                    MetaDiariaBase = maq.Meta100Porciento > 0 ? maq.Meta100Porciento : maq.MetaRendimiento
                };
            }
        })
        .OrderBy(r => r.Maquina)
        .ToList();

        // Daily trend
        var tendenciaDiaria = produccion
            .GroupBy(p => p.Fecha.Date)
            .Select(g => new {
                fecha = g.Key,
                tiros = g.Sum(p => p.TirosDiarios),
                desperdicio = g.Sum(p => p.Desperdicio)
            })
            .OrderBy(t => t.fecha)
            .ToList();

        // Plant score (sum of machine calificaciones)
        var calificacionTotalPlanta = resumenMaquinas.Sum(m => m.Calificacion);

        return Ok(new {
            resumenOperarios,
            resumenMaquinas,
            tendenciaDiaria,
            calificacionTotalPlanta
        });
    }

    /// <summary>
    /// Get budget summary for a month (renamed from original resumen)
    /// </summary>
    [HttpGet("resumen-gastos")]
    public async Task<ActionResult> GetResumenGastos(int anio, int mes)
    {
        var gastos = await _context.Produccion_Gastos
            .Where(g => g.Anio == anio && g.Mes == mes)
            .Include(g => g.Rubro)
            .ToListAsync();

        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .Include(p => p.Rubro)
            .ToListAsync();

        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();

        var porRubro = rubros.Select(r => new {
            rubroId = r.Id,
            rubroNombre = r.Nombre,
            presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id)?.Presupuesto ?? 0,
            gastado = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio),
        }).Select(x => new {
            x.rubroId,
            x.rubroNombre,
            x.presupuesto,
            x.gastado,
            restante = x.presupuesto - x.gastado
        }).ToList();

        var totalPresupuesto = porRubro.Sum(r => r.presupuesto);
        var totalGastado = porRubro.Sum(r => r.gastado);

        return Ok(new {
            anio,
            mes,
            totalPresupuesto,
            totalGastado,
            totalRestante = totalPresupuesto - totalGastado,
            porRubro
        });
    }

    /// <summary>
    /// Get annual budget grid for all rubros - matches SST format
    /// </summary>
    [HttpGet("presupuestos-grid")]
    public async Task<ActionResult> GetPresupuestosGrid(int anio)
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();

        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        // Build grid similar to SST - using "tiposServicio" name for compatibility
        var tiposServicio = rubros.Select(r => new {
            tipoServicioId = r.Id,
            tipoServicioNombre = r.Nombre,
            meses = Enumerable.Range(1, 12).Select(mes => new {
                mes,
                presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == mes)?.Presupuesto ?? 0
            }).ToList()
        }).ToList();

        var totalesMensuales = Enumerable.Range(1, 12)
            .Select(mes => presupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto))
            .ToList();

        var totalAnual = presupuestos.Sum(p => p.Presupuesto);

        return Ok(new {
            tiposServicio,
            totalesMensuales,
            totalAnual
        });
    }

    // ===================== RUBROS CRUD =====================
    [HttpPost("rubros")]
    public async Task<ActionResult> CreateRubro([FromBody] Produccion_Rubro rubro)
    {
        rubro.Activo = true;
        _context.Produccion_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(rubro);
    }

    [HttpPut("rubros/{id}")]
    public async Task<ActionResult> UpdateRubro(int id, [FromBody] Produccion_Rubro updated)
    {
        var rubro = await _context.Produccion_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Nombre = updated.Nombre;
        await _context.SaveChangesAsync();
        return Ok(rubro);
    }

    [HttpDelete("rubros/{id}")]
    public async Task<ActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.Produccion_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== SALARIOS CRUD =====================
    [HttpPut("usuarios/{id}/salario")]
    public async Task<ActionResult> UpdateSalario(int id, [FromBody] SalarioUpdateDto dto)
    {
        var usuario = await _context.Usuarios.FindAsync(id);
        if (usuario == null) return NotFound();
        usuario.Salario = dto.Salario;
        await _context.SaveChangesAsync();
        return Ok(new { usuario.Id, usuario.Nombre, usuario.Salario });
    }

    // ===================== PROVEEDORES CRUD =====================
    [HttpPost("proveedores")]
    public async Task<ActionResult> CreateProveedor([FromBody] Produccion_Proveedor proveedor)
    {
        proveedor.Activo = true;
        _context.Produccion_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(proveedor);
    }

    [HttpPut("proveedores/{id}")]
    public async Task<ActionResult> UpdateProveedor(int id, [FromBody] Produccion_Proveedor updated)
    {
        var proveedor = await _context.Produccion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Nombre = updated.Nombre;
        proveedor.Nit = updated.Nit;
        proveedor.Telefono = updated.Telefono;
        proveedor.RubroId = updated.RubroId;
        proveedor.PrecioCotizado = updated.PrecioCotizado;
        await _context.SaveChangesAsync();
        return Ok(proveedor);
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<ActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Produccion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== TIPOS DE HORA CRUD =====================
    [HttpPost("tiposhora")]
    public async Task<ActionResult> CreateTipoHora([FromBody] Produccion_TipoHora tipoHora)
    {
        tipoHora.Activo = true;
        _context.Produccion_TiposHora.Add(tipoHora);
        await _context.SaveChangesAsync();
        return Ok(tipoHora);
    }

    [HttpPut("tiposhora/{id}")]
    public async Task<ActionResult> UpdateTipoHora(int id, [FromBody] Produccion_TipoHora updated)
    {
        var tipoHora = await _context.Produccion_TiposHora.FindAsync(id);
        if (tipoHora == null) return NotFound();
        tipoHora.Nombre = updated.Nombre;
        tipoHora.Porcentaje = updated.Porcentaje;
        tipoHora.Factor = updated.Factor;
        await _context.SaveChangesAsync();
        return Ok(tipoHora);
    }

    [HttpDelete("tiposhora/{id}")]
    public async Task<ActionResult> DeleteTipoHora(int id)
    {
        var tipoHora = await _context.Produccion_TiposHora.FindAsync(id);
        if (tipoHora == null) return NotFound();
        tipoHora.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== TIPOS DE RECARGO CRUD =====================
    [HttpPost("tiposrecargo")]
    public async Task<ActionResult> CreateTipoRecargo([FromBody] Produccion_TipoRecargo tipoRecargo)
    {
        tipoRecargo.Activo = true;
        _context.Produccion_TiposRecargo.Add(tipoRecargo);
        await _context.SaveChangesAsync();
        return Ok(tipoRecargo);
    }

    [HttpPut("tiposrecargo/{id}")]
    public async Task<ActionResult> UpdateTipoRecargo(int id, [FromBody] Produccion_TipoRecargo updated)
    {
        var tipoRecargo = await _context.Produccion_TiposRecargo.FindAsync(id);
        if (tipoRecargo == null) return NotFound();
        tipoRecargo.Nombre = updated.Nombre;
        tipoRecargo.Porcentaje = updated.Porcentaje;
        tipoRecargo.Factor = updated.Factor;
        await _context.SaveChangesAsync();
        return Ok(tipoRecargo);
    }

    [HttpDelete("tiposrecargo/{id}")]
    public async Task<ActionResult> DeleteTipoRecargo(int id)
    {
        var tipoRecargo = await _context.Produccion_TiposRecargo.FindAsync(id);
        if (tipoRecargo == null) return NotFound();
        tipoRecargo.Activo = false;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ===================== GRAFICAS ENDPOINT =====================
    [HttpGet("graficas")]
    public async Task<ActionResult> GetGraficas(int anio, int? mes = null)
    {
        var query = _context.Produccion_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Usuario)
            .Include(g => g.TipoHora)
            .Include(g => g.TipoRecargo)
            .Where(g => g.Anio == anio);

        if (mes.HasValue)
        {
            query = query.Where(g => g.Mes == mes.Value);
        }

        var gastos = await query.ToListAsync();

        // Por Rubro
        var porRubro = gastos
            .GroupBy(g => g.Rubro?.Nombre ?? "Sin Rubro")
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .ToList();

        // Por Proveedor
        var porProveedor = gastos
            .Where(g => g.Proveedor != null)
            .GroupBy(g => g.Proveedor!.Nombre)
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .Take(5)
            .ToList();

        // Por Usuario (para Horas Extras)
        var porUsuario = gastos
            .Where(g => g.Usuario != null)
            .GroupBy(g => g.Usuario!.Nombre)
            .Select(g => new { nombre = g.Key, total = g.Sum(x => x.Precio) })
            .OrderByDescending(x => x.total)
            .Take(5)
            .ToList();

        // Resumen mensual (para vista anual)
        var resumenMensual = new List<object>();
        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        if (!mes.HasValue)
        {
            for (int m = 1; m <= 12; m++)
            {
                var gastosMes = gastos.Where(g => g.Mes == m).Sum(g => g.Precio);
                var presupuestoMes = presupuestos.Where(p => p.Mes == m).Sum(p => p.Presupuesto);
                resumenMensual.Add(new {
                    mes = m,
                    totalGastado = gastosMes,
                    totalPresupuesto = presupuestoMes,
                    restante = presupuestoMes - gastosMes
                });
            }
        }

        // Performance by Rubro (for progress bars)
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var desempenoRubro = rubros.Select(r => {
            var gastoRubro = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio);
            var presupuestoRubro = mes.HasValue 
                ? (presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == mes.Value)?.Presupuesto ?? 0)
                : presupuestos.Where(p => p.RubroId == r.Id).Sum(p => p.Presupuesto);

            return new {
                rubroId = r.Id,
                nombre = r.Nombre,
                gastado = gastoRubro,
                presupuesto = presupuestoRubro,
                restante = presupuestoRubro - gastoRubro
            };
        }).OrderByDescending(x => x.gastado).ToList();

        var totalGastado = gastos.Sum(g => g.Precio);
        var totalPresupuesto = mes.HasValue 
            ? presupuestos.Where(p => p.Mes == mes.Value).Sum(p => p.Presupuesto)
            : presupuestos.Sum(p => p.Presupuesto);

        return Ok(new {
            totalGastado,
            totalPresupuesto,
            totalRestante = totalPresupuesto - totalGastado,
            porRubro,
            desempenoRubro,
            porProveedor,
            porUsuario,
            resumenMensual
        });
    }

    /// <summary>
    /// Upload PDF Factura
    /// </summary>
    [HttpPost("upload-factura")]
    public async Task<ActionResult> UploadFactura(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        // Ensure uploads folder exists
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "facturas");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        // Generate unique filename
        var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Return relative URL
        return Ok(new { url = $"/uploads/facturas/{uniqueFileName}" });
    }

    // ================== COTIZACIONES CRUD ==================
    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Produccion_Cotizaciones
            .Include(c => c.Proveedor)
            .Include(c => c.Rubro)
            .Where(c => c.Activo);

        if (proveedorId.HasValue)
            query = query.Where(c => c.ProveedorId == proveedorId.Value);
        if (anio.HasValue)
            query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue)
            query = query.Where(c => c.Mes == mes.Value);

        var cotizaciones = await query
            .OrderByDescending(c => c.FechaCotizacion)
            .Select(c => new
            {
                c.Id,
                c.ProveedorId,
                ProveedorNombre = c.Proveedor != null ? c.Proveedor.Nombre : "",
                c.RubroId,
                RubroNombre = c.Rubro != null ? c.Rubro.Nombre : "",
                c.Anio,
                c.Mes,
                c.PrecioCotizado,
                c.FechaCotizacion,
                c.Descripcion,
                c.Activo
            })
            .ToListAsync();

        return Ok(cotizaciones);
    }

    [HttpPost("cotizaciones")]
    public async Task<ActionResult<Produccion_Cotizacion>> CreateCotizacion([FromBody] Produccion_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.Produccion_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, Produccion_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.Produccion_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        
        // Soft delete
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        
        return NoContent();
    }









    






    [HttpGet("debug-meta")]
    public async Task<ActionResult> GetDebugMeta(string nombreMaquina, int mes, int anio, int? usuarioId = null)
    {
        var maquina = await _context.Maquinas.FirstOrDefaultAsync(m => m.Nombre.Contains(nombreMaquina));
        if (maquina == null) return NotFound("Maquina no encontrada");

        var query = _context.ProduccionDiaria
            .Where(p => p.MaquinaId == maquina.Id && p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (usuarioId.HasValue)
        {
            query = query.Where(p => p.UsuarioId == usuarioId.Value);
        }

        var produccion = await query
            .OrderBy(p => p.Fecha)
            .ToListAsync();

        var breakdown = new List<object>();
        decimal totalMeta = 0;

        var distinctDays = produccion.Select(p => p.Fecha.Date).Distinct().ToList();
        
        foreach (var day in distinctDays)
        {
            decimal metaDia = 0;
            string formula = "";

            var prodDia = produccion.Where(p => p.Fecha.Date == day).ToList();
            // AJUSTE: Sum both normal hours and dead time for total hours as per recent fix
            decimal horas = prodDia.Sum(p => p.TotalHoras);
            
            // Equivalence Data
            int cambios = prodDia.Sum(p => p.Cambios);
            // FIX: Use RendimientoFinal (decimal) to avoid truncation issues (same as GetResumen)
            decimal tirosDiariosDecimal = prodDia.Sum(p => p.RendimientoFinal);
            int tirosDiarios = (int)Math.Round(tirosDiariosDecimal);
            int tirosCambios = cambios * maquina.TirosReferencia;

            // Hourly Prorated Meta Logic
            // Meta = TotalHoras * (MetaBase / 8)
            decimal metaPorHora = (decimal)maquina.Meta100Porciento / 8;
            metaDia = horas * metaPorHora;
            formula = $"{Math.Round(horas, 2)}h * {Math.Round(metaPorHora, 2)}/h";

            totalMeta += metaDia;
            breakdown.Add(new { 
                Fecha = day.ToString("dd/MM/yyyy"),
                Meta = Math.Round(metaDia, 2),
                Horas = Math.Round(horas, 2),
                Formula = formula,
                Cambios = cambios,
                TirosDiarios = tirosDiarios,
                TirosCambios = tirosCambios
            });
        }

        return Ok(new { Total = Math.Round(totalMeta, 2), Desglose = breakdown });
    }

    [HttpDelete("history/clear")]
    public async Task<IActionResult> ClearHistory(int mes, int anio)
    {
        var records = await _context.RendimientoOperariosMensual
            .Where(r => r.Mes == mes && r.Anio == anio)
            .ToListAsync();

        if (records.Count == 0)
        {
            return Ok(new { message = "No history records found for this period." });
        }

        _context.RendimientoOperariosMensual.RemoveRange(records);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Deleted {records.Count} history records for {mes}/{anio}." });
    }

    [HttpPost("gastos/recalcular")]
    public async Task<IActionResult> RecalcularGastos()
    {
        var rubroHE = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        var rubroRecargo = await _context.Produccion_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");

        var ids = new List<int>();
        if (rubroHE != null) ids.Add(rubroHE.Id);
        if (rubroRecargo != null) ids.Add(rubroRecargo.Id);

        if (!ids.Any()) return Ok("No rubros found");

        var gastos = await _context.Produccion_Gastos
            .Where(g => ids.Contains(g.RubroId))
            .Include(g => g.Usuario) // Need User Salary
            .Include(g => g.TipoHora) // Need Factors
            .Include(g => g.TipoRecargo)
            .ToListAsync();

        int count = 0;
        foreach (var g in gastos)
        {
            if (g.Usuario == null || g.Usuario.Salario <= 0) continue;

            decimal factor = 0;
            if (g.RubroId == rubroHE?.Id && g.TipoHora != null) factor = g.TipoHora.Factor;
            if (g.RubroId == rubroRecargo?.Id && g.TipoRecargo != null) factor = g.TipoRecargo.Factor;
            
            if (factor > 0 && g.CantidadHoras > 0)
            {
                decimal hourlyRate = g.Usuario.Salario / 220m;
                g.Precio = Math.Round(hourlyRate * factor * g.CantidadHoras.Value, 2);
                count++;
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Recalculated {count} records." });
    }


    // ===================== OP SEARCH =====================
    /// <summary>
    /// Get all unique OP values from ReferenciaOP field
    /// OPs may be stored as "7077-7075" so we split by "-"
    /// Excludes invalid OPs like "0" and "460"
    /// </summary>
    [HttpGet("ops-unicos")]
    public async Task<IActionResult> GetOPsUnicos()
    {
        var excludedOPs = new HashSet<string> { "0", "460" };

        // Get OPs from ProduccionDiaria, ProduccionDiariaDetalles and also from OrdenesProduccion
        var opsMaestro = await _context.ProduccionDiaria
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP))
            .Select(p => p.ReferenciaOP)
            .ToListAsync();

        var opsDetalle = await _context.ProduccionDiariaDetalles
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP))
            .Select(p => p.ReferenciaOP)
            .ToListAsync();

        var opsOrdenes = await _context.OrdenesProduccion
            .Select(op => op.Numero)
            .ToListAsync();

        var allRaw = opsMaestro.Concat(opsDetalle).Concat(opsOrdenes).ToList();

        var uniqueOPs = allRaw
            .Where(op => !string.IsNullOrEmpty(op))
            .SelectMany(op => op!.Split(new[] { '-', '/', ',', ' ' }, StringSplitOptions.RemoveEmptyEntries))
            .Select(op => op.Trim())
            .Where(op => !string.IsNullOrWhiteSpace(op) && !excludedOPs.Contains(op))
            .Distinct()
            .OrderByDescending(op => int.TryParse(op, out var num) ? num : 0)
            .ToList();

        return Ok(uniqueOPs);
    }

    /// <summary>
    /// Search for machines that have a specific OP in their ReferenciaOP field
    /// Ordered by date descending, then machine number ascending
    /// </summary>
    [HttpGet("buscar-op/{op}")]
    public async Task<IActionResult> BuscarOP(string op)
    {
        if (string.IsNullOrWhiteSpace(op))
            return BadRequest("OP es requerida");

        op = op.Trim();

        // 1. Buscar en Detalles (donde hay actividades y tiros granulares)
        var detailedResults = await _context.ProduccionDiariaDetalles
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP) && EF.Functions.ILike(p.ReferenciaOP, $"%{op}%"))
            .Include(p => p.ProduccionDiaria)
                .ThenInclude(pd => pd.Maquina)
            .Include(p => p.Actividad)
            .Select(p => new {
                HeaderId = p.ProduccionDiariaId,
                MaquinaId = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.MaquinaId : 0,
                MaquinaNombre = (p.ProduccionDiaria != null && p.ProduccionDiaria.Maquina != null) ? p.ProduccionDiaria.Maquina.Nombre : "Desconocida",
                Fecha = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.Fecha : DateTime.MinValue,
                ReferenciaOP = p.ReferenciaOP,
                ActividadNombre = (p.Actividad != null) ? p.Actividad.Nombre : "N/A",
                Tiros = p.Tiros,
                Desperdicio = (p.ProduccionDiaria != null) ? p.ProduccionDiaria.Desperdicio : 0
            })
            .ToListAsync();

        // 2. Identificar qué cabeceras ya están representadas para no duplicar
        var representedHeaderIds = detailedResults.Select(r => r.HeaderId).Distinct().ToList();

        // 3. Buscar en la tabla principal (Headers) los que coincidan con la OP pero NO tengan detalles representados
        var headerOnlyResults = await _context.ProduccionDiaria
            .Where(p => !string.IsNullOrEmpty(p.ReferenciaOP) && EF.Functions.ILike(p.ReferenciaOP, $"%{op}%") && !representedHeaderIds.Contains(p.Id))
            .Include(p => p.Maquina)
            .Select(p => new {
                HeaderId = p.Id,
                MaquinaId = p.MaquinaId,
                MaquinaNombre = (p.Maquina != null) ? p.Maquina.Nombre : "Desconocida",
                Fecha = p.Fecha,
                ReferenciaOP = p.ReferenciaOP,
                ActividadNombre = "N/A",
                Tiros = 0,
                Desperdicio = p.Desperdicio
            })
            .ToListAsync();

        // 4. Buscar en Historial Antiguo / Tiempo Real (TiemposProceso)
        // Esto recupera datos de OPs que no se han consolidado o vienen de la versión anterior
        var historyResults = await _context.TiemposProceso
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.OrdenProduccion != null && EF.Functions.ILike(t.OrdenProduccion.Numero, $"%{op}%"))
            .Select(t => new {
                HeaderId = (long)-1, // Indica que no tiene cabecera mensual vinculada
                MaquinaId = t.MaquinaId,
                MaquinaNombre = (t.Maquina != null) ? t.Maquina.Nombre : "Desconocida",
                Fecha = t.Fecha,
                ReferenciaOP = t.OrdenProduccion!.Numero,
                ActividadNombre = (t.Actividad != null) ? t.Actividad.Nombre : "N/A",
                Tiros = t.Tiros,
                Desperdicio = (decimal)t.Desperdicio
            })
            .ToListAsync();

        // 5. Combinar todos los sets (eliminar duplicados muy cercanos si es necesario, pero mejor mostrar todo)
        var combinedResults = detailedResults.Cast<dynamic>()
            .Concat(headerOnlyResults.Cast<dynamic>())
            .Concat(historyResults.Cast<dynamic>())
            .ToList();

        // 6. Ordenar: fecha descendente y máquina por número
        var sortedResults = combinedResults
            .OrderByDescending(r => (DateTime)r.Fecha)
            .ThenBy(r => {
                string mName = (string)r.MaquinaNombre;
                var match = System.Text.RegularExpressions.Regex.Match(mName, @"^(\d+)");
                return match.Success ? int.Parse(match.Groups[1].Value) : 999;
            })
            .ThenBy(r => (string)r.MaquinaNombre)
            .ToList();

        return Ok(sortedResults);
    }

    // ===================== DÍA DETALLADO =====================
    /// <summary>
    /// Get all detail entries for a specific ProduccionDiaria record
    /// </summary>
    [HttpGet("dia-detalle/{produccionDiariaId}")]
    public async Task<IActionResult> GetDiaDetalle(long produccionDiariaId)
    {
        try
        {
            var detalles = await _context.ProduccionDiariaDetalles
                .Where(d => d.ProduccionDiariaId == produccionDiariaId)
                .Include(d => d.Actividad)
                .OrderBy(d => d.HoraInicio)
                .Select(d => new {
                    d.Id,
                    d.ProduccionDiariaId,
                    HoraInicio = d.HoraInicio.ToString(@"hh\:mm"),
                    HoraFin = d.HoraFin.ToString(@"hh\:mm"),
                    TiempoMinutos = (int)(d.HoraFin - d.HoraInicio).TotalMinutes,
                    d.ActividadId,
                    ActividadCodigo = d.Actividad != null ? d.Actividad.Codigo : "",
                    ActividadNombre = d.Actividad != null ? d.Actividad.Nombre : "",
                    d.Tiros,
                    d.ReferenciaOP,
                    d.Observaciones
                })
                .ToListAsync();

            return Ok(detalles);
        }
        catch (Exception ex)
        {
            return BadRequest($"Error en GetDiaDetalle: {ex.Message} - {ex.InnerException?.Message}");
        }
    }
    /// <summary>
    /// Recalcula todos los totales de ProduccionDiaria a partir de sus detalles.
    /// Usa para corregir datos históricos con cálculos incorrectos.
    /// </summary>
    [HttpPost("recalcular-totales")]
    public async Task<IActionResult> RecalcularTotales()
    {
        try
        {
            var allRecords = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .ToListAsync();

            int recalculados = 0;
            int errores = 0;

            foreach (var parent in allRecords)
            {
                try
                {
                    var savedDetails = await _context.ProduccionDiariaDetalles
                        .Include(d => d.Actividad)
                        .Where(d => d.ProduccionDiariaId == parent.Id)
                        .ToListAsync();

                    if (!savedDetails.Any()) continue;

                    // Reset counters
                    parent.TiempoPuestaPunto = 0;
                    parent.HorasOperativas = 0;
                    parent.TirosDiarios = 0;
                    parent.TiempoReparacion = 0;
                    parent.HorasDescanso = 0;
                    parent.TiempoOtroMuerto = 0;
                    parent.HorasMantenimiento = 0;
                    parent.TiempoFaltaTrabajo = 0;
                    parent.HorasOtrosAux = 0;

                    foreach (var d in savedDetails)
                    {
                        decimal horas = 0;
                        if (d.HoraFin > d.HoraInicio)
                            horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                        string codigo = d.Actividad?.Codigo ?? "";

                        switch (codigo)
                        {
                            case "01": parent.TiempoPuestaPunto += horas; break;
                            case "02":
                                parent.HorasOperativas += horas;
                                parent.TirosDiarios += d.Tiros;
                                break;
                            case "03": parent.TiempoReparacion += horas; break;
                            case "04": parent.HorasDescanso += horas; break;
                            case "08": parent.TiempoOtroMuerto += horas; break;
                            case "10": parent.HorasMantenimiento += horas; break;
                            case "13": parent.TiempoFaltaTrabajo += horas; break;
                            case "14": parent.HorasOtrosAux += horas; break;
                            default: parent.HorasOtrosAux += horas; break;
                        }
                    }

                    // Derived calculations
                    parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                    parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                    parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                    parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                    if (parent.HorasOperativas > 0)
                        parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;

                    _context.Entry(parent).State = EntityState.Modified;
                    recalculados++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[RECALC ERROR] Record {parent.Id}: {ex.Message}");
                    errores++;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = $"Recalculación completada. {recalculados} registros actualizados, {errores} errores." });
        }
        catch (Exception ex)
        {
            return BadRequest($"Error en RecalcularTotales: {ex.Message}");
        }
    }

    [HttpPost("dia-detalle")]
    public async Task<IActionResult> SaveDiaDetalle([FromBody] List<DiaDetalleDto> detalles)
    {
        try
        {
            if (detalles == null || !detalles.Any())
                return BadRequest("No se enviaron detalles");

            var produccionDiariaId = detalles.First().ProduccionDiariaId;
            
            // Delete existing details
            var existing = await _context.ProduccionDiariaDetalles
                .Where(d => d.ProduccionDiariaId == produccionDiariaId)
                .ToListAsync();
            _context.ProduccionDiariaDetalles.RemoveRange(existing);

            // Add new details (filter out empty rows)
            foreach (var dto in detalles.Where(d => !string.IsNullOrEmpty(d.HoraInicio) && !string.IsNullOrEmpty(d.HoraFin)))
            {
                // Skip rows with unparseable times (e.g. placeholder "HH:MM")
                if (!TimeSpan.TryParse(dto.HoraInicio, out var horaInicio) ||
                    !TimeSpan.TryParse(dto.HoraFin, out var horaFin))
                    continue;

                var detalle = new ProduccionDiariaDetalle
                {
                    ProduccionDiariaId = dto.ProduccionDiariaId,
                    HoraInicio = horaInicio,
                    HoraFin = horaFin,
                    ActividadId = dto.ActividadId,
                    Tiros = dto.Tiros,
                    ReferenciaOP = dto.ReferenciaOP,
                    Observaciones = dto.Observaciones
                };
                _context.ProduccionDiariaDetalles.Add(detalle);
            }

            await _context.SaveChangesAsync();

            // Recalculate parent ProduccionDiaria summary from saved details
            var parent = await _context.ProduccionDiaria
                .Include(p => p.Maquina)
                .FirstOrDefaultAsync(p => p.Id == produccionDiariaId);

            if (parent != null)
            {
                var savedDetails = await _context.ProduccionDiariaDetalles
                    .Include(d => d.Actividad)
                    .Where(d => d.ProduccionDiariaId == produccionDiariaId)
                    .ToListAsync();

                // Reset counters
                parent.TiempoPuestaPunto = 0;
                parent.HorasOperativas = 0;
                parent.TirosDiarios = 0;
                parent.Desperdicio = 0;
                parent.TiempoReparacion = 0;
                parent.HorasDescanso = 0;
                parent.TiempoOtroMuerto = 0;
                parent.HorasMantenimiento = 0;
                parent.TiempoFaltaTrabajo = 0;
                parent.HorasOtrosAux = 0;

                foreach (var d in savedDetails)
                {
                    decimal horas = 0;
                    if (d.HoraFin > d.HoraInicio)
                        horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                    string codigo = d.Actividad?.Codigo ?? "";

                    switch (codigo)
                    {
                        case "01": parent.TiempoPuestaPunto += horas; break;
                        case "02":
                            parent.HorasOperativas += horas;
                            parent.TirosDiarios += d.Tiros;
                            break;
                        case "03": parent.TiempoReparacion += horas; break;
                        case "04": parent.HorasDescanso += horas; break;
                        case "08": parent.TiempoOtroMuerto += horas; break;
                        case "10": parent.HorasMantenimiento += horas; break;
                        case "13": parent.TiempoFaltaTrabajo += horas; break;
                        case "14": parent.HorasOtrosAux += horas; break;
                        default: parent.HorasOtrosAux += horas; break;
                    }
                }

                // Derived calculations
                parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                if (parent.HorasOperativas > 0)
                {
                    parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;
                }

                await _context.SaveChangesAsync();
            }

            return Ok(new { success = true, message = "Detalles guardados correctamente" });
        }
        catch (Exception ex)
        {
             return BadRequest($"Error en SaveDiaDetalle: {ex.Message} - {ex.InnerException?.Message} - Stack: {ex.StackTrace}");
        }
    }

    /// <summary>
    /// Delete a single detail entry
    /// </summary>
    [HttpDelete("dia-detalle/{id}")]
    public async Task<IActionResult> DeleteDiaDetalle(int id)
    {
        var detalle = await _context.ProduccionDiariaDetalles.FindAsync(id);
        if (detalle == null)
            return NotFound();
        
        _context.ProduccionDiariaDetalles.Remove(detalle);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private TimeSpan ParseTime(string? timeStr)
    {
        if (string.IsNullOrWhiteSpace(timeStr)) return TimeSpan.Zero;
        
        // Intentar parseo directo (00:00:00)
        if (TimeSpan.TryParse(timeStr, out var ts)) return ts;

        // Intentar como DateTime (para manejar "7:00:00 a. m.")
        if (DateTime.TryParse(timeStr, out var dt)) return dt.TimeOfDay;

        // Limpieza agresiva para formatos raros de Excel
        // Reemplazar puntos y espacios raros: "a. m." -> "am", "p. m." -> "pm"
        string clean = timeStr.Replace(".", "").Replace(" ", "").ToLower(); 
        if (DateTime.TryParse(clean, out var dtClean)) return dtClean.TimeOfDay;
        
        // Intentar agregar un espacio antes de am/pm si no lo tiene
        if (clean.EndsWith("am") || clean.EndsWith("pm")) {
            string withSpace = clean.Insert(clean.Length - 2, " ");
            if (DateTime.TryParse(withSpace, out var dtSpace)) return dtSpace.TimeOfDay;
        }

        return TimeSpan.Zero;
    }

    /// <summary>
    /// Recalculate dead hours for ALL ProduccionDiaria that have Día Detallado entries
    /// </summary>
    [HttpPost("recalcular-horas-muertas")]
    public async Task<IActionResult> RecalcularHorasMuertasDesdeDetalles()
    {
        try
        {
            var parentIds = await _context.ProduccionDiariaDetalles
                .Select(d => d.ProduccionDiariaId)
                .Distinct()
                .ToListAsync();

            int updated = 0;

            foreach (var parentId in parentIds)
            {
                var parent = await _context.ProduccionDiaria
                    .FirstOrDefaultAsync(p => p.Id == parentId);
                if (parent == null) continue;

                var details = await _context.ProduccionDiariaDetalles
                    .Include(d => d.Actividad)
                    .Where(d => d.ProduccionDiariaId == parentId)
                    .ToListAsync();
                if (!details.Any()) continue;

                // Reset
                parent.TiempoPuestaPunto = 0;
                parent.HorasOperativas = 0;
                parent.TirosDiarios = 0;
                parent.Desperdicio = 0;
                parent.TiempoReparacion = 0;
                parent.HorasDescanso = 0;
                parent.TiempoOtroMuerto = 0;
                parent.HorasMantenimiento = 0;
                parent.TiempoFaltaTrabajo = 0;
                parent.HorasOtrosAux = 0;

                foreach (var d in details)
                {
                    decimal horas = 0;
                    if (d.HoraFin > d.HoraInicio)
                        horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                    string codigo = d.Actividad?.Codigo ?? "";
                    switch (codigo)
                    {
                        case "01": parent.TiempoPuestaPunto += horas; break;
                        case "02":
                            parent.HorasOperativas += horas;
                            parent.TirosDiarios += d.Tiros;
                            break;
                        case "03": parent.TiempoReparacion += horas; break;
                        case "04": parent.HorasDescanso += horas; break;
                        case "08": parent.TiempoOtroMuerto += horas; break;
                        case "10": parent.HorasMantenimiento += horas; break;
                        case "13": parent.TiempoFaltaTrabajo += horas; break;
                        case "14": parent.HorasOtrosAux += horas; break;
                        default: parent.HorasOtrosAux += horas; break;
                    }
                }

                parent.TotalHorasProductivas = parent.HorasOperativas + parent.TiempoPuestaPunto;
                parent.TotalHorasAuxiliares = parent.HorasMantenimiento + parent.HorasDescanso + parent.HorasOtrosAux;
                parent.TotalTiemposMuertos = parent.TiempoFaltaTrabajo + parent.TiempoReparacion + parent.TiempoOtroMuerto;
                parent.TotalHoras = parent.TotalHorasProductivas + parent.TotalHorasAuxiliares + parent.TotalTiemposMuertos;

                if (parent.HorasOperativas > 0)
                    parent.PromedioHoraProductiva = parent.TirosDiarios / parent.HorasOperativas;

                updated++;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = $"Recalculados {updated} registros" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

// DTO for day detail
public class DiaDetalleDto
{
    public int Id { get; set; }
    public long ProduccionDiariaId { get; set; }
    public string? HoraInicio { get; set; }
    public string? HoraFin { get; set; }
    public int ActividadId { get; set; }
    public int Tiros { get; set; }
    public string? ReferenciaOP { get; set; }
    public string? Observaciones { get; set; }
}
