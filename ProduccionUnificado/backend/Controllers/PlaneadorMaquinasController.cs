using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Services;
using TiempoProcesos.API.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class PlaneadorMaquinasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AdjuntosExtractionService _extraccion;

    public static readonly string[] ProcesosDisponibles =
    {
        "Conversion", "Corrugacion", "Corte", "Impresion", "Acabado",
        "Colaminado", "Troquelado", "Despique", "Pegadora", "Terminado Manual"
    };

    private static readonly string[] OpColors =
    {
        "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
        "#06B6D4", "#6366F1", "#EAB308", "#22C55E", "#EF4444"
    };

    public PlaneadorMaquinasController(AppDbContext context, AdjuntosExtractionService extraccion)
    {
        _context = context;
        _extraccion = extraccion;
    }

    [HttpGet("rango")]
    public async Task<IActionResult> GetByRango([FromQuery] string start, [FromQuery] string end)
    {
        if (!DateTime.TryParse(start, out var startDate) || !DateTime.TryParse(end, out var endDate))
        {
            return BadRequest("Formato de fecha inválido.");
        }

        var planes = await _context.PlaneacionesMaquinas
            .Include(p => p.Maquina)
            .Include(p => p.OrdenProduccion)
            .Where(p => p.FechaInicio >= startDate && p.FechaFin <= endDate)
            .ToListAsync();

        return Ok(planes);
    }

    [HttpGet("actual")]
    public async Task<IActionResult> GetPlanActual(
        [FromQuery] int maquinaId,
        [FromQuery] int? horarioId = null,
        [FromQuery] int? usuarioId = null)
    {
        var (result, sinCoincidencia) = await BuildActualOperarioDto(maquinaId, horarioId, usuarioId);
        if (sinCoincidencia != null) return Ok(sinCoincidencia);
        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>Vista operario: programación Gantt + roster cuando coinciden máquina, turno y operario.</summary>
    [HttpGet("programacion/actual-operario")]
    public async Task<IActionResult> GetProgramacionActualOperario(
        [FromQuery] int maquinaId,
        [FromQuery] int? horarioId = null,
        [FromQuery] int? usuarioId = null)
    {
        var (result, sinCoincidencia) = await BuildActualOperarioDto(maquinaId, horarioId, usuarioId);
        if (sinCoincidencia != null) return Ok(sinCoincidencia);
        if (result == null) return NotFound();
        return Ok(result);
    }

    // Endpoints de Telemetría con prefijo único para evitar conflictos de ruteo
    [HttpGet("telemetria/estado")]
    public async Task<IActionResult> GetEstadoActualMaquinas()
    {
        var today = DateTime.Today;
        var limitDate = today.AddDays(-1);

        var tirosHoy = await _context.TiemposProceso
            .AsNoTracking()
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha >= today
                && t.Actividad != null
                && t.Actividad.Codigo == "02"
                && t.OrdenProduccion != null)
            .GroupBy(t => new { t.MaquinaId, Num = t.OrdenProduccion!.Numero })
            .Select(g => new { g.Key.MaquinaId, g.Key.Num, Total = g.Sum(x => x.Tiros) })
            .ToListAsync();

        var tirosPorOpMaquina = tirosHoy.ToDictionary(
            x => $"{x.MaquinaId}|{SoloDigitosOp(x.Num)}",
            x => x.Total);

        var activos = await _context.TiemposProceso
            .AsNoTracking()
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha >= limitDate
                && (t.Estado == "EnProgreso" || t.Estado == "Pausado"))
            .ToListAsync();

        var procesos = activos
            .Where(t => t.Actividad != null
                && (t.Actividad.Codigo == "01" || t.Actividad.Codigo == "02"))
            .Select(t =>
            {
                var opNum = t.OrdenProduccion?.Numero ?? "";
                var opKey = SoloDigitosOp(opNum);
                tirosPorOpMaquina.TryGetValue($"{t.MaquinaId}|{opKey}", out var tirosAcum);
                var pausaSeg = t.TiempoPausadoSegundos;
                long duracionSeg = 0;
                if (t.Estado == "Pausado" && t.PausadoEn.HasValue)
                {
                    duracionSeg = (long)Math.Max(0,
                        (t.PausadoEn.Value - t.HoraInicio).TotalSeconds - pausaSeg);
                }
                else if (t.Estado == "EnProgreso")
                {
                    duracionSeg = (long)Math.Max(0,
                        (DateTime.Now - t.HoraInicio).TotalSeconds - pausaSeg);
                }

                return new
                {
                    t.MaquinaId,
                    ActividadCodigo = t.Actividad!.Codigo,
                    ActividadNombre = t.Actividad.Nombre,
                    t.ActividadId,
                    t.OrdenProduccionId,
                    OrdenProduccionNumero = opNum,
                    t.HoraInicio,
                    t.HoraFin,
                    EsActivo = true,
                    t.Estado,
                    t.Tiros,
                    TirosAcumuladosOpMaquinaHoy = tirosAcum,
                    t.TiempoPausadoSegundos,
                    t.PausadoEn,
                    DuracionSegundos = duracionSeg,
                };
            })
            .ToList();

        var tirosLista = tirosHoy.Select(x => new
        {
            x.MaquinaId,
            OrdenProduccionNumero = x.Num,
            Total = x.Total,
        }).ToList();

        return Ok(new
        {
            activos = procesos,
            tirosPorOpMaquina = tirosLista,
            serverTime = DateTime.Now,
        });
    }

    private static string SoloDigitosOp(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var digits = Regex.Replace(value, @"\D", "");
        return digits.TrimStart('0');
    }

    [HttpGet("telemetria/debug")]
    public async Task<IActionResult> GetDebugData()
    {
        try 
        {
            var total = await _context.TiemposProceso.CountAsync();
            var todayCount = await _context.TiemposProceso.CountAsync(t => t.Fecha >= DateTime.Today);
            var recent = await _context.TiemposProceso
                .OrderByDescending(t => t.Id)
                .Take(10)
                .Select(t => new { t.Id, t.Fecha, t.HoraInicio, t.MaquinaId, t.OrdenProduccionId })
                .ToListAsync();
                
            return Ok(new { total, todayCount, recent });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> CrearPlan([FromBody] PlaneacionMaquina plan)
    {
        if (plan.FechaInicio >= plan.FechaFin) return BadRequest("La fecha de inicio debe ser anterior a la fecha de fin.");

        // Check for overlaps
        var overlap = await _context.PlaneacionesMaquinas
            .AnyAsync(p => p.MaquinaId == plan.MaquinaId && p.FechaInicio < plan.FechaFin && p.FechaFin > plan.FechaInicio);

        if (overlap) return BadRequest("La máquina ya tiene una planeación en el horario seleccionado.");

        _context.PlaneacionesMaquinas.Add(plan);
        await _context.SaveChangesAsync();
        
        // Cargar los includes para devolver el objeto completo
        var savedPlan = await _context.PlaneacionesMaquinas
            .Include(p => p.Maquina)
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.Id == plan.Id);
            
        return CreatedAtAction(nameof(GetPlanActual), new { maquinaId = plan.MaquinaId }, savedPlan);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeletePlaneacion(int id)
    {
        var plan = await _context.PlaneacionesMaquinas.FindAsync(id);
        if (plan == null) return NotFound();

        _context.PlaneacionesMaquinas.Remove(plan);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdatePlaneacion(int id, PlaneacionMaquina updated)
    {
        if (id != updated.Id) return BadRequest();

        var existing = await _context.PlaneacionesMaquinas.FindAsync(id);
        if (existing == null) return NotFound();

        existing.OrdenProduccionId = updated.OrdenProduccionId;
        existing.FechaInicio = updated.FechaInicio;
        existing.FechaFin = updated.FechaFin;
        existing.MetaTiros = updated.MetaTiros;
        existing.Referencia = updated.Referencia;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ==================== PROGRAMACIÓN OP (GANTT) ====================

    [HttpGet("facturacion/meta")]
    public async Task<IActionResult> GetMetaFacturacion([FromQuery] int anio, [FromQuery] int mes)
    {
        if (anio < 2000 || mes < 1 || mes > 12)
            return BadRequest("Año/mes inválidos.");

        var row = await _context.MetasFacturacionMes
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Anio == anio && m.Mes == mes);

        return Ok(new MetaFacturacionMesDto
        {
            Anio = anio,
            Mes = mes,
            Meta = row?.Meta ?? 0,
        });
    }

    [HttpPut("facturacion/meta")]
    public async Task<IActionResult> UpsertMetaFacturacion([FromBody] MetaFacturacionMesDto dto)
    {
        if (dto.Anio < 2000 || dto.Mes < 1 || dto.Mes > 12)
            return BadRequest("Año/mes inválidos.");
        if (dto.Meta < 0)
            return BadRequest("La meta no puede ser negativa.");

        var row = await _context.MetasFacturacionMes
            .FirstOrDefaultAsync(m => m.Anio == dto.Anio && m.Mes == dto.Mes);

        if (row == null)
        {
            row = new MetaFacturacionMes
            {
                Anio = dto.Anio,
                Mes = dto.Mes,
                Meta = dto.Meta,
                FechaModificacion = DateTime.Now,
            };
            _context.MetasFacturacionMes.Add(row);
        }
        else
        {
            row.Meta = dto.Meta;
            row.FechaModificacion = DateTime.Now;
        }

        await _context.SaveChangesAsync();
        return Ok(new MetaFacturacionMesDto { Anio = row.Anio, Mes = row.Mes, Meta = row.Meta });
    }

    [HttpGet("procesos")]
    public async Task<IActionResult> GetProcesosDisponibles()
    {
        var list = await _context.ProcesosGantt
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Orden)
            .ToListAsync();

        if (list.Count == 0)
        {
            return Ok(ProcesosDisponibles.Select((n, i) => new ProcesoGanttDto { Id = 0, Nombre = n, Orden = i }).ToList());
        }

        return Ok(list.Select(p => new ProcesoGanttDto { Id = p.Id, Nombre = p.Nombre, Orden = p.Orden }));
    }

    [HttpPost("procesos")]
    public async Task<IActionResult> CrearProceso([FromBody] ProcesoGanttInputDto dto)
    {
        var nombre = dto.Nombre?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(nombre))
            return BadRequest("El nombre del proceso es obligatorio.");

        var existente = await _context.ProcesosGantt.FirstOrDefaultAsync(p =>
            p.Nombre.ToLower() == nombre.ToLower());
        if (existente != null && existente.Activo)
            return BadRequest("Ya existe un proceso con ese nombre.");

        var maxOrden = await _context.ProcesosGantt.MaxAsync(p => (int?)p.Orden) ?? -1;
        ProcesoGantt proceso;
        if (existente != null)
        {
            // Estaba eliminado (soft-delete por estar en uso): se reactiva para no violar el UNIQUE del nombre.
            existente.Activo = true;
            existente.Orden = maxOrden + 1;
            proceso = existente;
        }
        else
        {
            proceso = new ProcesoGantt { Nombre = nombre, Orden = maxOrden + 1, Activo = true };
            _context.ProcesosGantt.Add(proceso);
        }
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProcesosDisponibles), new ProcesoGanttDto
        {
            Id = proceso.Id,
            Nombre = proceso.Nombre,
            Orden = proceso.Orden,
        });
    }

    [HttpPut("procesos/{id:int}")]
    public async Task<IActionResult> ActualizarProceso(int id, [FromBody] ProcesoGanttInputDto dto)
    {
        var proceso = await _context.ProcesosGantt.FindAsync(id);
        if (proceso == null || !proceso.Activo)
            return NotFound();

        var nombre = dto.Nombre?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(nombre))
            return BadRequest("El nombre del proceso es obligatorio.");

        // Incluye inactivos: el nombre tiene índice UNIQUE en la tabla.
        var dup = await _context.ProcesosGantt.AnyAsync(p =>
            p.Id != id && p.Nombre.ToLower() == nombre.ToLower());
        if (dup)
            return BadRequest("Ya existe otro proceso con ese nombre.");

        var oldName = proceso.Nombre;
        if (!string.Equals(oldName, nombre, StringComparison.Ordinal))
        {
            var enUso = await _context.ProgramacionesOPProcesos.AnyAsync(x => x.Proceso == oldName);
            if (enUso)
            {
                var rows = await _context.ProgramacionesOPProcesos.Where(x => x.Proceso == oldName).ToListAsync();
                foreach (var row in rows) row.Proceso = nombre;
            }
        }

        proceso.Nombre = nombre;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("procesos/reordenar")]
    public async Task<IActionResult> ReordenarProcesos([FromBody] ReordenarProcesosDto dto)
    {
        var ids = dto.Ids ?? new List<int>();
        if (ids.Count == 0)
            return BadRequest("Indique el orden de los procesos.");

        for (var i = 0; i < ids.Count; i++)
        {
            var p = await _context.ProcesosGantt.FindAsync(ids[i]);
            if (p != null && p.Activo)
                p.Orden = i;
        }
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("procesos/{id:int}")]
    public async Task<IActionResult> EliminarProceso(int id)
    {
        var proceso = await _context.ProcesosGantt.FindAsync(id);
        if (proceso == null || !proceso.Activo)
            return NotFound();

        var enUso = await _context.ProgramacionesOPProcesos.AnyAsync(x => x.Proceso == proceso.Nombre);
        if (enUso)
        {
            proceso.Activo = false;
        }
        else
        {
            _context.ProcesosGantt.Remove(proceso);
        }
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("programacion/ops-disponibles")]
    public async Task<IActionResult> GetOpsDisponibles([FromQuery] string? q)
    {
        var biblioteca = await _extraccion.ListarBibliotecaAsync(q);
        var programadas = await _context.ProgramacionesOP
            .AsNoTracking()
            .Select(p => p.NumeroOP)
            .ToListAsync();
        var programadasSet = new HashSet<string>(
            programadas.Select(SoloDigitos).Where(s => !string.IsNullOrEmpty(s)),
            StringComparer.OrdinalIgnoreCase);

        var items = biblioteca.Items
            .Where(i => i.TieneOp)
            .Select(i =>
            {
                var cliente = GetCampo(i.Op?.Campos, "cliente")
                    ?? GetCampo(i.Ficha?.Campos, "cliente");
                var referencia = GetCampo(i.Op?.Campos, "trabajo")
                    ?? GetCampo(i.Ficha?.Campos, "nombreProductoReferencia");
                var ctd = ParseCantidadOp(GetCampo(i.Op?.Campos, "ctdAProducir"));
                return new OpDisponibleProgramacionDto
                {
                    Numero = i.Numero,
                    TieneFicha = i.TieneFicha,
                    TieneOp = i.TieneOp,
                    TieneLineaTroquel = i.TieneLineaTroquel,
                    YaProgramada = programadasSet.Contains(i.Numero),
                    Cliente = cliente,
                    Referencia = referencia,
                    MetaTiros = ctd > 0 ? ctd : null
                };
            })
            .OrderByDescending(x => int.TryParse(x.Numero, out var n) ? n : 0)
            .ToList();

        return Ok(items);
    }

    [HttpGet("programacion/datos-op")]
    public async Task<IActionResult> GetDatosOpProgramacion([FromQuery] string? numero)
    {
        var digits = SoloDigitos(numero);
        if (string.IsNullOrEmpty(digits))
            return BadRequest("Indique un número de OP válido.");

        var adjuntos = await _extraccion.ObtenerOExtraerAsync(digits, forzar: false);
        var catalogo = await _context.CatalogoOrdenesProduccion
            .AsNoTracking()
            .Where(x => x.Numero == digits)
            .OrderByDescending(x => x.Anio)
            .ThenByDescending(x => x.Mes)
            .FirstOrDefaultAsync();

        // Re-parsear desde texto guardado para aplicar reglas OCR nuevas (tintas, etc.)
        var opCampos = MergeCamposOp(adjuntos.Op);
        var fichaCampos = MergeCamposFicha(adjuntos.Ficha);

        var tieneOp = adjuntos.Op != null;
        var tieneLt = adjuntos.LineaTroquel != null;
        var tieneFicha = adjuntos.Ficha != null;
        var listo = tieneOp;

        var ordenCompra = GetCampo(opCampos, "compraCliente");
        // La OT no es la orden de compra del cliente; si no hay OT en OCR, se deja vacía para captura manual.
        string? numeroOT = null;

        var lineaTroquel = GetCampo(opCampos, "codigoTroquel");
        if (string.IsNullOrWhiteSpace(lineaTroquel) && tieneLt)
            lineaTroquel = $"LT{digits}";

        var cliente = GetCampo(opCampos, "cliente")
            ?? GetCampo(fichaCampos, "cliente")
            ?? catalogo?.Cliente ?? "";
        var referencia = GetCampo(opCampos, "trabajo")
            ?? GetCampo(fichaCampos, "nombreProductoReferencia")
            ?? catalogo?.Referencia ?? "";

        var cantidadSolicitada = ParseCantidadOp(GetCampo(opCampos, "ctdAProducir"));
        if (cantidadSolicitada <= 0 && catalogo != null)
            cantidadSolicitada = (int)Math.Round(catalogo.CantidadPlanificada);

        var nombresProcesos = await GetNombresProcesosActivosAsync();
        var piezas = ParsePiezasFromCampos(opCampos);
        var procesosSugeridos = SugerirProcesosDesdeOp(opCampos, nombresProcesos, piezas);

        var cabidadRaw = GetCampo(opCampos, "cb");
        var tamanoFinal = GetCampo(opCampos, "tamanoFinal");
        var (largoTam, anchoTam) = ParseTamanoFinal(tamanoFinal);
        var largo = GetCampo(opCampos, "anchoPliego") ?? largoTam;
        var ancho = GetCampo(opCampos, "altoPliego") ?? anchoTam;

        var tintaStr = GetCampo(fichaCampos, "cantidadTinta");
        int? cantidadTinta = int.TryParse(tintaStr, out var tintaN) ? tintaN : null;

        var tirosRegistrados = await _context.TiemposProceso
            .AsNoTracking()
            .Include(t => t.OrdenProduccion)
            .Where(t => t.OrdenProduccion != null
                && (t.OrdenProduccion.Numero == digits
                    || t.OrdenProduccion.Numero.EndsWith(digits)
                    || t.OrdenProduccion.Numero.Contains(digits)))
            .SumAsync(t => (int?)t.Tiros) ?? 0;

        string? mensaje = null;
        if (!tieneOp) mensaje = "Falta adjuntar el documento OP en Planeación.";

        var progExistente = await _context.ProgramacionesOP.AsNoTracking()
            .Where(p => !p.EsUrgencia
                && (p.TipoActividad == null || p.TipoActividad == "" || p.TipoActividad == "op")
                && (p.NumeroOP == digits || p.NumeroOP == (numero ?? "").Trim()))
            .Select(p => new { p.Id })
            .FirstOrDefaultAsync();

        return Ok(new DatosOpProgramacionDto
        {
            Numero = digits,
            TieneFicha = tieneFicha,
            TieneOp = tieneOp,
            TieneLineaTroquel = tieneLt,
            ListoParaProgramar = listo,
            YaProgramada = progExistente != null,
            ProgramacionId = progExistente?.Id,
            NumeroOT = numeroOT,
            OrdenCompra = ordenCompra,
            LineaTroquel = lineaTroquel,
            Cliente = cliente,
            Referencia = referencia,
            MetaTiros = cantidadSolicitada,
            ProcesosSugeridos = procesosSugeridos,
            Mensaje = mensaje,
            FechaEntrega = GetCampo(opCampos, "fechaDespacho"),
            Sustrato = PrimeroNoVacio(GetCampo(opCampos, "material"), GetCampo(fichaCampos, "sustrato")),
            Calibre = PrimeroNoVacio(GetCampo(opCampos, "calibre"), GetCampo(fichaCampos, "calibre")),
            Gramaje = PrimeroNoVacio(GetCampo(opCampos, "gramaje"), GetCampo(fichaCampos, "gramaje")),
            AnchoRollo = GetCampo(opCampos, "anchoRollo"),
            LargoCorte = GetCampo(opCampos, "largoCorte"),
            Hojas = GetCampo(opCampos, "hojas"),
            Cabidad = cabidadRaw,
            Largo = PrimeroNoVacio(largo, largoTam),
            Ancho = PrimeroNoVacio(ancho, anchoTam),
            TamanoFinal = tamanoFinal,
            CantidadTinta = cantidadTinta,
            Colores = PrimeroNoVacio(GetCampo(fichaCampos, "colores")),
            TipoTrabajoHint = PrimeroNoVacio(GetCampo(fichaCampos, "tipoTrabajoHint")),
            CantidadSolicitada = cantidadSolicitada,
            TirosRegistrados = tirosRegistrados,
            CantidadPiezas = piezas.Count > 0 ? piezas.Count : (int.TryParse(GetCampo(opCampos, "cantidadPiezas"), out var cp) ? cp : 1),
            MultiPieza = piezas.Count > 1,
            Piezas = piezas,
        });
    }

    private static Dictionary<string, string> MergeCamposOp(AdjuntoExtraccionDocumentoDto? doc)
    {
        if (doc == null) return new(StringComparer.OrdinalIgnoreCase);
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (doc.Campos != null)
            foreach (var kv in doc.Campos)
                if (!string.IsNullOrWhiteSpace(kv.Value))
                    merged[kv.Key] = kv.Value.Trim();
        if (!string.IsNullOrWhiteSpace(doc.TextoCompleto))
        {
            var fresh = AdjuntosDocumentParser.ParseCampos(
                doc.TextoCompleto, "OP", merged.GetValueOrDefault("numeroOp") ?? "");
            foreach (var kv in fresh)
                if (!string.IsNullOrWhiteSpace(kv.Value))
                    merged[kv.Key] = kv.Value.Trim();
        }
        return merged;
    }

    private static Dictionary<string, string> MergeCamposFicha(AdjuntoExtraccionDocumentoDto? doc)
    {
        if (doc == null) return new(StringComparer.OrdinalIgnoreCase);
        var merged = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (doc.Campos != null)
            foreach (var kv in doc.Campos)
                if (!string.IsNullOrWhiteSpace(kv.Value))
                    merged[kv.Key] = kv.Value.Trim();
        if (!string.IsNullOrWhiteSpace(doc.TextoCompleto))
        {
            var fresh = AdjuntosDocumentParser.ParseCampos(doc.TextoCompleto, "Ficha", "");
            foreach (var kv in fresh)
                if (!string.IsNullOrWhiteSpace(kv.Value))
                    merged[kv.Key] = kv.Value.Trim();
        }
        return merged;
    }

    private static string? PrimeroNoVacio(params string?[] valores)
    {
        foreach (var v in valores)
            if (!string.IsNullOrWhiteSpace(v)) return v.Trim();
        return null;
    }

    private static (string? Largo, string? Ancho) ParseTamanoFinal(string? tamano)
    {
        if (string.IsNullOrWhiteSpace(tamano)) return (null, null);
        var m = System.Text.RegularExpressions.Regex.Match(tamano, @"([\d.,]+)\s*[xX×]\s*([\d.,]+)");
        if (!m.Success) return (null, null);
        return (m.Groups[1].Value.Trim(), m.Groups[2].Value.Trim());
    }

    [HttpGet("maquinas/parametros-calculo")]
    public async Task<IActionResult> GetParametrosCalculoMaquinas()
    {
        var list = await _context.Maquinas.AsNoTracking()
            .Where(m => m.Activo)
            .OrderBy(m => m.Nombre)
            .ToListAsync();

        var result = list.Select(m =>
        {
            var meta = m.Meta100Porciento > 0 ? m.Meta100Porciento : m.MetaRendimiento;
            return new ParametrosCalculoMaquinaDto
            {
                MaquinaId = m.Id,
                Nombre = m.Nombre,
                MetaTirosTurno = meta,
                EstandarPorHora = meta > 0 ? Math.Round(meta / 8m, 2) : 0,
                HorasAlistamiento = m.HorasAlistamiento,
                HorasLavada = m.HorasLavada,
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPut("maquinas/{id:int}/parametros-calculo")]
    public async Task<IActionResult> UpsertParametrosCalculoMaquina(int id, [FromBody] ParametrosCalculoMaquinaDto dto)
    {
        var maquina = await _context.Maquinas.FindAsync(id);
        if (maquina == null) return NotFound();

        if (dto.HorasAlistamiento < 0 || dto.HorasLavada < 0)
            return BadRequest("Los tiempos de alistamiento y lavada no pueden ser negativos.");

        maquina.HorasAlistamiento = dto.HorasAlistamiento;
        maquina.HorasLavada = dto.HorasLavada;
        await _context.SaveChangesAsync();

        var meta = maquina.Meta100Porciento > 0 ? maquina.Meta100Porciento : maquina.MetaRendimiento;
        return Ok(new ParametrosCalculoMaquinaDto
        {
            MaquinaId = maquina.Id,
            Nombre = maquina.Nombre,
            MetaTirosTurno = meta,
            EstandarPorHora = meta > 0 ? Math.Round(meta / 8m, 2) : 0,
            HorasAlistamiento = maquina.HorasAlistamiento,
            HorasLavada = maquina.HorasLavada,
        });
    }

    [HttpGet("programacion/rango")]
    public async Task<IActionResult> GetProgramacionesRango([FromQuery] string start, [FromQuery] string end)
    {
        if (!DateTime.TryParse(start, out var startDate) || !DateTime.TryParse(end, out var endDate))
            return BadRequest("Formato de fecha inválido.");

        var programaciones = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .Where(p => p.Procesos.Any(pr =>
                pr.FechaInicio <= endDate && pr.FechaFin >= startDate))
            .OrderBy(p => p.NumeroOP)
            .ToListAsync();

        var encuestas = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .Where(e => programaciones.Select(p => p.NumeroOP).Contains(e.OrdenProduccion))
            .ToListAsync();

        var maquinas = await _context.Maquinas.AsNoTracking()
            .ToDictionaryAsync(m => m.Id, m => m.Nombre);

        var result = programaciones.Select(p => MapToDetalleDto(p, encuestas, maquinas)).ToList();
        return Ok(result);
    }

    [HttpGet("programacion/{id:int}")]
    public async Task<IActionResult> GetProgramacion(int id)
    {
        var programacion = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (programacion == null) return NotFound();

        var encuestas = await _context.EncuestasCalidadProduccion
            .Include(e => e.Procesos)
            .Where(e => e.OrdenProduccion == programacion.NumeroOP)
            .ToListAsync();

        var maquinas = await _context.Maquinas.AsNoTracking()
            .ToDictionaryAsync(m => m.Id, m => m.Nombre);

        return Ok(MapToDetalleDto(programacion, encuestas, maquinas));
    }

    [HttpPost("programacion")]
    public async Task<IActionResult> CrearProgramacion([FromBody] CrearProgramacionOPDto dto)
    {
        try
        {
            if (!dto.EsUrgencia && string.IsNullOrWhiteSpace(dto.NumeroOP))
                return BadRequest("El número de OP es obligatorio.");
            if (dto.Procesos == null || dto.Procesos.Count == 0)
                return BadRequest("Debe asignar al menos un proceso.");

            if (dto.EsUrgencia && string.IsNullOrWhiteSpace(dto.NumeroOP))
                dto.NumeroOP = $"URG-{DateTime.Now:yyyyMMdd-HHmm}";

            foreach (var proc in dto.Procesos)
            {
                if (proc.FechaInicio >= proc.FechaFin)
                    return BadRequest($"El proceso {proc.Proceso} tiene fechas/horas inválidas.");
            }

            if (!dto.EsUrgencia)
            {
                var digitsOp = SoloDigitos(dto.NumeroOP);
                if (!string.IsNullOrEmpty(digitsOp))
                {
                    var yaExiste = await _context.ProgramacionesOP.AsNoTracking()
                        .AnyAsync(p =>
                            !p.EsUrgencia
                            && (p.TipoActividad == null || p.TipoActividad == "" || p.TipoActividad == "op")
                            && (p.NumeroOP == digitsOp || p.NumeroOP == dto.NumeroOP.Trim()));
                    if (yaExiste)
                        return BadRequest($"La OP {digitsOp} ya está programada. Ábrala desde el Gantt para editarla o agregar más procesos.");
                }

                var cruces = await ValidarCrucesHorario(dto.Procesos, excludeProgramacionId: null);
                if (cruces != null) return BadRequest(cruces);

                var docError = await ValidarDocumentosPlaneacion(dto);
                if (docError != null) return BadRequest(docError);
            }

            var colorIndex = await _context.ProgramacionesOP.CountAsync();
            var programacion = new ProgramacionOP
            {
                Color = dto.Color ?? OpColors[colorIndex % OpColors.Length],
                EstadoGeneral = string.IsNullOrWhiteSpace(dto.EstadoGeneral) ? "programado" : dto.EstadoGeneral.Trim(),
                FechaCreacion = DateTime.Now,
                Procesos = dto.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList()
            };
            ApplyProgramacionHeaderFromDto(programacion, dto);
            if (string.IsNullOrWhiteSpace(programacion.Color))
                programacion.Color = OpColors[colorIndex % OpColors.Length];

            _context.ProgramacionesOP.Add(programacion);
            await _context.SaveChangesAsync();

            var saved = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .Include(p => p.OrdenProduccion)
                .FirstAsync(p => p.Id == programacion.Id);

            await SyncPlaneacionMaquinasAsync(saved);

            return CreatedAtAction(nameof(GetProgramacion), new { id = saved.Id }, MapToDetalleDto(saved, new()));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error al guardar programación: {ex.Message}");
        }
    }

    [HttpPost("programacion/urgencia")]
    public async Task<IActionResult> CrearUrgenciaConAjustes([FromBody] CrearUrgenciaProgramacionDto body)
    {
        var dto = body.Urgencia;
        if (dto == null || !dto.EsUrgencia)
            return BadRequest("Debe indicar una programación de urgencia.");
        if (dto.Procesos == null || dto.Procesos.Count == 0)
            return BadRequest("Debe asignar al menos un proceso a la urgencia.");
        if (string.IsNullOrWhiteSpace(dto.NumeroOT))
            dto.NumeroOT = "SIN-OT";
        if (string.IsNullOrWhiteSpace(dto.Cliente))
            dto.Cliente = "Urgencia";

        if (string.IsNullOrWhiteSpace(dto.NumeroOP))
            dto.NumeroOP = $"URG-{DateTime.Now:yyyyMMdd-HHmm}";

        foreach (var proc in dto.Procesos)
        {
            if (proc.FechaInicio >= proc.FechaFin)
                return BadRequest($"El proceso {proc.Proceso} tiene fechas/horas inválidas.");
        }

        foreach (var ajuste in body.Ajustes ?? new())
        {
            var existing = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .FirstOrDefaultAsync(p => p.Id == ajuste.Id);
            if (existing == null) return NotFound($"Programación {ajuste.Id} no encontrada.");
            foreach (var proc in ajuste.Procesos)
            {
                if (proc.FechaInicio >= proc.FechaFin)
                    return BadRequest($"El proceso {proc.Proceso} de OP {existing.NumeroOP} tiene fechas inválidas.");
            }
            _context.ProgramacionesOPProcesos.RemoveRange(existing.Procesos);
            existing.Procesos = ajuste.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList();
            existing.FechaModificacion = DateTime.Now;
        }

        var colorIndex = await _context.ProgramacionesOP.CountAsync();
        var programacion = new ProgramacionOP
        {
            NumeroOP = dto.NumeroOP.Trim(),
            OrdenProduccionId = dto.OrdenProduccionId,
            NumeroOT = dto.NumeroOT?.Trim(),
            LineaTroquel = dto.LineaTroquel?.Trim(),
            Referencia = dto.Referencia?.Trim(),
            Cliente = dto.Cliente?.Trim() ?? string.Empty,
            MetaTiros = dto.MetaTiros,
            Precio = dto.Precio,
            Color = dto.Color ?? "#EF4444",
            EstadoGeneral = "programado",
            EsUrgencia = true,
            Observaciones = dto.Observaciones?.Trim(),
            FechaCreacion = DateTime.Now,
            Procesos = dto.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList()
        };
        _context.ProgramacionesOP.Add(programacion);
        await _context.SaveChangesAsync();

        var saved = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .FirstAsync(p => p.Id == programacion.Id);

        return CreatedAtAction(nameof(GetProgramacion), new { id = saved.Id }, MapToDetalleDto(saved, new()));
    }

    private static readonly HashSet<string> TiposAuxiliares = new(StringComparer.OrdinalIgnoreCase)
    {
        "capacitacion", "limpieza"
    };

    [HttpPost("programacion/auxiliar")]
    public async Task<IActionResult> CrearActividadAuxiliar([FromBody] CrearAuxiliarProgramacionDto body)
    {
        var dto = body.Actividad;
        if (dto == null || string.IsNullOrWhiteSpace(dto.TipoActividad) || !TiposAuxiliares.Contains(dto.TipoActividad.Trim()))
            return BadRequest("Tipo de actividad auxiliar inválido (capacitacion | limpieza).");
        if (dto.Procesos == null || dto.Procesos.Count != 1)
            return BadRequest("La actividad auxiliar debe tener exactamente un proceso.");

        var tipo = dto.TipoActividad.Trim().ToLowerInvariant();
        var proc = dto.Procesos[0];
        if (proc.FechaInicio >= proc.FechaFin)
            return BadRequest("La actividad auxiliar tiene fechas/horas inválidas.");

        // Aplica los ajustes calculados por el cliente (reacomodo de OPs que se corren).
        foreach (var ajuste in body.Ajustes ?? new())
        {
            var existing = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .FirstOrDefaultAsync(p => p.Id == ajuste.Id);
            if (existing == null) return NotFound($"Programación {ajuste.Id} no encontrada.");
            foreach (var pr in ajuste.Procesos)
            {
                if (pr.FechaInicio >= pr.FechaFin)
                    return BadRequest($"El proceso {pr.Proceso} de OP {existing.NumeroOP} tiene fechas inválidas.");
            }
            _context.ProgramacionesOPProcesos.RemoveRange(existing.Procesos);
            existing.Procesos = ajuste.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList();
            existing.FechaModificacion = DateTime.Now;
        }

        var label = tipo == "capacitacion" ? "Capacitación" : "Limpieza";
        var programacion = new ProgramacionOP
        {
            NumeroOP = string.IsNullOrWhiteSpace(dto.NumeroOP) ? label.ToUpperInvariant() : dto.NumeroOP.Trim(),
            Cliente = string.IsNullOrWhiteSpace(dto.Cliente) ? label : dto.Cliente.Trim(),
            MetaTiros = 0,
            Color = dto.Color ?? (tipo == "capacitacion" ? "#8B5CF6" : "#0D9488"),
            EstadoGeneral = "programado",
            EsUrgencia = false,
            TipoActividad = tipo,
            Observaciones = dto.Observaciones?.Trim(),
            FechaCreacion = DateTime.Now,
            Procesos = dto.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList()
        };
        _context.ProgramacionesOP.Add(programacion);
        await _context.SaveChangesAsync();

        var saved = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .FirstAsync(p => p.Id == programacion.Id);

        return CreatedAtAction(nameof(GetProgramacion), new { id = saved.Id }, MapToDetalleDto(saved, new()));
    }

    [HttpPut("programacion/auxiliar/{id:int}")]
    public async Task<IActionResult> ActualizarActividadAuxiliar(int id, [FromBody] CrearAuxiliarProgramacionDto body)
    {
        var existing = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (existing == null) return NotFound();
        if (string.IsNullOrWhiteSpace(existing.TipoActividad) || existing.TipoActividad == "op")
            return BadRequest("La programación no es una actividad auxiliar.");

        var dto = body.Actividad;
        if (dto?.Procesos == null || dto.Procesos.Count != 1)
            return BadRequest("La actividad auxiliar debe tener exactamente un proceso.");
        var proc = dto.Procesos[0];
        if (proc.FechaInicio >= proc.FechaFin)
            return BadRequest("La actividad auxiliar tiene fechas/horas inválidas.");

        foreach (var ajuste in body.Ajustes ?? new())
        {
            var otra = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .FirstOrDefaultAsync(p => p.Id == ajuste.Id);
            if (otra == null) return NotFound($"Programación {ajuste.Id} no encontrada.");
            foreach (var pr in ajuste.Procesos)
            {
                if (pr.FechaInicio >= pr.FechaFin)
                    return BadRequest($"El proceso {pr.Proceso} de OP {otra.NumeroOP} tiene fechas inválidas.");
            }
            _context.ProgramacionesOPProcesos.RemoveRange(otra.Procesos);
            otra.Procesos = ajuste.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList();
            otra.FechaModificacion = DateTime.Now;
        }

        _context.ProgramacionesOPProcesos.RemoveRange(existing.Procesos);
        existing.Procesos = dto.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList();
        if (!string.IsNullOrWhiteSpace(dto.Observaciones)) existing.Observaciones = dto.Observaciones.Trim();
        existing.FechaModificacion = DateTime.Now;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("programacion/{id:int}")]
    public async Task<IActionResult> ActualizarProgramacion(int id, [FromBody] CrearProgramacionOPDto dto)
    {
        var existing = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (existing == null) return NotFound();

        foreach (var proc in dto.Procesos)
        {
            if (proc.FechaInicio >= proc.FechaFin)
                return BadRequest($"El proceso {proc.Proceso} tiene fechas/horas inválidas.");
        }

        var cruces = await ValidarCrucesHorario(dto.Procesos, excludeProgramacionId: id);
        if (cruces != null) return BadRequest(cruces);

        existing.NumeroOP = dto.NumeroOP.Trim();
        existing.OrdenProduccionId = dto.OrdenProduccionId;
        existing.NumeroOT = dto.NumeroOT?.Trim();
        existing.OrdenCompra = dto.OrdenCompra?.Trim();
        existing.FechaEntrega = dto.FechaEntrega?.Trim();
        existing.CalculoJson = dto.CalculoJson;
        existing.LineaTroquel = dto.LineaTroquel?.Trim();
        existing.Referencia = dto.Referencia?.Trim();
        existing.Cliente = dto.Cliente?.Trim() ?? string.Empty;
        existing.MetaTiros = dto.MetaTiros;
        existing.Precio = dto.Precio;
        if (!string.IsNullOrWhiteSpace(dto.Color)) existing.Color = dto.Color;
        if (!string.IsNullOrWhiteSpace(dto.EstadoGeneral)) existing.EstadoGeneral = dto.EstadoGeneral.Trim();
        existing.EsUrgencia = dto.EsUrgencia;
        if (!string.IsNullOrWhiteSpace(dto.TipoActividad)) existing.TipoActividad = dto.TipoActividad.Trim().ToLowerInvariant();
        existing.Observaciones = dto.Observaciones?.Trim();
        existing.FechaModificacion = DateTime.Now;

        _context.ProgramacionesOPProcesos.RemoveRange(existing.Procesos);
        existing.Procesos = dto.Procesos.Select((p, idx) => MapProcesoInput(p, idx)).ToList();

        await _context.SaveChangesAsync();

        var reloaded = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .Include(p => p.OrdenProduccion)
            .FirstAsync(p => p.Id == id);
        await SyncPlaneacionMaquinasAsync(reloaded);

        return NoContent();
    }

    private static void ApplyProgramacionHeaderFromDto(ProgramacionOP entity, CrearProgramacionOPDto dto)
    {
        entity.NumeroOP = dto.NumeroOP.Trim();
        entity.OrdenProduccionId = dto.OrdenProduccionId;
        entity.NumeroOT = dto.NumeroOT?.Trim();
        entity.OrdenCompra = dto.OrdenCompra?.Trim();
        entity.FechaEntrega = dto.FechaEntrega?.Trim();
        entity.CalculoJson = dto.CalculoJson;
        entity.LineaTroquel = dto.LineaTroquel?.Trim();
        entity.Referencia = dto.Referencia?.Trim();
        entity.Cliente = dto.Cliente?.Trim() ?? string.Empty;
        entity.MetaTiros = dto.MetaTiros;
        entity.Precio = dto.Precio;
        if (!string.IsNullOrWhiteSpace(dto.Color)) entity.Color = dto.Color;
        if (!string.IsNullOrWhiteSpace(dto.EstadoGeneral)) entity.EstadoGeneral = dto.EstadoGeneral.Trim();
        entity.EsUrgencia = dto.EsUrgencia;
        if (!string.IsNullOrWhiteSpace(dto.TipoActividad)) entity.TipoActividad = dto.TipoActividad.Trim().ToLowerInvariant();
        entity.Observaciones = dto.Observaciones?.Trim();
    }

    private static ProgramacionOPProceso MapProcesoInput(ProgramacionProcesoInputDto p, int orden = 0)
    {
        return new ProgramacionOPProceso
        {
            Proceso = p.Proceso,
            MaquinaId = p.MaquinaId,
            FechaInicio = p.FechaInicio,
            FechaFin = p.FechaFin,
            HorasEstimadas = p.HorasEstimadas,
            OrdenSecuencia = orden,
            TiemposAuxiliaresJson = p.TiemposAuxiliares?.Count > 0
                ? JsonSerializer.Serialize(p.TiemposAuxiliares)
                : null
        };
    }

    private async Task<string?> ValidarCrucesHorario(List<ProgramacionProcesoInputDto> procesos, int? excludeProgramacionId)
    {
        // 1) Choque físico: misma máquina en horario solapado
        foreach (var proc in procesos.Where(p => p.MaquinaId.HasValue && p.MaquinaId.Value > 0))
        {
            var conflicto = await _context.ProgramacionesOPProcesos
                .Include(x => x.ProgramacionOP)
                .Where(x => x.MaquinaId == proc.MaquinaId
                    && (!excludeProgramacionId.HasValue || x.ProgramacionOPId != excludeProgramacionId)
                    && x.FechaInicio < proc.FechaFin
                    && x.FechaFin > proc.FechaInicio)
                .Select(x => new { x.ProgramacionOP!.NumeroOP, x.Proceso })
                .FirstOrDefaultAsync();

            if (conflicto != null)
                return $"La máquina ya está ocupada por la OP {conflicto.NumeroOP} ({conflicto.Proceso}) en ese horario. Elija otra hora o máquina.";
        }

        // 2) Procesos sin máquina: no solapar en la misma fila del Gantt
        foreach (var proc in procesos.Where(p => !p.MaquinaId.HasValue || p.MaquinaId.Value <= 0))
        {
            var conflicto = await _context.ProgramacionesOPProcesos
                .Include(x => x.ProgramacionOP)
                .Where(x => x.Proceso == proc.Proceso
                    && (x.MaquinaId == null || x.MaquinaId <= 0)
                    && (!excludeProgramacionId.HasValue || x.ProgramacionOPId != excludeProgramacionId)
                    && x.FechaInicio < proc.FechaFin
                    && x.FechaFin > proc.FechaInicio)
                .Select(x => x.ProgramacionOP!.NumeroOP)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrEmpty(conflicto))
                return $"El proceso \"{proc.Proceso}\" (sin máquina) se cruza en horario con la OP {conflicto}.";
        }

        // 3) Dentro de la misma programación: no duplicar máquina en solape
        for (var i = 0; i < procesos.Count; i++)
        {
            var a = procesos[i];
            if (!a.MaquinaId.HasValue || a.MaquinaId.Value <= 0) continue;
            for (var j = i + 1; j < procesos.Count; j++)
            {
                var b = procesos[j];
                if (b.MaquinaId != a.MaquinaId) continue;
                if (a.FechaInicio < b.FechaFin && a.FechaFin > b.FechaInicio)
                    return $"Los procesos \"{a.Proceso}\" y \"{b.Proceso}\" usan la misma máquina en horarios que se solapan.";
            }
        }

        return null;
    }

    private async Task<string?> ValidarDocumentosPlaneacion(CrearProgramacionOPDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.NumeroOT) && !string.IsNullOrWhiteSpace(dto.LineaTroquel))
            return null;

        var digits = SoloDigitos(dto.NumeroOP);
        if (string.IsNullOrEmpty(digits))
            return "Número de OP inválido.";

        var adjuntos = await _extraccion.ObtenerOExtraerAsync(digits, forzar: false);
        if (adjuntos.Op == null)
            return "La OP debe tener documento OP cargado en Planeación antes de programar.";
        return null;
    }

    private async Task<List<string>> GetNombresProcesosActivosAsync()
    {
        var list = await _context.ProcesosGantt
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Orden)
            .Select(p => p.Nombre)
            .ToListAsync();
        return list.Count > 0 ? list : ProcesosDisponibles.ToList();
    }

    private static List<OpPiezaDto> ParsePiezasFromCampos(Dictionary<string, string>? campos)
    {
        if (campos == null) return new();
        var json = GetCampo(campos, "piezasJson");
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<OpPiezaDto>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            }) ?? new();
        }
        catch
        {
            return new();
        }
    }

    private static List<string> SugerirProcesosDesdeOp(
        Dictionary<string, string>? campos,
        IReadOnlyList<string> disponibles,
        List<OpPiezaDto>? piezas = null)
    {
        var sugeridos = new List<string>();
        if (piezas != null && piezas.Count > 0)
        {
            foreach (var pieza in piezas)
            {
                foreach (var proc in pieza.Procesos)
                {
                    AgregarProcesoSugerido(sugeridos, proc.Proceso, disponibles);
                }
            }
            if (sugeridos.Count > 0) return sugeridos;
        }

        if (campos == null) return sugeridos;
        var detalle = GetCampo(campos, "procesosDetalle");
        if (string.IsNullOrWhiteSpace(detalle)) return sugeridos;

        foreach (var linea in detalle.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var nombre = linea.Split('|')[0].Trim();
            AgregarProcesoSugerido(sugeridos, nombre, disponibles);
        }
        return sugeridos;
    }

    private static void AgregarProcesoSugerido(List<string> sugeridos, string nombreProceso, IReadOnlyList<string> disponibles)
    {
        var match = disponibles.FirstOrDefault(p =>
            NormalizeProceso(p) == NormalizeProceso(nombreProceso)
            || NormalizeProceso(nombreProceso).Contains(NormalizeProceso(p))
            || ProcesoOpCoincideGantt(nombreProceso, p));
        if (match != null && !sugeridos.Contains(match))
            sugeridos.Add(match);
    }

    private static bool ProcesoOpCoincideGantt(string nombreOp, string procesoGantt)
    {
        var n = NormalizeProceso(nombreOp);
        var g = NormalizeProceso(procesoGantt);
        if (g == "conversion" && (n.Contains("convertid") || n.StartsWith("01"))) return true;
        if (g == "corte" && (n.Contains("guillot") || n.StartsWith("02"))) return true;
        if (g == "impresion" && (n.Contains("speed") || n.Contains("sord") || n.StartsWith("0") && n.Contains("impres"))) return true;
        if (g == "colaminado" && n.Contains("colamin")) return true;
        if (g == "troquelado" && (n.Contains("troquel") || n.Contains("estamp"))) return true;
        if (g == "corrugacion" && n.Contains("corrug")) return true;
        if (g == "acabado" && (n.Contains("barniz") || n.Contains("lamin"))) return true;
        if (g == "pegadora" && n.Contains("pegad")) return true;
        if (g == "despique" && n.Contains("despique")) return true;
        if ((g == "terminado manual" || g == "terminado") && (n.Contains("manual") || n.Contains("terminad") || n.StartsWith("16"))) return true;
        return false;
    }

    private static string GetCampo(Dictionary<string, string>? campos, string key)
    {
        if (campos == null) return "";
        foreach (var kv in campos)
            if (string.Equals(kv.Key, key, StringComparison.OrdinalIgnoreCase))
                return kv.Value?.Trim() ?? "";
        return "";
    }

    private static int ParseCantidadOp(string val)
    {
        if (string.IsNullOrWhiteSpace(val)) return 0;
        var t = val.Trim();
        if (Regex.IsMatch(t, @"^\d{1,4}(\.\d{3})+$"))
            t = t.Replace(".", "");
        t = t.Replace(",", ".");
        return int.TryParse(t.Split('.')[0], out var n) ? n : 0;
    }

    private static string SoloDigitos(string? s) =>
        string.IsNullOrWhiteSpace(s) ? "" : Regex.Replace(s.Trim(), @"\D", "");

    private static List<TiempoAuxiliarDto> DeserializeAuxiliares(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<TiempoAuxiliarDto>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }

    [HttpDelete("programacion/{id:int}")]
    public async Task<IActionResult> EliminarProgramacion(int id)
    {
        var programacion = await _context.ProgramacionesOP
            .Include(p => p.Procesos)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (programacion == null) return NotFound();

        await RemovePlaneacionMaquinasForProgramacionAsync(programacion);

        _context.ProgramacionesOP.Remove(programacion);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static ProgramacionOPDetalleDto MapToDetalleDto(ProgramacionOP p, List<EncuestaCalidadProduccion> encuestas, Dictionary<int, string>? maquinas = null)
    {
        var now = DateTime.Now;
        var procesosDto = p.Procesos.OrderBy(pr => pr.FechaInicio).Select(pr =>
        {
            var producido = encuestas
                .SelectMany(e => e.Procesos)
                .Where(ep => NormalizeProceso(ep.Proceso) == NormalizeProceso(pr.Proceso))
                .Sum(ep => ep.CantidadProducida);

            var totalMs = (pr.FechaFin - pr.FechaInicio).TotalMilliseconds;
            var elapsedMs = Math.Max(0, Math.Min((now - pr.FechaInicio).TotalMilliseconds, totalMs));
            var pctTiempo = totalMs > 0 ? (int)Math.Round(elapsedMs / totalMs * 100) : 0;

            string estado;
            if (producido > 0 && now >= pr.FechaFin) estado = "completado";
            else if (producido > 0 || (now >= pr.FechaInicio && now <= pr.FechaFin)) estado = "en_proceso";
            else if (now > pr.FechaFin) estado = "atrasado";
            else estado = "pendiente";

            return new ProgramacionProcesoProgresoDto
            {
                Id = pr.Id,
                Proceso = pr.Proceso,
                MaquinaId = pr.MaquinaId,
                MaquinaNombre = pr.MaquinaId.HasValue && maquinas != null && maquinas.TryGetValue(pr.MaquinaId.Value, out var nm) ? nm : null,
                FechaInicio = pr.FechaInicio,
                FechaFin = pr.FechaFin,
                HorasEstimadas = pr.HorasEstimadas,
                TiemposAuxiliares = DeserializeAuxiliares(pr.TiemposAuxiliaresJson),
                Estado = estado,
                CantidadProducida = producido,
                PorcentajeTiempo = pctTiempo
            };
        }).ToList();

        var progresoGeneral = procesosDto.Count == 0 ? 0 :
            (int)Math.Round(procesosDto.Count(pr => pr.Estado == "completado") / (double)procesosDto.Count * 100);

        return new ProgramacionOPDetalleDto
        {
            Id = p.Id,
            NumeroOP = p.NumeroOP,
            OrdenProduccionId = p.OrdenProduccionId,
            NumeroOT = p.NumeroOT,
            OrdenCompra = p.OrdenCompra,
            FechaEntrega = p.FechaEntrega,
            CalculoJson = p.CalculoJson,
            LineaTroquel = p.LineaTroquel,
            Referencia = p.Referencia,
            Cliente = p.Cliente,
            MetaTiros = p.MetaTiros,
            Precio = p.Precio,
            Color = p.Color,
            EstadoGeneral = p.EstadoGeneral,
            EsUrgencia = p.EsUrgencia,
            TipoActividad = string.IsNullOrWhiteSpace(p.TipoActividad) ? "op" : p.TipoActividad,
            Observaciones = p.Observaciones,
            FechaCreacion = p.FechaCreacion,
            FechaModificacion = p.FechaModificacion,
            Procesos = procesosDto,
            ProgresoGeneral = progresoGeneral
        };
    }

    private static string NormalizeProceso(string proceso)
    {
        return proceso.Trim().ToLowerInvariant()
            .Replace("ó", "o").Replace("í", "i").Replace("é", "e").Replace("á", "a").Replace("ú", "u");
    }

    private static bool HorarioContieneMomento(Horario h, DateTime moment)
    {
        var tod = moment.TimeOfDay;
        if (moment.DayOfWeek == DayOfWeek.Saturday)
            return tod >= h.InicioSabado && tod < h.FinSabado;
        if (moment.DayOfWeek == DayOfWeek.Sunday) return false;
        return tod >= h.InicioSemana && tod < h.FinSemana;
    }

    private static (DateTime inicio, DateTime fin) GetHorarioWindow(Horario h, DateTime day)
    {
        if (day.DayOfWeek == DayOfWeek.Sunday)
            return (day.Date, day.Date);

        TimeSpan ini;
        TimeSpan fin;
        if (day.DayOfWeek == DayOfWeek.Saturday)
        {
            ini = h.InicioSabado;
            fin = h.FinSabado;
        }
        else
        {
            ini = h.InicioSemana;
            fin = h.FinSemana;
        }

        return (day.Date + ini, day.Date + fin);
    }

    private static bool EsProgramacionOp(ProgramacionOP? prog)
        => prog != null
            && (prog.TipoActividad == null
                || prog.TipoActividad == ""
                || prog.TipoActividad == "op");

    private async Task<int?> ResolveOrdenProduccionIdAsync(ProgramacionOP prog)
    {
        if (prog.OrdenProduccionId.HasValue && prog.OrdenProduccionId.Value > 0)
            return prog.OrdenProduccionId;
        var digits = SoloDigitos(prog.NumeroOP);
        if (string.IsNullOrEmpty(digits)) return null;
        var orden = await _context.OrdenesProduccion.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Numero == digits || o.Numero == prog.NumeroOP.Trim());
        return orden?.Id;
    }

    private async Task RemovePlaneacionMaquinasForProgramacionAsync(ProgramacionOP prog)
    {
        var ordenId = await ResolveOrdenProduccionIdAsync(prog);
        var maquinaIds = prog.Procesos
            .Where(p => p.MaquinaId.HasValue && p.MaquinaId.Value > 0)
            .Select(p => p.MaquinaId!.Value)
            .Distinct()
            .ToList();
        if (maquinaIds.Count == 0) return;

        var query = _context.PlaneacionesMaquinas.Where(p => maquinaIds.Contains(p.MaquinaId));
        if (ordenId.HasValue)
            query = query.Where(p => p.OrdenProduccionId == ordenId.Value);
        else
        {
            var ranges = prog.Procesos
                .Where(p => p.MaquinaId.HasValue)
                .Select(p => new { p.MaquinaId, p.FechaInicio, p.FechaFin })
                .ToList();
            var ids = new List<int>();
            var candidatos = await query.ToListAsync();
            foreach (var c in candidatos)
            {
                if (ranges.Any(r => r.MaquinaId == c.MaquinaId
                    && c.FechaInicio < r.FechaFin && c.FechaFin > r.FechaInicio))
                    ids.Add(c.Id);
            }
            if (ids.Count == 0) return;
            var toDrop = candidatos.Where(c => ids.Contains(c.Id)).ToList();
            _context.PlaneacionesMaquinas.RemoveRange(toDrop);
            return;
        }

        _context.PlaneacionesMaquinas.RemoveRange(await query.ToListAsync());
    }

    private async Task SyncPlaneacionMaquinasAsync(ProgramacionOP prog)
    {
        if (!string.Equals(prog.TipoActividad, "op", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(prog.TipoActividad))
            return;

        await RemovePlaneacionMaquinasForProgramacionAsync(prog);

        var ordenId = await ResolveOrdenProduccionIdAsync(prog);
        if (!ordenId.HasValue) return;

        foreach (var proc in prog.Procesos.Where(p => p.MaquinaId.HasValue && p.MaquinaId.Value > 0))
        {
            _context.PlaneacionesMaquinas.Add(new PlaneacionMaquina
            {
                MaquinaId = proc.MaquinaId!.Value,
                OrdenProduccionId = ordenId.Value,
                FechaInicio = proc.FechaInicio,
                FechaFin = proc.FechaFin,
                MetaTiros = prog.MetaTiros,
                Referencia = prog.Referencia ?? prog.Cliente
            });
        }
        await _context.SaveChangesAsync();
    }

    private async Task<(object? result, object? sinCoincidencia)> BuildActualOperarioDto(
        int maquinaId,
        int? horarioId = null,
        int? usuarioId = null)
    {
        var now = DateTime.Now;
        var today = now.Date;
        var maquinas = await _context.Maquinas.AsNoTracking().ToDictionaryAsync(m => m.Id, m => m.Nombre);
        var filtroOperario = horarioId.HasValue && horarioId.Value > 0 && usuarioId.HasValue && usuarioId.Value > 0;

        ProgramacionOPProceso? procesoActivo = null;
        RosterAsignacion? rosterMatch = null;

        if (filtroOperario)
        {
            rosterMatch = await _context.RosterAsignaciones
                .Include(a => a.Usuario)
                .Include(a => a.Horario)
                .FirstOrDefaultAsync(a => a.FechaDia == today
                    && a.MaquinaId == maquinaId
                    && a.HorarioId == horarioId!.Value
                    && a.UsuarioId == usuarioId!.Value
                    && !a.EsAuxiliar);

            if (rosterMatch == null)
            {
                return (null, new
                {
                    coincidencia = false,
                    mensaje = "No está asignado a esta máquina y turno en el roster de hoy.",
                });
            }

            var horario = rosterMatch.Horario;
            if (horario == null)
            {
                return (null, new
                {
                    coincidencia = false,
                    mensaje = "Turno no encontrado.",
                });
            }

            var (winInicio, winFin) = GetHorarioWindow(horario, today);
            if (winFin <= winInicio)
            {
                return (null, new
                {
                    coincidencia = false,
                    mensaje = "Este turno no aplica hoy (domingo o sin ventana horaria).",
                });
            }

            var candidatos = await _context.ProgramacionesOPProcesos
                .Include(x => x.ProgramacionOP!)
                    .ThenInclude(p => p!.OrdenProduccion)
                .Where(x => x.MaquinaId == maquinaId
                    && x.FechaInicio < winFin
                    && x.FechaFin > winInicio
                    && x.ProgramacionOP != null)
                .OrderBy(x => x.FechaInicio)
                .ToListAsync();

            procesoActivo = candidatos
                .FirstOrDefault(x => EsProgramacionOp(x.ProgramacionOP));

            if (procesoActivo == null)
            {
                return (null, new
                {
                    coincidencia = false,
                    mensaje = "No hay OP programada para este turno en esta máquina.",
                });
            }
        }
        else
        {
            procesoActivo = await _context.ProgramacionesOPProcesos
                .Include(x => x.ProgramacionOP!)
                    .ThenInclude(p => p!.OrdenProduccion)
                .Where(x => x.MaquinaId == maquinaId
                    && x.FechaInicio <= now && x.FechaFin >= now
                    && x.ProgramacionOP != null
                    && EsProgramacionOp(x.ProgramacionOP))
                .OrderBy(x => x.FechaInicio)
                .FirstOrDefaultAsync();

            if (procesoActivo == null)
            {
                procesoActivo = await _context.ProgramacionesOPProcesos
                    .Include(x => x.ProgramacionOP!)
                        .ThenInclude(p => p!.OrdenProduccion)
                    .Where(x => x.MaquinaId == maquinaId
                        && x.FechaInicio >= now
                        && x.FechaInicio.Date <= today.AddDays(7)
                        && x.ProgramacionOP != null
                        && EsProgramacionOp(x.ProgramacionOP))
                    .OrderBy(x => x.FechaInicio)
                    .FirstOrDefaultAsync();
            }
        }

        if (procesoActivo?.ProgramacionOP != null)
        {
            var prog = procesoActivo.ProgramacionOP;

            // Sincronizar tabla legacy si aún no existe (OPs guardadas antes de este enlace)
            var yaSync = await _context.PlaneacionesMaquinas.AsNoTracking()
                .AnyAsync(p => p.MaquinaId == maquinaId
                    && p.FechaInicio <= procesoActivo.FechaFin
                    && p.FechaFin >= procesoActivo.FechaInicio);
            if (!yaSync)
            {
                var full = await _context.ProgramacionesOP
                    .Include(p => p.Procesos)
                    .Include(p => p.OrdenProduccion)
                    .FirstAsync(p => p.Id == prog.Id);
                await SyncPlaneacionMaquinasAsync(full);
            }

            var encuestas = await _context.EncuestasCalidadProduccion
                .Include(e => e.Procesos)
                .Where(e => e.OrdenProduccion == prog.NumeroOP)
                .ToListAsync();
            var detalle = MapToDetalleDto(prog, encuestas, maquinas);

            if (!filtroOperario)
            {
                var asignaciones = await _context.RosterAsignaciones
                    .Include(a => a.Usuario)
                    .Include(a => a.Horario)
                    .Where(a => a.FechaDia == today && a.MaquinaId == maquinaId && !a.EsAuxiliar)
                    .ToListAsync();

                foreach (var a in asignaciones)
                {
                    if (a.Horario != null && HorarioContieneMomento(a.Horario, now))
                    {
                        rosterMatch = a;
                        break;
                    }
                }
                rosterMatch ??= asignaciones.FirstOrDefault();
            }

            var procesoDto = detalle.Procesos.FirstOrDefault(p => p.Id == procesoActivo.Id)
                ?? detalle.Procesos.FirstOrDefault(p => p.MaquinaId == maquinaId);

            return (new
            {
                coincidencia = true,
                fuente = "programacion",
                id = prog.Id,
                maquinaId,
                numeroOP = prog.NumeroOP,
                ordenProduccionId = prog.OrdenProduccionId,
                ordenProduccion = prog.OrdenProduccion != null
                    ? new { id = (int?)prog.OrdenProduccion.Id, numero = prog.OrdenProduccion.Numero, descripcion = prog.OrdenProduccion.Descripcion ?? "" }
                    : new { id = prog.OrdenProduccionId, numero = prog.NumeroOP, descripcion = prog.Referencia ?? "" },
                numeroOT = prog.NumeroOT,
                lineaTroquel = prog.LineaTroquel,
                referencia = prog.Referencia,
                cliente = prog.Cliente,
                metaTiros = prog.MetaTiros,
                precio = prog.Precio,
                calculoJson = prog.CalculoJson,
                fechaEntrega = prog.FechaEntrega,
                fechaInicio = procesoActivo.FechaInicio,
                fechaFin = procesoActivo.FechaFin,
                procesoActual = procesoDto,
                procesos = detalle.Procesos,
                progresoGeneral = detalle.ProgresoGeneral,
                tieneOp = !string.IsNullOrWhiteSpace(prog.NumeroOP),
                tieneOt = !string.IsNullOrWhiteSpace(prog.NumeroOT),
                tieneLineaTroquel = !string.IsNullOrWhiteSpace(prog.LineaTroquel),
                tieneFicha = !string.IsNullOrWhiteSpace(prog.Referencia),
                rosterHorarioId = rosterMatch?.HorarioId,
                rosterHorarioNombre = rosterMatch?.Horario?.Nombre,
                rosterOperarioId = rosterMatch?.UsuarioId,
                rosterOperarioNombre = rosterMatch?.Usuario?.Nombre,
            }, null);
        }

        if (filtroOperario)
        {
            return (null, new
            {
                coincidencia = false,
                mensaje = "No hay OP programada para este turno en esta máquina.",
            });
        }

        var plan = await _context.PlaneacionesMaquinas
            .Include(p => p.OrdenProduccion)
            .FirstOrDefaultAsync(p => p.MaquinaId == maquinaId && p.FechaInicio <= now && p.FechaFin >= now);
        if (plan == null) return (null, null);

        return (new
        {
            coincidencia = true,
            fuente = "planeacion_legacy",
            id = plan.Id,
            maquinaId = plan.MaquinaId,
            metaTiros = plan.MetaTiros,
            referencia = plan.Referencia,
            fechaInicio = plan.FechaInicio,
            fechaFin = plan.FechaFin,
            ordenProduccionId = plan.OrdenProduccionId,
            ordenProduccion = plan.OrdenProduccion != null
                ? new { id = plan.OrdenProduccion.Id, numero = plan.OrdenProduccion.Numero, descripcion = plan.OrdenProduccion.Descripcion }
                : null,
            numeroOP = plan.OrdenProduccion?.Numero,
            procesos = Array.Empty<object>(),
        }, null);
    }
}
