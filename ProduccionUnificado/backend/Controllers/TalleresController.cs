using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for Talleres y Despachos Budget and Expense Management.
/// Handles Rubros, Proveedores, Presupuestos, Gastos, and Graficas.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TalleresController : ControllerBase
{
    private readonly AppDbContext _context;

    public TalleresController(AppDbContext context)
    {
        _context = context;
    }

    #region Rubros

    /// <summary>
    /// Get all rubros
    /// </summary>
    [HttpGet("rubros")]
    public async Task<ActionResult<IEnumerable<Talleres_Rubro>>> GetRubros()
    {
        return await _context.Talleres_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
    }

    /// <summary>
    /// Create a new rubro
    /// </summary>
    [HttpPost("rubros")]
    public async Task<ActionResult<Talleres_Rubro>> CreateRubro(Talleres_Rubro rubro)
    {
        _context.Talleres_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(new { id = rubro.Id });
    }

    /// <summary>
    /// Update a rubro
    /// </summary>
    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, Talleres_Rubro rubro)
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
        var rubro = await _context.Talleres_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Proveedores

    /// <summary>
    /// Get all proveedores
    /// </summary>
    [HttpGet("proveedores")]
    public async Task<ActionResult<IEnumerable<Talleres_Proveedor>>> GetProveedores()
    {
        return await _context.Talleres_Proveedores
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .ToListAsync();
    }

    /// <summary>
    /// Create a new proveedor (NIT/Cedula is required)
    /// </summary>
    [HttpPost("proveedores")]
    public async Task<ActionResult<Talleres_Proveedor>> CreateProveedor(Talleres_Proveedor proveedor)
    {
        if (string.IsNullOrWhiteSpace(proveedor.NitCedula))
        {
            return BadRequest("El NIT o Cédula es obligatorio");
        }
        _context.Talleres_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(new { id = proveedor.Id });
    }

    /// <summary>
    /// Update a proveedor
    /// </summary>
    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, Talleres_Proveedor proveedor)
    {
        if (id != proveedor.Id) return BadRequest();
        if (string.IsNullOrWhiteSpace(proveedor.NitCedula))
        {
            return BadRequest("El NIT o Cédula es obligatorio");
        }
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
        var proveedor = await _context.Talleres_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Gastos

    /// <summary>
    /// Get gastos for a specific month/year
    /// </summary>
    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int? anio, int? mes)
    {
        var query = _context.Talleres_Gastos
            .Include(g => g.Proveedor)
            .Include(g => g.Rubro)
            .AsQueryable();

        if (anio.HasValue)
            query = query.Where(g => g.Anio == anio.Value);
        if (mes.HasValue)
            query = query.Where(g => g.Mes == mes.Value);

        var gastos = await query
            .OrderByDescending(g => g.Fecha)
            .Select(g => new
            {
                g.Id,
                g.ProveedorId,
                ProveedorNombre = g.Proveedor != null ? g.Proveedor.Nombre : "",
                ProveedorNit = g.Proveedor != null ? g.Proveedor.NitCedula : "",
                g.RubroId,
                RubroNombre = g.Rubro != null ? g.Rubro.Nombre : "",
                g.Anio,
                g.Mes,
                g.NumeroFactura,
                g.Precio,
                g.Fecha,
                g.Observaciones
            })
            .ToListAsync();

        return Ok(gastos);
    }

    /// <summary>
    /// Create a new gasto (NumeroFactura is required)
    /// </summary>
    [HttpPost("gastos")]
    public async Task<IActionResult> CreateGasto(Talleres_Gasto gasto)
    {
        try 
        {
            if (string.IsNullOrWhiteSpace(gasto.NumeroFactura))
            {
                return BadRequest("El número de factura es obligatorio");
            }
            
            // Validate proveedor exists
            var proveedor = await _context.Talleres_Proveedores.FindAsync(gasto.ProveedorId);
            if (proveedor == null || !proveedor.Activo)
            {
                return BadRequest("El proveedor no existe o no está activo");
            }

            // Auto-populate Anio and Mes from Fecha
            if (gasto.Fecha != default)
            {
                gasto.Anio = gasto.Fecha.Year;
                gasto.Mes = gasto.Fecha.Month;
            }
            else 
            {
                gasto.Fecha = DateTime.Now;
                gasto.Anio = gasto.Fecha.Year;
                gasto.Mes = gasto.Fecha.Month;
            }

            // Ensure navigation properties are NULL so EF doesn't try to track them as new objects
            gasto.Proveedor = null;
            gasto.Rubro = null;

            _context.Talleres_Gastos.Add(gasto);
            await _context.SaveChangesAsync();
            
            return Ok(new { id = gasto.Id, success = true, message = "Gasto creado correctamente" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] CreateGasto failed: {ex.Message}");
            return StatusCode(500, new { error = ex.Message, detail = ex.InnerException?.Message });
        }
    }

    /// <summary>
    /// Update a gasto
    /// </summary>
    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Talleres_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();
        if (string.IsNullOrWhiteSpace(gasto.NumeroFactura))
        {
            return BadRequest("El número de factura es obligatorio");
        }

        // Auto-update Anio and Mes from Fecha
        if (gasto.Fecha != default)
        {
            gasto.Anio = gasto.Fecha.Year;
            gasto.Mes = gasto.Fecha.Month;
        }

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
        var gasto = await _context.Talleres_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();
        _context.Talleres_Gastos.Remove(gasto);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Presupuestos

    /// <summary>
    /// Get presupuestos for a specific year
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult<IEnumerable<object>>> GetPresupuestos(int anio)
    {
        var presupuestos = await _context.Talleres_PresupuestosMensuales
            .Include(p => p.Rubro)
            .Where(p => p.Anio == anio)
            .Select(p => new
            {
                p.Id,
                p.RubroId,
                RubroNombre = p.Rubro != null ? p.Rubro.Nombre : "",
                p.Anio,
                p.Mes,
                p.Presupuesto
            })
            .ToListAsync();

        return Ok(presupuestos);
    }

    /// <summary>
    /// Set or update a presupuesto for a specific Rubro/month/year
    /// </summary>
    [HttpPost("presupuestos")]
    public async Task<IActionResult> SetPresupuesto(Talleres_PresupuestoMensual presupuesto)
    {
        var existing = await _context.Talleres_PresupuestosMensuales
            .FirstOrDefaultAsync(p => p.RubroId == presupuesto.RubroId 
                && p.Anio == presupuesto.Anio 
                && p.Mes == presupuesto.Mes);

        if (existing != null)
        {
            existing.Presupuesto = presupuesto.Presupuesto;
        }
        else
        {
            _context.Talleres_PresupuestosMensuales.Add(presupuesto);
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Bulk update presupuestos
    /// </summary>
    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<Talleres_PresupuestoMensual> presupuestos)
    {
        foreach (var p in presupuestos)
        {
            var existing = await _context.Talleres_PresupuestosMensuales
                .FirstOrDefaultAsync(x => x.RubroId == p.RubroId && x.Anio == p.Anio && x.Mes == p.Mes);

            if (existing != null)
            {
                existing.Presupuesto = p.Presupuesto;
            }
            else
            {
                _context.Talleres_PresupuestosMensuales.Add(p);
            }
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    #endregion

    #region Graficas (Calculated Data)

    /// <summary>
    /// Get graficas data for a specific month/year
    /// Returns: presupuesto vs gastado vs restante por rubro, alertas
    /// </summary>
    [HttpGet("graficas/{anio}/{mes}")]
    public async Task<ActionResult<object>> GetGraficas(int anio, int mes)
    {
        var rubros = await _context.Talleres_Rubros.Where(r => r.Activo).ToListAsync();
        var presupuestos = await _context.Talleres_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .ToListAsync();
        var gastos = await _context.Talleres_Gastos
            .Where(g => g.Anio == anio && g.Mes == mes)
            .GroupBy(g => g.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Precio) })
            .ToListAsync();

        var alertas = new List<string>();
        var porRubro = rubros.Select(r =>
        {
            var presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id)?.Presupuesto ?? 0;
            var gastado = gastos.FirstOrDefault(g => g.RubroId == r.Id)?.Total ?? 0;
            var restante = presupuesto - gastado;

            if (restante < 0)
            {
                alertas.Add($"El rubro '{r.Nombre}' superó el límite mensual por ${Math.Abs(restante):N0}");
            }

            return new
            {
                RubroId = r.Id,
                Rubro = r.Nombre,
                Presupuesto = presupuesto,
                Gastado = gastado,
                Restante = restante
            };
        }).ToList();

        var totalPresupuesto = porRubro.Sum(x => x.Presupuesto);
        var totalGastado = porRubro.Sum(x => x.Gastado);
        var totalRestante = totalPresupuesto - totalGastado;

        return Ok(new
        {
            Anio = anio,
            Mes = mes,
            PorRubro = porRubro,
            TotalPresupuesto = totalPresupuesto,
            TotalGastado = totalGastado,
            TotalRestante = totalRestante,
            Alertas = alertas
        });
    }

    /// <summary>
    /// Get annual summary
    /// </summary>
    [HttpGet("graficas/anual/{anio}")]
    public async Task<ActionResult<object>> GetGraficasAnual(int anio)
    {
        var rubros = await _context.Talleres_Rubros.Where(r => r.Activo).ToListAsync();
        var presupuestos = await _context.Talleres_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .GroupBy(p => p.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Presupuesto) })
            .ToListAsync();
        var gastos = await _context.Talleres_Gastos
            .Where(g => g.Anio == anio)
            .GroupBy(g => g.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Precio) })
            .ToListAsync();

        var porRubro = rubros.Select(r => new
        {
            RubroId = r.Id,
            Rubro = r.Nombre,
            PresupuestoAnual = presupuestos.FirstOrDefault(p => p.RubroId == r.Id)?.Total ?? 0,
            GastadoAnual = gastos.FirstOrDefault(g => g.RubroId == r.Id)?.Total ?? 0
        }).ToList();

        return Ok(new
        {
            Anio = anio,
            PorRubro = porRubro,
            TotalPresupuesto = porRubro.Sum(x => x.PresupuestoAnual),
            TotalGastado = porRubro.Sum(x => x.GastadoAnual)
        });
    }

    #endregion
}
