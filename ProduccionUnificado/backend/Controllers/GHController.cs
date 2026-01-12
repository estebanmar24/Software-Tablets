using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for GH (Gestión Humana) Budget and Expense Management.
/// Handles Rubros, TiposServicio, Proveedores, Cotizaciones, and Gastos.
/// </summary>
[ApiController]
[Route("api/gh")]
public class GHController : ControllerBase
{
    private readonly AppDbContext _context;

    public GHController(AppDbContext context)
    {
        _context = context;
    }

    #region Rubros

    [HttpGet("rubros")]
    public async Task<ActionResult<List<GH_Rubro>>> GetRubros()
    {
        var rubros = await _context.GH_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
        return Ok(rubros);
    }

    [HttpPost("rubros")]
    public async Task<ActionResult<GH_Rubro>> CreateRubro([FromBody] GH_Rubro rubro)
    {
        rubro.Activo = true;
        _context.GH_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(new { id = rubro.Id });
    }

    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, [FromBody] GH_Rubro rubro)
    {
        if (id != rubro.Id) return BadRequest();
        _context.Entry(rubro).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("rubros/{id}")]
    public async Task<IActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.GH_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region TiposServicio

    [HttpGet("tipos-servicio")]
    public async Task<ActionResult<List<object>>> GetTiposServicio([FromQuery] int? rubroId)
    {
        var query = _context.GH_TiposServicio
            .Include(t => t.Rubro)
            .Where(t => t.Activo);

        if (rubroId.HasValue)
            query = query.Where(t => t.RubroId == rubroId.Value);

        var tipos = await query
            .OrderBy(t => t.Nombre)
            .Select(t => new
            {
                t.Id,
                t.Nombre,
                t.RubroId,
                RubroNombre = t.Rubro!.Nombre,
                t.PresupuestoMensual,
                t.Activo
            })
            .ToListAsync();

        return Ok(tipos);
    }

    [HttpPost("tipos-servicio")]
    public async Task<ActionResult<GH_TipoServicio>> CreateTipoServicio([FromBody] GH_TipoServicio tipo)
    {
        tipo.Activo = true;
        _context.GH_TiposServicio.Add(tipo);
        await _context.SaveChangesAsync();
        return Ok(new { id = tipo.Id });
    }

    [HttpPut("tipos-servicio/{id}")]
    public async Task<IActionResult> UpdateTipoServicio(int id, [FromBody] GH_TipoServicio tipo)
    {
        if (id != tipo.Id) return BadRequest();
        _context.Entry(tipo).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tipos-servicio/{id}")]
    public async Task<IActionResult> DeleteTipoServicio(int id)
    {
        var tipo = await _context.GH_TiposServicio.FindAsync(id);
        if (tipo == null) return NotFound();
        tipo.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Get presupuestos grid for a given year - returns all TiposServicio with their monthly budgets.
    /// Similar to SST presupuestos grid endpoint.
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult<object>> GetPresupuestosGrid([FromQuery] int anio)
    {
        var tiposServicio = await _context.GH_TiposServicio
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .Select(t => new { t.Id, t.Nombre, t.RubroId })
            .ToListAsync();

        var presupuestos = await _context.GH_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        var result = tiposServicio.Select(tipo => new
        {
            TipoServicioId = tipo.Id,
            TipoServicioNombre = tipo.Nombre,
            tipo.RubroId,
            Meses = Enumerable.Range(1, 12).Select(mes =>
            {
                var pres = presupuestos.FirstOrDefault(p => p.TipoServicioId == tipo.Id && p.Mes == mes);
                return new { Mes = mes, Presupuesto = pres?.Presupuesto ?? 0m };
            }).ToList(),
            TotalAnual = presupuestos.Where(p => p.TipoServicioId == tipo.Id).Sum(p => p.Presupuesto)
        }).ToList();

        // Calculate monthly totals ONLY for active types
        var activeTypeIds = tiposServicio.Select(t => t.Id).ToHashSet();
        
        var activePresupuestos = presupuestos.Where(p => activeTypeIds.Contains(p.TipoServicioId)).ToList();

        var totalesMensuales = Enumerable.Range(1, 12)
            .Select(mes => activePresupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto))
            .ToList();

        return Ok(new
        {
            TiposServicio = result,
            TotalesMensuales = totalesMensuales,
            TotalAnual = activePresupuestos.Sum(p => p.Presupuesto)
        });
    }

    /// <summary>
    /// Get flat list of presupuestos for a given year.
    /// Useful for finding specific monthly budgets in frontend forms.
    /// </summary>
    [HttpGet("presupuestos/list")]
    public async Task<ActionResult<List<object>>> GetPresupuestosList([FromQuery] int anio)
    {
        var presupuestos = await _context.GH_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .Select(p => new
            {
                p.TipoServicioId,
                p.Mes,
                p.Presupuesto
            })
            .ToListAsync();

        return Ok(presupuestos);
    }

    /// <summary>
    /// Bulk update presupuestos for multiple TiposServicio.
    /// Uses GH_PresupuestosMensuales table with upsert logic.
    /// </summary>
    [HttpPost("tipos-servicio/presupuestos")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<GHPresupuestoDto> presupuestos)
    {
        if (presupuestos == null || !presupuestos.Any())
            return BadRequest("No presupuestos provided");

        int updated = 0;
        int created = 0;

        foreach (var dto in presupuestos)
        {
            var existing = await _context.GH_PresupuestosMensuales
                .FirstOrDefaultAsync(p => 
                    p.TipoServicioId == dto.TipoServicioId && 
                    p.Anio == dto.Anio && 
                    p.Mes == dto.Mes);

            if (existing != null)
            {
                existing.Presupuesto = dto.Presupuesto;
                updated++;
            }
            else
            {
                _context.GH_PresupuestosMensuales.Add(new GH_PresupuestoMensual
                {
                    TipoServicioId = dto.TipoServicioId,
                    Anio = dto.Anio,
                    Mes = dto.Mes,
                    Presupuesto = dto.Presupuesto
                });
                created++;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { Updated = updated, Created = created });
    }

    #endregion

    #region Proveedores

    [HttpGet("proveedores")]
    public async Task<ActionResult<List<object>>> GetProveedores([FromQuery] int? tipoServicioId)
    {
        var query = _context.GH_Proveedores
            .Include(p => p.TipoServicio)
            .Where(p => p.Activo);

        if (tipoServicioId.HasValue)
            query = query.Where(p => p.TipoServicioId == tipoServicioId.Value);

        var proveedores = await query
            .OrderBy(p => p.Nombre)
            .Select(p => new
            {
                p.Id,
                p.Nombre,
                p.TipoServicioId,
                TipoServicioNombre = p.TipoServicio!.Nombre,
                p.Telefono,
                p.Correo,
                p.Direccion,
                p.NIT,
                p.Activo
            })
            .ToListAsync();

        return Ok(proveedores);
    }

    [HttpPost("proveedores")]
    public async Task<ActionResult<GH_Proveedor>> CreateProveedor([FromBody] GH_Proveedor proveedor)
    {
        proveedor.Activo = true;
        _context.GH_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(new { id = proveedor.Id });
    }

    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] GH_Proveedor proveedor)
    {
        if (id != proveedor.Id) return BadRequest();
        _context.Entry(proveedor).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.GH_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Cotizaciones

    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.GH_Cotizaciones
            .Include(c => c.Proveedor)
                .ThenInclude(p => p!.TipoServicio)
                    .ThenInclude(t => t!.Rubro)
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
                ProveedorNombre = c.Proveedor!.Nombre,
                TipoServicioId = c.Proveedor.TipoServicioId,
                TipoServicioNombre = c.Proveedor.TipoServicio!.Nombre,
                RubroId = c.Proveedor.TipoServicio.RubroId,
                RubroNombre = c.Proveedor.TipoServicio.Rubro!.Nombre,
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
    public async Task<ActionResult<GH_Cotizacion>> CreateCotizacion([FromBody] GH_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.GH_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, [FromBody] GH_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.GH_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region GastosMensuales

    [HttpGet("gastos")]
    public async Task<ActionResult<List<object>>> GetGastos([FromQuery] int anio, [FromQuery] int? mes)
    {
        var query = _context.GH_GastosMensuales
            .Include(g => g.Rubro)
            .Include(g => g.TipoServicio)
            .Include(g => g.Proveedor)
            .Include(g => g.Cotizacion)
            .Where(g => g.Anio == anio);

        if (mes.HasValue)
            query = query.Where(g => g.Mes == mes.Value);

        var gastos = await query
            .OrderByDescending(g => g.FechaCompra)
            .Select(g => new
            {
                g.Id,
                g.RubroId,
                RubroNombre = g.Rubro!.Nombre,
                g.TipoServicioId,
                TipoServicioNombre = g.TipoServicio!.Nombre,
                g.ProveedorId,
                ProveedorNombre = g.Proveedor!.Nombre,
                g.CotizacionId,
                PrecioCotizado = g.Cotizacion != null ? g.Cotizacion.PrecioCotizado : (decimal?)null,
                g.Anio,
                g.Mes,
                g.NumeroFactura,
                g.Precio,
                g.FechaCompra,
                g.Nota,
                g.ArchivoFactura,
                g.ArchivoFacturaNombre
            })
            .ToListAsync();

        return Ok(gastos);
    }

    [HttpGet("gastos/resumen")]
    public async Task<ActionResult<object>> GetResumenGastos([FromQuery] int anio, [FromQuery] int? mes)
    {
        // 1. Get Expenses
        var queryGastos = _context.GH_GastosMensuales
            .Include(g => g.TipoServicio)
            .Where(g => g.Anio == anio);

        if (mes.HasValue)
            queryGastos = queryGastos.Where(g => g.Mes == mes.Value);

        var gastos = await queryGastos.ToListAsync();

        // 2. Get Budgets
        var queryPresupuestos = _context.GH_PresupuestosMensuales
            .Where(p => p.Anio == anio);
        
        if (mes.HasValue)
            queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes.Value);

        var presupuestos = await queryPresupuestos.ToListAsync();

        // 3. Calculate Totals
        var totalGastado = gastos.Sum(g => g.Precio);
        var totalPresupuesto = presupuestos.Sum(p => p.Presupuesto);

        // 4. Group by TipoServicio
        // We need all Tipos that have either generic budget OR expenses
        var tipoIds = gastos.Select(g => g.TipoServicioId)
            .Union(presupuestos.Select(p => p.TipoServicioId))
            .Distinct()
            .ToList();

        var tiposInfo = await _context.GH_TiposServicio
            .Where(t => tipoIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Nombre);

        var resumenPorTipo = tipoIds.Select(id => new
        {
            TipoServicioId = id,
            TipoServicioNombre = tiposInfo.ContainsKey(id) ? tiposInfo[id] : "Desconocido",
            Presupuesto = presupuestos.Where(p => p.TipoServicioId == id).Sum(p => p.Presupuesto),
            Gastado = gastos.Where(g => g.TipoServicioId == id).Sum(g => g.Precio),
            CantidadGastos = gastos.Count(g => g.TipoServicioId == id)
        }).ToList();

        // 5. Monthly Breakdown (Expenses only)
        var resumenMensual = gastos
            .GroupBy(g => g.Mes)
            .Select(grupo => new
            {
                Mes = grupo.Key,
                Total = grupo.Sum(g => g.Precio)
            })
            .OrderBy(r => r.Mes)
            .ToList();

        return Ok(new
        {
            Anio = anio,
            Mes = mes,
            TotalPresupuesto = totalPresupuesto,
            TotalGastado = totalGastado,
            TotalRestante = totalPresupuesto - totalGastado,
            ResumenPorTipo = resumenPorTipo,
            ResumenMensual = resumenMensual
        });
    }

    [HttpPost("gastos")]
    public async Task<ActionResult<GH_GastoMensual>> CreateGasto([FromBody] GH_GastoMensual gasto)
    {
        _context.GH_GastosMensuales.Add(gasto);
        await _context.SaveChangesAsync();
        return Ok(new { id = gasto.Id });
    }

    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, [FromBody] GH_GastoMensual gasto)
    {
        if (id != gasto.Id) return BadRequest();
        _context.Entry(gasto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.GH_GastosMensuales.FindAsync(id);
        if (gasto == null) return NotFound();
        _context.GH_GastosMensuales.Remove(gasto);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion
}
