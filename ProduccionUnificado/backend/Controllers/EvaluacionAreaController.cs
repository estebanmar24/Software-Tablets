using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Evaluación por Área: checklist mensual donde cada área registra sus actividades
/// y las marca como cumplidas/no cumplidas (con motivo). El admin obtiene el
/// consolidado y un "reporte" (HTML imprimible / JSON) con % de cumplimiento.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class EvaluacionAreaController : ControllerBase
{
    private readonly AppDbContext _context;

    public EvaluacionAreaController(AppDbContext context)
    {
        _context = context;
    }

    public class ActividadWriteDTO
    {
        public string Area { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int? Anio { get; set; }
        public int? Mes { get; set; }
        public int? CreadoPorId { get; set; }
        public string? CreadoPorNombre { get; set; }
    }

    public class EstadoUpdateDTO
    {
        /// <summary>'cumplida' | 'no_cumplida' | 'pendiente'</summary>
        public string Estado { get; set; } = "pendiente";
        public string? RazonNoCumplimiento { get; set; }
    }

    public class ResumenAreaDTO
    {
        public string Area { get; set; } = string.Empty;
        public int Total { get; set; }
        public int Cumplidas { get; set; }
        public int NoCumplidas { get; set; }
        public int Pendientes { get; set; }
        public double PorcentajeCumplimiento { get; set; }
        public List<EvaluacionArea_Actividad> NoCumplidasDetalle { get; set; } = new();
    }

    /// <summary>Lista de áreas válidas (debe estar alineada con UserManagementScreen).</summary>
    private static readonly string[] AreasConocidas = new[]
    {
        "Gerencia", "SST", "Planeacion", "Gestion Humana", "Talleres y Despachos",
        "Calidad", "Produccion", "Almacen", "Diseño", "Contabilidad", "Redes", "Maquinas"
    };

    [HttpGet("areas")]
    public ActionResult<IEnumerable<string>> GetAreas() => Ok(AreasConocidas);

    /// <summary>GET api/EvaluacionArea/actividades?area=SST&amp;anio=2026&amp;mes=5</summary>
    [HttpGet("actividades")]
    public async Task<ActionResult<IEnumerable<EvaluacionArea_Actividad>>> GetActividades(
        [FromQuery] string? area, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.EvaluacionArea_Actividades.AsQueryable();
        if (!string.IsNullOrWhiteSpace(area))
            query = query.Where(a => a.Area == area);
        if (anio.HasValue)
            query = query.Where(a => a.Anio == anio.Value);
        if (mes.HasValue)
            query = query.Where(a => a.Mes == mes.Value);

        var data = await query
            .OrderBy(a => a.Area)
            .ThenByDescending(a => a.FechaCreacion)
            .ToListAsync();
        return Ok(data);
    }

    [HttpGet("actividades/{id}")]
    public async Task<ActionResult<EvaluacionArea_Actividad>> GetActividad(int id)
    {
        var item = await _context.EvaluacionArea_Actividades.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost("actividades")]
    public async Task<ActionResult<EvaluacionArea_Actividad>> CrearActividad([FromBody] ActividadWriteDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Area))
            return BadRequest(new { error = "Area requerida" });
        if (string.IsNullOrWhiteSpace(dto.Titulo))
            return BadRequest(new { error = "Titulo requerido" });

        var hoy = DateTime.UtcNow;
        var anio = dto.Anio ?? hoy.Year;
        var titulo = dto.Titulo.Trim();
        var area = dto.Area.Trim();
        var descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();

        // Replicamos la actividad para los 12 meses del año seleccionado:
        // el operario quiere que las mismas actividades aparezcan en todos
        // los meses (cumplimiento mensual). Borrar/editar/cambiar estado
        // siguen siendo operaciones por mes, así que cada mes es independiente
        // después de la creación.
        var nuevas = new List<EvaluacionArea_Actividad>();
        for (int m = 1; m <= 12; m++)
        {
            nuevas.Add(new EvaluacionArea_Actividad
            {
                Area = area,
                Titulo = titulo,
                Descripcion = descripcion,
                Estado = "pendiente",
                Anio = anio,
                Mes = m,
                CreadoPorId = dto.CreadoPorId,
                CreadoPorNombre = dto.CreadoPorNombre,
                FechaCreacion = hoy
            });
        }

        _context.EvaluacionArea_Actividades.AddRange(nuevas);
        await _context.SaveChangesAsync();

        // Devolvemos la instancia correspondiente al mes solicitado (o al actual
        // si no se pasó mes) para que el frontend pueda referenciarla.
        var mesSolicitado = dto.Mes ?? hoy.Month;
        var actividad = nuevas.FirstOrDefault(a => a.Mes == mesSolicitado) ?? nuevas[0];
        return CreatedAtAction(nameof(GetActividad), new { id = actividad.Id }, actividad);
    }

    [HttpPut("actividades/{id}")]
    public async Task<IActionResult> EditarActividad(int id, [FromBody] ActividadWriteDTO dto)
    {
        var item = await _context.EvaluacionArea_Actividades.FindAsync(id);
        if (item == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.Area)) item.Area = dto.Area.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Titulo)) item.Titulo = dto.Titulo.Trim();
        item.Descripcion = string.IsNullOrWhiteSpace(dto.Descripcion) ? null : dto.Descripcion.Trim();
        if (dto.Anio.HasValue) item.Anio = dto.Anio.Value;
        if (dto.Mes.HasValue) item.Mes = dto.Mes.Value;
        item.FechaModificacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("actividades/{id}/estado")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] EstadoUpdateDTO dto)
    {
        var item = await _context.EvaluacionArea_Actividades.FindAsync(id);
        if (item == null) return NotFound();

        var estado = (dto.Estado ?? "pendiente").Trim().ToLowerInvariant();
        if (estado != "cumplida" && estado != "no_cumplida" && estado != "pendiente")
            return BadRequest(new { error = "Estado inválido. Debe ser 'cumplida', 'no_cumplida' o 'pendiente'." });

        if (estado == "no_cumplida" && string.IsNullOrWhiteSpace(dto.RazonNoCumplimiento))
            return BadRequest(new { error = "Debe indicar la razón por la que no se cumplió la actividad." });

        item.Estado = estado;
        item.RazonNoCumplimiento = estado == "no_cumplida" ? dto.RazonNoCumplimiento?.Trim() : null;
        item.FechaCumplimiento = estado == "cumplida" ? DateTime.UtcNow : null;
        item.FechaModificacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpDelete("actividades/{id}")]
    public async Task<IActionResult> EliminarActividad(int id)
    {
        var item = await _context.EvaluacionArea_Actividades.FindAsync(id);
        if (item == null) return NotFound();
        _context.EvaluacionArea_Actividades.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Resumen consolidado por área en el período (mes/año).</summary>
    [HttpGet("resumen")]
    public async Task<ActionResult<IEnumerable<ResumenAreaDTO>>> GetResumen(
        [FromQuery] int? anio, [FromQuery] int? mes, [FromQuery] string? area)
    {
        var resumen = await BuildResumenAsync(anio, mes, area);
        return Ok(resumen);
    }

    private async Task<List<ResumenAreaDTO>> BuildResumenAsync(int? anio, int? mes, string? area)
    {
        var hoy = DateTime.UtcNow;
        var a = anio ?? hoy.Year;
        var m = mes ?? hoy.Month;

        var q = _context.EvaluacionArea_Actividades.Where(x => x.Anio == a && x.Mes == m);
        if (!string.IsNullOrWhiteSpace(area))
            q = q.Where(x => x.Area == area);

        var datos = await q.AsNoTracking().ToListAsync();

        return datos
            .GroupBy(x => x.Area)
            .Select(g =>
            {
                var total = g.Count();
                var cumplidas = g.Count(x => x.Estado == "cumplida");
                var noCumplidas = g.Count(x => x.Estado == "no_cumplida");
                var pendientes = g.Count(x => x.Estado == "pendiente");
                var pct = total == 0 ? 0.0 : Math.Round((cumplidas * 100.0) / total, 2);
                return new ResumenAreaDTO
                {
                    Area = g.Key,
                    Total = total,
                    Cumplidas = cumplidas,
                    NoCumplidas = noCumplidas,
                    Pendientes = pendientes,
                    PorcentajeCumplimiento = pct,
                    NoCumplidasDetalle = g.Where(x => x.Estado == "no_cumplida")
                        .OrderBy(x => x.Titulo)
                        .ToList()
                };
            })
            .OrderBy(r => r.Area)
            .ToList();
    }

    /// <summary>
    /// HTML imprimible (el frontend puede usar <c>window.print()</c> para guardarlo como PDF).
    /// </summary>
    [HttpGet("reporte-html")]
    public async Task<IActionResult> GetReporteHtml([FromQuery] int? anio, [FromQuery] int? mes)
    {
        var hoy = DateTime.UtcNow;
        var a = anio ?? hoy.Year;
        var m = mes ?? hoy.Month;

        var data = await BuildResumenAsync(a, m, null);

        string mesNombre = new System.Globalization.CultureInfo("es-CO")
            .DateTimeFormat.GetMonthName(m);
        mesNombre = char.ToUpper(mesNombre[0]) + mesNombre.Substring(1);

        var html = new System.Text.StringBuilder();
        html.Append("<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'/>");
        html.Append("<title>Evaluación por Área</title>");
        html.Append("<style>");
        html.Append("body{font-family:Arial,Helvetica,sans-serif;color:#1a202c;margin:24px;}");
        html.Append("h1{font-size:22px;margin:0 0 4px;}h2{font-size:16px;margin:18px 0 6px;color:#2b6cb0;}");
        html.Append(".sub{color:#4a5568;margin-bottom:18px;font-size:13px;}");
        html.Append("table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;}");
        html.Append("th,td{border:1px solid #cbd5e0;padding:6px 8px;text-align:left;vertical-align:top;}");
        html.Append("th{background:#edf2f7;}");
        html.Append(".pct{font-weight:bold;}");
        html.Append(".ok{color:#2f855a;}.bad{color:#c53030;}.pend{color:#b7791f;}");
        html.Append(".bar{background:#edf2f7;height:8px;border-radius:4px;overflow:hidden;margin-top:4px;}");
        html.Append(".bar > div{background:#3182ce;height:100%;}");
        html.Append("@media print{body{margin:10mm;}}");
        html.Append("</style></head><body>");
        html.Append($"<h1>Reporte de Evaluación por Área</h1>");
        html.Append($"<div class='sub'>Período: <strong>{mesNombre} {a}</strong> · Generado: {hoy:yyyy-MM-dd HH:mm} UTC</div>");

        if (!data.Any())
        {
            html.Append("<p><em>No hay actividades registradas en este período.</em></p>");
        }
        else
        {
            html.Append("<h2>Consolidado</h2>");
            html.Append("<table><thead><tr><th>Área</th><th>Cumplidas</th><th>Total</th><th>% Cumplimiento</th><th>Estado</th></tr></thead><tbody>");
            foreach (var r in data)
            {
                var cls = r.PorcentajeCumplimiento >= 80 ? "ok" : (r.PorcentajeCumplimiento >= 50 ? "pend" : "bad");
                html.Append("<tr>")
                    .Append($"<td>{System.Net.WebUtility.HtmlEncode(r.Area)}</td>")
                    .Append($"<td>{r.Cumplidas}</td>")
                    .Append($"<td>{r.Total}</td>")
                    .Append($"<td class='pct {cls}'>{r.PorcentajeCumplimiento:0.##}%<div class='bar'><div style='width:{r.PorcentajeCumplimiento}%'></div></div></td>")
                    .Append($"<td>{r.Cumplidas}/{r.Total} cumplidas, {r.NoCumplidas} no cumplidas, {r.Pendientes} pendientes</td>")
                    .Append("</tr>");
            }
            html.Append("</tbody></table>");

            html.Append("<h2>Detalle de actividades no cumplidas</h2>");
            var conNoCumplidas = data.Where(r => r.NoCumplidasDetalle.Any()).ToList();
            if (!conNoCumplidas.Any())
            {
                html.Append("<p><em>Todas las áreas con actividades cumplieron o tienen pendientes (sin incumplimientos).</em></p>");
            }
            else
            {
                foreach (var r in conNoCumplidas)
                {
                    html.Append($"<h2>{System.Net.WebUtility.HtmlEncode(r.Area)}</h2>");
                    html.Append("<table><thead><tr><th>Actividad</th><th>Razón de incumplimiento</th></tr></thead><tbody>");
                    foreach (var act in r.NoCumplidasDetalle)
                    {
                        html.Append("<tr>")
                            .Append($"<td><strong>{System.Net.WebUtility.HtmlEncode(act.Titulo)}</strong>")
                            .Append(string.IsNullOrWhiteSpace(act.Descripcion)
                                ? string.Empty
                                : $"<br/><span style='color:#4a5568'>{System.Net.WebUtility.HtmlEncode(act.Descripcion)}</span>")
                            .Append("</td>")
                            .Append($"<td>{System.Net.WebUtility.HtmlEncode(act.RazonNoCumplimiento ?? "(sin razón)")}</td>")
                            .Append("</tr>");
                    }
                    html.Append("</tbody></table>");
                }
            }
        }

        html.Append("</body></html>");
        return Content(html.ToString(), "text/html; charset=utf-8");
    }
}
