using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for SST (Salud y Seguridad en el Trabajo) Budget and Expense Management.
/// Handles Rubros, TiposServicio, Proveedores, Presupuestos, and Gastos.
/// </summary>
[ApiController]
[Route("api/sst")]
public class SSTController : ControllerBase
{
    private readonly AppDbContext _context;

    public SSTController(AppDbContext context)
    {
        _context = context;
    }

    #region Rubros

    /// <summary>
    /// Get all rubros
    /// </summary>
    [HttpGet("rubros")]
    public async Task<ActionResult<List<SST_Rubro>>> GetRubros()
    {
        var rubros = await _context.SST_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
        return Ok(rubros);
    }

    /// <summary>
    /// Create a new rubro
    /// </summary>
    [HttpPost("rubros")]
    public async Task<ActionResult<SST_Rubro>> CreateRubro([FromBody] SST_Rubro rubro)
    {
        rubro.Activo = true;
        _context.SST_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(new { id = rubro.Id });
    }

    /// <summary>
    /// Update a rubro
    /// </summary>
    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, [FromBody] SST_Rubro rubro)
    {
        if (id != rubro.Id) return BadRequest();
        
        _context.Entry(rubro).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete (deactivate) a rubro
    /// </summary>
    [HttpDelete("rubros/{id}")]
    public async Task<IActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.SST_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region TiposServicio

    /// <summary>
    /// Get all tipos de servicio, optionally filtered by rubro
    /// </summary>
    [HttpGet("tipos-servicio")]
    public async Task<ActionResult<List<object>>> GetTiposServicio([FromQuery] int? rubroId)
    {
        var query = _context.SST_TiposServicio
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
                t.Activo
            })
            .ToListAsync();

        return Ok(tipos);
    }

    /// <summary>
    /// Create a new tipo de servicio
    /// </summary>
    [HttpPost("tipos-servicio")]
    public async Task<ActionResult<SST_TipoServicio>> CreateTipoServicio([FromBody] SST_TipoServicio tipo)
    {
        tipo.Activo = true;
        _context.SST_TiposServicio.Add(tipo);
        await _context.SaveChangesAsync();
        return Ok(new { id = tipo.Id });
    }

    /// <summary>
    /// Update a tipo de servicio
    /// </summary>
    [HttpPut("tipos-servicio/{id}")]
    public async Task<IActionResult> UpdateTipoServicio(int id, [FromBody] SST_TipoServicio tipo)
    {
        if (id != tipo.Id) return BadRequest();
        
        _context.Entry(tipo).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete (deactivate) a tipo de servicio
    /// </summary>
    [HttpDelete("tipos-servicio/{id}")]
    public async Task<IActionResult> DeleteTipoServicio(int id)
    {
        var tipo = await _context.SST_TiposServicio.FindAsync(id);
        if (tipo == null) return NotFound();
        
        tipo.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Proveedores

    /// <summary>
    /// Get all proveedores, optionally filtered by tipo de servicio
    /// </summary>
    [HttpGet("proveedores")]
    public async Task<ActionResult<List<object>>> GetProveedores([FromQuery] int? tipoServicioId)
    {
        var query = _context.SST_Proveedores
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
                p.Activo
            })
            .ToListAsync();

        return Ok(proveedores);
    }

    /// <summary>
    /// Create a new proveedor
    /// </summary>
    [HttpPost("proveedores")]
    public async Task<ActionResult<SST_Proveedor>> CreateProveedor([FromBody] SST_Proveedor proveedor)
    {
        proveedor.Activo = true;
        _context.SST_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(new { id = proveedor.Id });
    }

    /// <summary>
    /// Update a proveedor
    /// </summary>
    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] SST_Proveedor proveedor)
    {
        if (id != proveedor.Id) return BadRequest();
        
        _context.Entry(proveedor).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete (deactivate) a proveedor
    /// </summary>
    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.SST_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Presupuestos Mensuales

    /// <summary>
    /// Get all presupuestos for a specific year
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult<List<object>>> GetPresupuestos([FromQuery] int anio)
    {
        var presupuestos = await _context.SST_PresupuestosMensuales
            .Include(p => p.TipoServicio)
            .Where(p => p.Anio == anio)
            .OrderBy(p => p.TipoServicio!.Nombre)
            .ThenBy(p => p.Mes)
            .Select(p => new
            {
                p.Id,
                p.TipoServicioId,
                TipoServicioNombre = p.TipoServicio!.Nombre,
                p.Anio,
                p.Mes,
                p.Presupuesto
            })
            .ToListAsync();

        return Ok(presupuestos);
    }

    /// <summary>
    /// Get presupuesto grid data for a year (TipoServicio rows x 12 months columns)
    /// </summary>
    [HttpGet("presupuestos/grid")]
    public async Task<ActionResult<object>> GetPresupuestosGrid([FromQuery] int anio)
    {
        // Get all tipos de servicio
        var tiposServicio = await _context.SST_TiposServicio
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync();

        // Get all presupuestos for the year
        var presupuestos = await _context.SST_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        // Build grid data
        var gridData = tiposServicio.Select(tipo => new
        {
            TipoServicioId = tipo.Id,
            TipoServicioNombre = tipo.Nombre,
            Meses = Enumerable.Range(1, 12).Select(mes =>
            {
                var presupuesto = presupuestos.FirstOrDefault(p => p.TipoServicioId == tipo.Id && p.Mes == mes);
                return new
                {
                    Mes = mes,
                    PresupuestoId = presupuesto?.Id,
                    Presupuesto = presupuesto?.Presupuesto ?? 0
                };
            }).ToList()
        }).ToList();

        // Calculate totals per month
        var totalesMensuales = Enumerable.Range(1, 12).Select(mes =>
            presupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto)
        ).ToList();

        return Ok(new
        {
            Anio = anio,
            TiposServicio = gridData,
            TotalesMensuales = totalesMensuales,
            TotalAnual = presupuestos.Sum(p => p.Presupuesto)
        });
    }

    /// <summary>
    /// Set or update a presupuesto for a specific TipoServicio/month/year
    /// </summary>
    [HttpPost("presupuestos")]
    public async Task<ActionResult<SST_PresupuestoMensual>> SetPresupuesto([FromBody] SST_PresupuestoMensual presupuesto)
    {
        // Check if exists
        var existing = await _context.SST_PresupuestosMensuales
            .FirstOrDefaultAsync(p => 
                p.TipoServicioId == presupuesto.TipoServicioId && 
                p.Anio == presupuesto.Anio && 
                p.Mes == presupuesto.Mes);

        if (existing != null)
        {
            existing.Presupuesto = presupuesto.Presupuesto;
        }
        else
        {
            _context.SST_PresupuestosMensuales.Add(presupuesto);
        }

        await _context.SaveChangesAsync();
        return Ok(presupuesto);
    }

    /// <summary>
    /// Bulk update presupuestos
    /// </summary>
    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<SST_PresupuestoMensual> presupuestos)
    {
        foreach (var presupuesto in presupuestos)
        {
            var existing = await _context.SST_PresupuestosMensuales
                .FirstOrDefaultAsync(p =>
                    p.TipoServicioId == presupuesto.TipoServicioId &&
                    p.Anio == presupuesto.Anio &&
                    p.Mes == presupuesto.Mes);

            if (existing != null)
            {
                existing.Presupuesto = presupuesto.Presupuesto;
            }
            else
            {
                _context.SST_PresupuestosMensuales.Add(presupuesto);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = $"Updated {presupuestos.Count} presupuestos" });
    }

    #endregion

    #region Cotizaciones

    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.SST_Cotizaciones
            .Include(c => c.Proveedor)
            .ThenInclude(p => p.TipoServicio)
            .ThenInclude(t => t.Rubro)
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
    public async Task<ActionResult<SST_Cotizacion>> CreateCotizacion([FromBody] SST_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.SST_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, [FromBody] SST_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.SST_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Gastos Mensuales

    /// <summary>
    /// Get gastos for a specific month/year
    /// </summary>
    [HttpGet("gastos")]
    public async Task<ActionResult<List<object>>> GetGastos([FromQuery] int anio, [FromQuery] int? mes)
    {
        var query = _context.SST_GastosMensuales
            .Include(g => g.Rubro)
            .Include(g => g.TipoServicio)
            .Include(g => g.Proveedor)
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

    /// <summary>
    /// Get gastos summary with presupuesto comparison
    /// </summary>
    [HttpGet("gastos/resumen")]
    public async Task<ActionResult<object>> GetGastosResumen([FromQuery] int anio, [FromQuery] int? mes)
    {
        // 1. Get Expenses
        var queryGastos = _context.SST_GastosMensuales
            .Where(g => g.Anio == anio);
        
        if (mes.HasValue)
            queryGastos = queryGastos.Where(g => g.Mes == mes.Value);

        var gastos = await queryGastos.ToListAsync();

        // 2. Get Budgets
        var queryPresupuestos = _context.SST_PresupuestosMensuales
            .Where(p => p.Anio == anio);
            
        if (mes.HasValue)
            queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes.Value);

        var presupuestos = await queryPresupuestos.ToListAsync();

        // 3. Totals
        var totalPresupuesto = presupuestos.Sum(p => p.Presupuesto);
        var totalGastado = gastos.Sum(g => g.Precio);

        // 4. Group by TipoServicio
        var tipoIds = gastos.Select(g => g.TipoServicioId)
            .Union(presupuestos.Select(p => p.TipoServicioId))
            .Distinct()
            .ToList();

        var tiposInfo = await _context.SST_TiposServicio
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
        
        // 5. Monthly Breakdown
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

    /// <summary>
    /// Create a new gasto
    /// </summary>
    [HttpPost("gastos")]
    public async Task<ActionResult<SST_GastoMensual>> CreateGasto([FromBody] SST_GastoMensual gasto)
    {
        _context.SST_GastosMensuales.Add(gasto);
        await _context.SaveChangesAsync();
        return Ok(new { id = gasto.Id });
    }

    /// <summary>
    /// Update a gasto
    /// </summary>
    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, [FromBody] SST_GastoMensual gasto)
    {
        if (id != gasto.Id) return BadRequest();

        _context.Entry(gasto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete a gasto
    /// </summary>
    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.SST_GastosMensuales.FindAsync(id);
        if (gasto == null) return NotFound();

        _context.SST_GastosMensuales.Remove(gasto);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion
}
