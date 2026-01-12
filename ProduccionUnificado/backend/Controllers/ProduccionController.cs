using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ProduccionController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProduccionController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("maestros")]
    public async Task<ActionResult<object>> GetMaestros()
    {
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var proveedores = await _context.Produccion_Proveedores.Where(p => p.Activo).ToListAsync();
        var tiposHora = await _context.Produccion_TiposHora.Where(t => t.Activo).ToListAsync();
        
        // Existing tables
        var maquinas = await _context.Maquinas.Where(m => m.Activo).Select(m => new { m.Id, m.Nombre }).ToListAsync();
        var usuarios = await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new { u.Id, u.Nombre, u.Salario }) // Include Salario for frontend calc
            .ToListAsync();

        return Ok(new
        {
            rubros,
            proveedores,
            tiposHora,
            maquinas,
            usuarios
        });
    }

    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int anio, int? mes = null)
    {
        var query = _context.Produccion_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Usuario)
            .Include(g => g.Maquina)
            .Include(g => g.TipoHora)
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

    [HttpPost("gastos")]
    public async Task<ActionResult<Produccion_Gasto>> CreateGasto(Produccion_Gasto gasto)
    {
        // Basic validations
        if (gasto.RubroId <= 0) return BadRequest("Rubro es requerido");

        // Helper: Validate logic based on Rubro
        var rubro = await _context.Produccion_Rubros.FindAsync(gasto.RubroId);
        if (rubro != null)
        {
            if (rubro.Nombre == "Horas Extras")
            {
                if (gasto.UsuarioId == null) return BadRequest("Usuario es requerido para Horas Extras");
                if (gasto.TipoHoraId == null) return BadRequest("Tipo de Hora es requerido");
                if (gasto.CantidadHoras == null || gasto.CantidadHoras <= 0) return BadRequest("Cantidad de Horas invalidas");

                // Server-side calculation to ensure integrity
                var usuario = await _context.Usuarios.FindAsync(gasto.UsuarioId);
                var tipoHora = await _context.Produccion_TiposHora.FindAsync(gasto.TipoHoraId);

                if (usuario == null || tipoHora == null) return BadRequest("Referencia a Usuario o TipoHora no encontrada");

                // Formula: (Salario / 240) * Factor * Horas
                // 240 is the standard monthly hours
                decimal hourlyRate = usuario.Salario / 240m;
                gasto.Precio = hourlyRate * tipoHora.Factor * (gasto.CantidadHoras ?? 0);
                gasto.Precio = Math.Round(gasto.Precio, 2); // Ensure database precision compatibility
            }
            // Add more if needed
        }

        gasto.Fecha = gasto.Fecha.ToUniversalTime(); // Postgres timestamp handling
        _context.Produccion_Gastos.Add(gasto);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetGastos), new { id = gasto.Id }, gasto);
    }

    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Produccion_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        gasto.Fecha = gasto.Fecha.ToUniversalTime();
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
    /// Get summary with budget comparison for a month
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen(int anio, int mes)
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
        proveedor.RubroId = updated.RubroId;
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

    // ===================== GRAFICAS ENDPOINT =====================
    [HttpGet("graficas")]
    public async Task<ActionResult> GetGraficas(int anio, int? mes = null)
    {
        var query = _context.Produccion_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Usuario)
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
        if (!mes.HasValue)
        {
            var presupuestos = await _context.Produccion_PresupuestosMensuales
                .Where(p => p.Anio == anio)
                .ToListAsync();

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

        var totalGastado = gastos.Sum(g => g.Precio);

        return Ok(new {
            totalGastado,
            porRubro,
            porProveedor,
            porUsuario,
            resumenMensual
        });
    }
}
