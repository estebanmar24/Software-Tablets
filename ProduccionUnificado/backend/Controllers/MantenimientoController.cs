using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class MantenimientoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public MantenimientoController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    #region Maestros

    [HttpGet("maestros")]
    public async Task<ActionResult> GetMaestros()
    {
        var rubros = await _context.Mantenimiento_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();

        var proveedores = await _context.Mantenimiento_Proveedores
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .ToListAsync();

        var maquinas = await _context.Maquinas.Where(m => m.Activo && m.Nombre != null && !m.Nombre.Contains("TERMINADOS")).Select(m => new { m.Id, m.Nombre }).ToListAsync();
        
        // Ordenamiento Natural (1, 2, ... 10)
        maquinas = maquinas.OrderBy(m => 
        {
            var match = System.Text.RegularExpressions.Regex.Match(m.Nombre ?? "", @"^\d+");
            return match.Success ? int.Parse(match.Value) : int.MaxValue;
        })
        .ThenBy(m => m.Nombre ?? "")
        .ToList();

        var productos = await _context.Mantenimiento_Productos
            .Include(p => p.Rubro)
            .Where(p => p.Activo)
            .ToListAsync();

        var usuarios = await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new { u.Id, u.Nombre, u.Documento, u.Salario })
            .ToListAsync();

        var tiposHora = await _context.Mantenimiento_TiposHora
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync();

        var tiposRecargo = await _context.Mantenimiento_TiposRecargo
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync();

        return Ok(new
        {
            rubros,
            proveedores,
            maquinas,
            productos,
            usuarios,
            tiposHora,
            tiposRecargo
        });
    }

    #endregion

    #region Rubros

    [HttpGet("rubros")]
    public async Task<ActionResult<List<Mantenimiento_Rubro>>> GetRubros()
    {
        return await _context.Mantenimiento_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
    }

    [HttpPost("rubros")]
    public async Task<ActionResult> CreateRubro([FromBody] Mantenimiento_Rubro rubro)
    {
        _context.Mantenimiento_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(rubro);
    }

    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, [FromBody] Mantenimiento_Rubro rubro)
    {
        if (id != rubro.Id) return BadRequest();
        _context.Entry(rubro).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("rubros/{id}")]
    public async Task<IActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.Mantenimiento_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Proveedores

    [HttpGet("proveedores")]
    public async Task<ActionResult> GetProveedores([FromQuery] int? rubroId)
    {
        var query = _context.Mantenimiento_Proveedores
            .Include(p => p.Rubro)
            .Where(p => p.Activo);

        if (rubroId.HasValue)
            query = query.Where(p => p.RubroId == rubroId.Value);

        var result = await query
            .OrderBy(p => p.Nombre)
            .Select(p => new
            {
                p.Id,
                p.Nombre,
                p.Nit,
                p.Telefono,
                p.Direccion,
                p.Correo,
                p.RubroId,
                RubroNombre = p.Rubro != null ? p.Rubro.Nombre : "N/A"
            })
            .ToListAsync();

        return Ok(result);
    }

    [HttpPost("proveedores")]
    public async Task<ActionResult> CreateProveedor([FromBody] Mantenimiento_Proveedor proveedor)
    {
        _context.Mantenimiento_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        return Ok(proveedor);
    }

    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] Mantenimiento_Proveedor proveedor)
    {
        if (id != proveedor.Id) return BadRequest();
        _context.Entry(proveedor).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Mantenimiento_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Gastos

    [HttpGet("gastos")]
    public async Task<ActionResult> GetGastos([FromQuery] int anio, [FromQuery] int mes)
    {
        var gastos = await _context.Mantenimiento_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Maquina)
            .Include(g => g.Producto)
            .Where(g => g.Activo && g.Anio == anio && g.Mes == mes)
            .OrderByDescending(g => g.Fecha)
            .Select(g => new
            {
                g.Id,
                g.RubroId,
                Rubro = new { g.Rubro!.Id, g.Rubro.Nombre },
                g.ProveedorId,
                Proveedor = g.Proveedor != null ? new { g.Proveedor.Id, g.Proveedor.Nombre } : null,
                ProveedorNombre = g.Proveedor != null ? g.Proveedor.Nombre : "Empresa",
                g.MaquinaId,
                MaquinaNombre = g.Maquina != null ? g.Maquina.Nombre : (g.OtraMaquinaNombre ?? "N/A"),
                Maquina = g.Maquina != null ? new { g.Maquina.Id, g.Maquina.Nombre } : null,
                g.ProductoId,
                Producto = g.Producto != null ? new { g.Producto.Id, g.Producto.Nombre } : null,
                ProductoNombre = g.Producto != null ? g.Producto.Nombre : "N/A",
                g.Cantidad,
                g.OtraMaquinaNombre,
                g.Precio,
                Fecha = g.Fecha.ToString("yyyy-MM-ddTHH:mm:ss"),
                g.Nota,
                g.NumeroFactura,
                g.FacturaPdfUrl,
                g.EsPendiente,
                g.EsSolicitudCredito,
                g.NumeroOP,
                g.Anio,
                g.Mes
            })
            .ToListAsync();

        return Ok(new { gastos });
    }

    [HttpPost("gastos")]
    public async Task<ActionResult> CreateGasto([FromBody] Mantenimiento_Gasto gasto)
    {
        gasto.Anio = gasto.Fecha.Year;
        gasto.Mes = gasto.Fecha.Month;
        gasto.Activo = true;

        _context.Mantenimiento_Gastos.Add(gasto);
        await _context.SaveChangesAsync();
        return Ok(gasto);
    }

    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, [FromBody] Mantenimiento_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        gasto.Anio = gasto.Fecha.Year;
        gasto.Mes = gasto.Fecha.Month;

        _context.Entry(gasto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.Mantenimiento_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();
        gasto.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("resumen-gastos")]
    public async Task<ActionResult> GetResumen([FromQuery] int anio, [FromQuery] int mes)
    {
        var presupuestos = await _context.Mantenimiento_PresupuestosMensuales
            .Where(p => p.Anio == anio && p.Mes == mes)
            .ToListAsync();

        var gastos = await _context.Mantenimiento_Gastos
            .Where(g => g.Activo && g.Anio == anio && g.Mes == mes)
            .GroupBy(g => g.RubroId)
            .Select(g => new
            {
                RubroId = g.Key,
                TotalGasto = g.Sum(x => x.Precio)
            })
            .ToListAsync();

        var rubros = await _context.Mantenimiento_Rubros
            .Where(r => r.Activo)
            .ToListAsync();

        var porRubro = rubros.Select(r =>
        {
            var p = presupuestos.FirstOrDefault(x => x.RubroId == r.Id)?.Presupuesto ?? 0;
            var g = gastos.FirstOrDefault(x => x.RubroId == r.Id)?.TotalGasto ?? 0;
            return new
            {
                RubroId = r.Id,
                RubroNombre = r.Nombre,
                Presupuesto = p,
                Gastado = g,
                Diferencia = p - g
            };
        }).ToList();

        var totalPresupuesto = porRubro.Sum(x => x.Presupuesto);
        var totalGastado = porRubro.Sum(x => x.Gastado);
        var totalRestante = totalPresupuesto - totalGastado;

        return Ok(new
        {
            totalPresupuesto,
            totalGastado,
            totalRestante,
            total = totalGastado,
            porRubro
        });
    }

    #endregion

    #region Presupuestos

    [HttpGet("presupuestos-grid")]
    public async Task<ActionResult> GetPresupuestosGrid([FromQuery] int anio)
    {
        var rubros = await _context.Mantenimiento_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();

        var presupuestos = await _context.Mantenimiento_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        var grid = rubros.Select(r => new
        {
            TipoServicioId = r.Id,
            TipoServicioNombre = r.Nombre,
            Meses = Enumerable.Range(1, 12).Select(m => new
            {
                Mes = m,
                Presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == m)?.Presupuesto ?? 0
            }).ToList()
        }).ToList();

        var totalesMensuales = Enumerable.Range(1, 12).Select(m => 
            presupuestos.Where(p => p.Mes == m).Sum(p => p.Presupuesto)
        ).ToList();

        return Ok(new
        {
            tiposServicio = grid,
            totalesMensuales,
            totalAnual = totalesMensuales.Sum()
        });
    }

    [HttpPost("presupuestos/bulk")]
    public async Task<ActionResult> SetPresupuestosBulk([FromBody] List<Mantenimiento_PresupuestoMensual> items)
    {
        foreach (var item in items)
        {
            var existing = await _context.Mantenimiento_PresupuestosMensuales
                .FirstOrDefaultAsync(p => p.RubroId == item.RubroId && p.Anio == item.Anio && p.Mes == item.Mes);

            if (existing != null)
            {
                existing.Presupuesto = item.Presupuesto;
            }
            else
            {
                _context.Mantenimiento_PresupuestosMensuales.Add(item);
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    #endregion

    #region Cotizaciones

    [HttpGet("cotizaciones")]
    public async Task<ActionResult> GetCotizaciones([FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Mantenimiento_Cotizaciones
            .Include(c => c.Rubro)
            .Include(c => c.Proveedor)
            .Where(c => c.Activo);

        if (anio.HasValue) query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue) query = query.Where(c => c.Mes == mes.Value);

        var result = await query
            .OrderByDescending(c => c.Anio).ThenByDescending(c => c.Mes)
            .Select(c => new
            {
                c.Id,
                c.RubroId,
                RubroNombre = c.Rubro!.Nombre,
                c.ProveedorId,
                ProveedorNombre = c.Proveedor!.Nombre,
                c.Anio,
                c.Mes,
                c.PrecioCotizado,
                c.Nota,
                c.Descripcion
            })
            .ToListAsync();

        return Ok(result);
    }

    [HttpPost("cotizaciones")]
    public async Task<ActionResult> CreateCotizacion([FromBody] Mantenimiento_Cotizacion cotizacion)
    {
        _context.Mantenimiento_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(cotizacion);
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, [FromBody] Mantenimiento_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cot = await _context.Mantenimiento_Cotizaciones.FindAsync(id);
        if (cot == null) return NotFound();
        cot.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Productos

    [HttpGet("productos")]
    public async Task<ActionResult> GetProductos([FromQuery] int? rubroId)
    {
        var query = _context.Mantenimiento_Productos
            .Include(p => p.Rubro)
            .Where(p => p.Activo);

        if (rubroId.HasValue)
            query = query.Where(p => p.RubroId == rubroId.Value);

        var result = await query
            .OrderBy(p => p.Nombre)
            .Select(p => new
            {
                p.Id,
                p.Nombre,
                p.Referencia,
                p.Descripcion,
                p.Medida,
                p.PuntoReorden,
                p.MaxStock,
                p.RubroId,
                RubroNombre = p.Rubro != null ? p.Rubro.Nombre : "N/A"
            })
            .ToListAsync();

        return Ok(result);
    }

    [HttpPost("productos")]
    public async Task<ActionResult> CreateProducto([FromBody] Mantenimiento_Producto producto)
    {
        _context.Mantenimiento_Productos.Add(producto);
        await _context.SaveChangesAsync();
        return Ok(producto);
    }

    [HttpPut("productos/{id}")]
    public async Task<IActionResult> UpdateProducto(int id, [FromBody] Mantenimiento_Producto producto)
    {
        if (id != producto.Id) return BadRequest();
        _context.Entry(producto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("productos/{id}")]
    public async Task<IActionResult> DeleteProducto(int id)
    {
        var prod = await _context.Mantenimiento_Productos.FindAsync(id);
        if (prod == null) return NotFound();
        prod.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Inventario

    [HttpGet("inventario")]
    public async Task<ActionResult> GetInventario()
    {
        var rubrosValidos = new[] { "Ferreteria", "Ferretería", "Lubricacion", "Lubricación", "Repuestos", "Rodamientos", "Sistema Aire", "Consumible", "Eléctrico", "Neumático", "Mecánico" };
        
        var productos = await _context.Mantenimiento_Productos
            .Include(p => p.Rubro)
            .Where(p => p.Activo && p.Rubro != null && rubrosValidos.Contains(p.Rubro.Nombre))
            .Select(p => new
            {
                id = p.Id.ToString(),
                codigo = p.Referencia ?? $"PRD-{p.Id}",
                nombre = p.Nombre,
                referencia = p.Referencia ?? "",
                descripcion = p.Descripcion ?? "",
                medida = p.Medida ?? "",
                categoria = p.Rubro!.Nombre,
                maxStock = p.MaxStock,
                puntoReorden = p.PuntoReorden,
                stock = _context.Mantenimiento_Gastos
                    .Where(g => g.ProductoId == p.Id && g.Activo && !g.EsPendiente)
                    .Sum(g => g.Cantidad ?? 0)
            })
            .ToListAsync();

        return Ok(productos);
    }

    #endregion

    #region Tipos Hora y Recargo

    [HttpGet("tiposhora")]
    public async Task<ActionResult> GetTiposHora()
    {
        return Ok(await _context.Mantenimiento_TiposHora
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync());
    }

    [HttpPost("tiposhora")]
    public async Task<ActionResult> CreateTipoHora([FromBody] Mantenimiento_TipoHora item)
    {
        _context.Mantenimiento_TiposHora.Add(item);
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("tiposhora/{id}")]
    public async Task<IActionResult> UpdateTipoHora(int id, [FromBody] Mantenimiento_TipoHora item)
    {
        if (id != item.Id) return BadRequest();
        _context.Entry(item).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tiposhora/{id}")]
    public async Task<IActionResult> DeleteTipoHora(int id)
    {
        var item = await _context.Mantenimiento_TiposHora.FindAsync(id);
        if (item == null) return NotFound();
        item.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("tiposrecargo")]
    public async Task<ActionResult> GetTiposRecargo()
    {
        return Ok(await _context.Mantenimiento_TiposRecargo
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync());
    }

    [HttpPost("tiposrecargo")]
    public async Task<ActionResult> CreateTipoRecargo([FromBody] Mantenimiento_TipoRecargo item)
    {
        _context.Mantenimiento_TiposRecargo.Add(item);
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("tiposrecargo/{id}")]
    public async Task<IActionResult> UpdateTipoRecargo(int id, [FromBody] Mantenimiento_TipoRecargo item)
    {
        if (id != item.Id) return BadRequest();
        _context.Entry(item).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("tiposrecargo/{id}")]
    public async Task<IActionResult> DeleteTipoRecargo(int id)
    {
        var item = await _context.Mantenimiento_TiposRecargo.FindAsync(id);
        if (item == null) return NotFound();
        item.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Upload

    [HttpPost("upload-factura")]
    public async Task<ActionResult> UploadFactura(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No file uploaded");

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var path = Path.Combine(_env.WebRootPath, "uploads", "facturas_mantenimiento");

        if (!Directory.Exists(path)) Directory.CreateDirectory(path);

        var filePath = Path.Combine(path, fileName);
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { url = $"/uploads/facturas_mantenimiento/{fileName}" });
    }

    #endregion

    [HttpGet("graficas")]
    public async Task<ActionResult> GetGraficas([FromQuery] int anio, [FromQuery] int? mes)
    {
        var query = _context.Mantenimiento_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Where(g => g.Activo && g.Anio == anio);

        if (mes.HasValue && mes.Value > 0) query = query.Where(g => g.Mes == mes.Value);

        var gastos = await query.ToListAsync();

        var totalGastado = gastos.Sum(g => g.Precio);

        var porRubro = gastos
            .Where(g => g.Rubro != null)
            .GroupBy(g => new { g.RubroId, g.Rubro!.Nombre })
            .Select(g => new
            {
                Id = g.Key.RubroId,
                Label = g.Key.Nombre,
                Value = g.Sum(x => x.Precio)
            })
            .OrderByDescending(x => x.Value)
            .ToList();

        var porProveedor = gastos
            .Where(g => g.Proveedor != null)
            .GroupBy(g => new { g.ProveedorId, g.Proveedor!.Nombre })
            .Select(g => new
            {
                Id = g.Key.ProveedorId,
                Label = g.Key.Nombre,
                Value = g.Sum(x => x.Precio)
            })
            .OrderByDescending(x => x.Value)
            .ToList();

        var resumenMensual = gastos
            .GroupBy(g => g.Mes)
            .Select(g => new
            {
                Mes = g.Key,
                Total = g.Sum(x => x.Precio)
            })
            .OrderBy(x => x.Mes)
            .ToList();

        return Ok(new
        {
            totalGastado,
            porRubro,
            porProveedor,
            resumenMensual
        });
    }
}
