using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Controllers;

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
        "Pegadora", "Terminados", "Taller Externo", "Tejedora"
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
            FechaCreacion = DateTime.Now
        };

        _context.EncuestasCalidad.Add(encuesta);
        await _context.SaveChangesAsync();

        // Procesar novedades con fotos
        var fotosDir = Path.Combine(_env.ContentRootPath, "wwwroot", "fotos-calidad");
        if (!Directory.Exists(fotosDir))
            Directory.CreateDirectory(fotosDir);

        foreach (var novedadDto in dto.Novedades)
        {
            var novedad = new EncuestaNovedad
            {
                EncuestaId = encuesta.Id,
                TipoNovedad = novedadDto.TipoNovedad,
                Descripcion = novedadDto.Descripcion,
                CantidadDefectuosa = novedadDto.CantidadDefectuosa
            };

            if (!string.IsNullOrEmpty(novedadDto.FotoBase64))
            {
                // Nueva foto en base64 - guardar normalmente
                try
                {
                    var fileName = $"{Guid.NewGuid()}.jpg";
                    var filePath = Path.Combine(fotosDir, fileName);
                    
                    // Remover prefijo data:image/...;base64, si existe
                    var base64Data = novedadDto.FotoBase64;
                    if (base64Data.Contains(","))
                        base64Data = base64Data.Split(',')[1];
                    
                    var imageBytes = Convert.FromBase64String(base64Data);
                    
                    await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);
                    
                    novedad.FotoPath = filePath;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error guardando foto: {ex.Message}");
                }
            }
            else if (!string.IsNullOrEmpty(novedadDto.FotoUrl))
            {
                // Foto existente - extraer nombre del archivo de la URL y usar la ruta existente
                try
                {
                    // La URL viene como algo como: http://192.168.100.227:5144/fotos-calidad/xxx.jpg
                    // O como: fotos-calidad/xxx.jpg
                    var fileName = Path.GetFileName(new Uri(novedadDto.FotoUrl, UriKind.RelativeOrAbsolute).AbsolutePath);
                    if (string.IsNullOrEmpty(fileName))
                    {
                        fileName = novedadDto.FotoUrl.Split('/').LastOrDefault() ?? "";
                    }
                    
                    var existingPath = Path.Combine(fotosDir, fileName);
                    
                    if (System.IO.File.Exists(existingPath))
                    {
                        // La foto existe, reutilizarla
                        novedad.FotoPath = existingPath;
                        Console.WriteLine($"Foto preservada: {existingPath}");
                    }
                    else
                    {
                        Console.WriteLine($"Foto no encontrada: {existingPath}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error preservando foto existente: {ex.Message}");
                }
            }

            _context.EncuestaNovedades.Add(novedad);
        }

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetEncuesta), new { id = encuesta.Id }, new { id = encuesta.Id });
    }

    [HttpDelete("encuestas/{id}")]
    public async Task<IActionResult> EliminarEncuesta(int id)
    {
        try
        {
            var encuesta = await _context.EncuestasCalidad
                .Include(e => e.Novedades)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (encuesta == null)
                return NotFound(new { message = $"Encuesta con ID {id} no encontrada" });

            // Eliminar fotos del disco
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

}
