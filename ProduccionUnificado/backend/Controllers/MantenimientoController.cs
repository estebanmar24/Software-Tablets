using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class MantenimientoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly GastoAutorizacionService _gastoAutorizacion;

    public MantenimientoController(AppDbContext context, IWebHostEnvironment env, GastoAutorizacionService gastoAutorizacion)
    {
        _context = context;
        _env = env;
        _gastoAutorizacion = gastoAutorizacion;
    }

    private Task RegistrarTrazabilidadAsync(
        string modulo, string entidad, string accion, int? entidadId, string descripcion, object? detalle = null)
        => MantenimientoTrazabilidadHelper.RegistrarAsync(
            _context, HttpContext, modulo, entidad, accion, entidadId, descripcion, detalle);

    private IActionResult? ValidarFechasCredito(Mantenimiento_Gasto gasto, bool esLabor)
    {
        if (esLabor)
        {
            gasto.FechaEntregaFactura = null;
            gasto.FechaVencimientoFactura = null;
            return null;
        }

        if (!gasto.EsSolicitudCredito)
        {
            gasto.FechaEntregaFactura = null;
            gasto.FechaVencimientoFactura = null;
            return null;
        }

        if (!gasto.FechaEntregaFactura.HasValue)
            return BadRequest("La fecha de entrega de factura es obligatoria para gastos a crédito.");

        if (!gasto.FechaVencimientoFactura.HasValue)
            return BadRequest("La fecha de vencimiento de factura es obligatoria para gastos a crédito.");

        if (gasto.FechaVencimientoFactura.Value.Date < gasto.FechaEntregaFactura.Value.Date)
            return BadRequest("La fecha de vencimiento no puede ser anterior a la fecha de entrega de factura.");

        return null;
    }

    #region Maestros

    [HttpGet("maestros")]
    public async Task<ActionResult> GetMaestros()
    {
        var rubros = await _context.Mantenimiento_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();

        var proveedores = await ProveedorRubroHelper.ListMantenimientoProveedoresAsync(_context);

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
            .Select(p => new
            {
                p.Id,
                p.Nombre,
                p.Referencia,
                p.Descripcion,
                p.Medida,
                p.TipoProducto,
                p.Stock,
                p.PuntoReorden,
                p.MaxStock,
                p.RubroId,
                RubroNombre = p.Rubro != null ? p.Rubro.Nombre : "N/A"
            })
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
        await RegistrarTrazabilidadAsync("Catálogo", "Rubro", "Crear", rubro.Id, $"Rubro creado: {rubro.Nombre}");
        return Ok(rubro);
    }

    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, [FromBody] Mantenimiento_Rubro rubro)
    {
        if (id != rubro.Id) return BadRequest();
        _context.Entry(rubro).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "Rubro", "Actualizar", rubro.Id, $"Rubro actualizado: {rubro.Nombre}");
        return NoContent();
    }

    [HttpDelete("rubros/{id}")]
    public async Task<IActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.Mantenimiento_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "Rubro", "Eliminar", rubro.Id, $"Rubro eliminado: {rubro.Nombre}");
        return NoContent();
    }

    #endregion

    #region Proveedores

    [HttpGet("proveedores")]
    public async Task<ActionResult> GetProveedores([FromQuery] int? rubroId)
    {
        return Ok(await ProveedorRubroHelper.ListMantenimientoProveedoresAsync(_context, rubroId));
    }

    [HttpPost("proveedores")]
    public async Task<ActionResult> CreateProveedor([FromBody] ProveedorWriteDto dto)
    {
        var rubroIds = dto.ResolveRubroIds();
        var proveedor = new Mantenimiento_Proveedor
        {
            Nombre = dto.Nombre,
            Nit = dto.Nit,
            Telefono = dto.Telefono,
            Direccion = dto.Direccion,
            Correo = dto.Correo,
            RubroId = rubroIds.FirstOrDefault(),
            Activo = true
        };
        _context.Mantenimiento_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        await ProveedorRubroHelper.SyncMantenimientoAsync(_context, proveedor.Id, rubroIds);
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "Proveedor", "Crear", proveedor.Id, $"Proveedor creado: {proveedor.Nombre}");
        return Ok(proveedor);
    }

    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] ProveedorWriteDto dto)
    {
        var proveedor = await _context.Mantenimiento_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        var rubroIds = dto.ResolveRubroIds();
        proveedor.Nombre = dto.Nombre;
        proveedor.Nit = dto.Nit;
        proveedor.Telefono = dto.Telefono;
        proveedor.Direccion = dto.Direccion;
        proveedor.Correo = dto.Correo;
        proveedor.RubroId = rubroIds.FirstOrDefault();
        await ProveedorRubroHelper.SyncMantenimientoAsync(_context, id, rubroIds);
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "Proveedor", "Actualizar", proveedor.Id, $"Proveedor actualizado: {proveedor.Nombre}");
        return NoContent();
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Mantenimiento_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "Proveedor", "Eliminar", proveedor.Id, $"Proveedor eliminado: {proveedor.Nombre}");
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
                g.PrecioBase,
                g.PrecioIva,
                Fecha = g.Fecha.ToString("yyyy-MM-ddTHH:mm:ss"),
                g.Nota,
                g.NumeroFactura,
                g.FacturaPdfUrl,
                FechaEntregaFactura = g.FechaEntregaFactura.HasValue ? g.FechaEntregaFactura.Value.ToString("yyyy-MM-ddTHH:mm:ss") : null,
                FechaVencimientoFactura = g.FechaVencimientoFactura.HasValue ? g.FechaVencimientoFactura.Value.ToString("yyyy-MM-ddTHH:mm:ss") : null,
                g.EsPendiente,
                g.EsSolicitudCredito,
                g.EsEfectivo,
                g.NumeroOP,
                g.Anio,
                g.Mes,
                Estado = g.Estado ?? "Montado",
                g.TipoHoraId,
                g.TipoRecargoId,
                g.CantidadHoras,
                g.UsuarioId,
                UsuarioNombre = g.Usuario != null ? g.Usuario.Nombre : "",
                g.CreadoPorId,
                CreadoPorNombre = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : ""
            })
            .ToListAsync();

        return Ok(new { gastos });
    }

    [HttpPost("gastos")]
    public async Task<IActionResult> CreateGasto(
        [FromBody] Mantenimiento_Gasto gasto,
        [FromQuery] int? autorizacionId = null)
    {
        var esLabor = GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(gasto.TipoHoraId, gasto.TipoRecargoId);

        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        int adminId = 0;
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int parsedAdminId))
        {
            adminId = parsedAdminId;
            gasto.CreadoPorId = parsedAdminId;
        }
        if (adminId <= 0 && !esLabor)
            return BadRequest(new { message = "No se pudo identificar al usuario." });
        try
        {
            await _gastoAutorizacion.ExigirAutorizacionParaGastoNormalAsync(
                "mantenimiento", autorizacionId, adminId, esLabor);
        }
        catch (InvalidOperationException exAuth)
        {
            return BadRequest(new { message = exAuth.Message });
        }

        var mp = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esLabor, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mp != null) return mp;
        var fechasCredito = ValidarFechasCredito(gasto, esLabor);
        if (fechasCredito != null) return fechasCredito;

        var rubroM = await _context.Mantenimiento_Rubros.FindAsync(gasto.RubroId);
        var pM = gasto.Precio;
        var pbM = gasto.PrecioBase;
        var piM = gasto.PrecioIva;
        var errIvM = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, gasto.TipoHoraId, gasto.TipoRecargoId, rubroM?.Nombre, ref pM, ref pbM, ref piM);
        if (errIvM != null) return errIvM;
        gasto.Precio = pM;
        gasto.PrecioBase = pbM;
        gasto.PrecioIva = piM;

        gasto.Anio = gasto.Fecha.Year;
        gasto.Mes = gasto.Fecha.Month;
        gasto.Activo = true;

        if (GastoOvertimeDuplicateHelper.IsOvertimeLabor(gasto.TipoHoraId, gasto.TipoRecargoId))
        {
            if (await GastoOvertimeDuplicateHelper.ExistsMantenimientoDuplicateAsync(_context, gasto))
                return BadRequest(new { message = GastoOvertimeDuplicateHelper.DuplicateMessage });
        }

        _context.Mantenimiento_Gastos.Add(gasto);
        await _context.SaveChangesAsync();
        if (autorizacionId.HasValue && autorizacionId.Value > 0)
            await _gastoAutorizacion.VincularGastoRegistradoAsync(autorizacionId.Value, gasto.Id);
        await MantenimientoInventarioHelper.AplicarMovimientoNuevoAsync(_context, gasto);
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Gastos", "Gasto", "Crear", gasto.Id,
            $"Gasto registrado · ${gasto.Precio:N0} · {gasto.Fecha:yyyy-MM-dd}",
            new { gasto.RubroId, gasto.ProveedorId, gasto.ProductoId, gasto.Precio });
        return Ok(gasto);
    }

    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, [FromBody] Mantenimiento_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        var gastoAnterior = await _context.Mantenimiento_Gastos.AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == id);
        if (gastoAnterior == null) return NotFound();

        var esLabor = GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(gasto.TipoHoraId, gasto.TipoRecargoId);
        var mp = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esLabor, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mp != null) return mp;
        var fechasCredito = ValidarFechasCredito(gasto, esLabor);
        if (fechasCredito != null) return fechasCredito;

        var rubroMu = await _context.Mantenimiento_Rubros.FindAsync(gasto.RubroId);
        var pMu = gasto.Precio;
        var pbMu = gasto.PrecioBase;
        var piMu = gasto.PrecioIva;
        var errIvMu = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, gasto.TipoHoraId, gasto.TipoRecargoId, rubroMu?.Nombre, ref pMu, ref pbMu, ref piMu);
        if (errIvMu != null) return errIvMu;
        gasto.Precio = pMu;
        gasto.PrecioBase = pbMu;
        gasto.PrecioIva = piMu;

        gasto.Anio = gasto.Fecha.Year;
        gasto.Mes = gasto.Fecha.Month;
        gasto.Activo = true;

        await MantenimientoInventarioHelper.SincronizarEdicionAsync(_context, gastoAnterior, gasto);

        _context.Entry(gasto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Gastos", "Gasto", "Actualizar", gasto.Id,
            $"Gasto actualizado · ${gasto.Precio:N0} · {gasto.Fecha:yyyy-MM-dd}",
            new { gasto.RubroId, gasto.ProveedorId, gasto.ProductoId, gasto.Precio });
        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.Mantenimiento_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();

        await MantenimientoInventarioHelper.RevertirMovimientoAsync(_context, gasto);
        gasto.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Gastos", "Gasto", "Eliminar", gasto.Id,
            $"Gasto eliminado · ${gasto.Precio:N0} · {gasto.Fecha:yyyy-MM-dd}");
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
        await RegistrarTrazabilidadAsync("Gastos", "Presupuesto", "Actualizar", null,
            $"Presupuestos actualizados ({items.Count} rubro(s)/mes)");
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
        await RegistrarTrazabilidadAsync("Gastos", "Cotizacion", "Crear", cotizacion.Id,
            $"Cotización creada · ${cotizacion.PrecioCotizado:N0} · {cotizacion.Mes}/{cotizacion.Anio}");
        return Ok(cotizacion);
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, [FromBody] Mantenimiento_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Gastos", "Cotizacion", "Actualizar", cotizacion.Id,
            $"Cotización actualizada · ${cotizacion.PrecioCotizado:N0}");
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cot = await _context.Mantenimiento_Cotizaciones.FindAsync(id);
        if (cot == null) return NotFound();
        cot.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Gastos", "Cotizacion", "Eliminar", cot.Id,
            $"Cotización eliminada · ${cot.PrecioCotizado:N0}");
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
                p.TipoProducto,
                p.Stock,
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
        await RegistrarTrazabilidadAsync("Inventario", "Producto", "Crear", producto.Id,
            $"Producto creado: {producto.Nombre}");
        return Ok(producto);
    }

    [HttpPut("productos/{id}")]
    public async Task<IActionResult> UpdateProducto(int id, [FromBody] MantenimientoProductoPutDto incoming)
    {
        if (id != incoming.Id) return BadRequest();

        var existing = await _context.Mantenimiento_Productos.FindAsync(id);
        if (existing == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(incoming.Nombre))
            existing.Nombre = incoming.Nombre.Trim();

        if (incoming.RubroId.HasValue && incoming.RubroId.Value > 0)
            existing.RubroId = incoming.RubroId.Value;

        if (incoming.Referencia != null)
            existing.Referencia = incoming.Referencia;
        if (incoming.Descripcion != null)
            existing.Descripcion = incoming.Descripcion;

        if (!string.IsNullOrWhiteSpace(incoming.Medida))
            existing.Medida = incoming.Medida;

        if (!string.IsNullOrWhiteSpace(incoming.TipoProducto))
            existing.TipoProducto = incoming.TipoProducto;

        if (incoming.PuntoReorden.HasValue)
            existing.PuntoReorden = incoming.PuntoReorden.Value;
        if (incoming.MaxStock.HasValue)
            existing.MaxStock = incoming.MaxStock.Value;
        if (incoming.Activo.HasValue)
            existing.Activo = incoming.Activo.Value;

        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Inventario", "Producto", "Actualizar", existing.Id,
            $"Producto actualizado: {existing.Nombre}", new { existing.Stock, existing.PuntoReorden });
        return Ok(existing);
    }

    [HttpPatch("productos/{id}/punto-reorden")]
    public async Task<IActionResult> PatchPuntoReorden(int id, [FromBody] PuntoReordenPatchDto dto)
    {
        var existing = await _context.Mantenimiento_Productos.FindAsync(id);
        if (existing == null) return NotFound();

        existing.PuntoReorden = dto.PuntoReorden;
        if (dto.MaxStock.HasValue)
            existing.MaxStock = dto.MaxStock.Value;

        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Inventario", "Producto", "Actualizar", existing.Id,
            $"Punto de reorden actualizado: {existing.Nombre} → {existing.PuntoReorden}",
            new { existing.PuntoReorden, existing.MaxStock });
        return Ok(new
        {
            existing.Id,
            existing.PuntoReorden,
            existing.MaxStock,
            existing.Stock
        });
    }

    [HttpDelete("productos/{id}")]
    public async Task<IActionResult> DeleteProducto(int id)
    {
        var prod = await _context.Mantenimiento_Productos.FindAsync(id);
        if (prod == null) return NotFound();
        prod.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Inventario", "Producto", "Eliminar", prod.Id,
            $"Producto eliminado: {prod.Nombre}");
        return NoContent();
    }

    #endregion

    #region Inventario

    [HttpGet("inventario")]
    public async Task<ActionResult> GetInventario()
    {
        var productos = await _context.Mantenimiento_Productos
            .Include(p => p.Rubro)
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .ToListAsync();

        var items = productos.Select(p =>
        {
            var stock = (int)Math.Floor(p.Stock);
            var maxVisual = MantenimientoInventarioHelper.CalcularMaxStockVisual(p.Stock, p.PuntoReorden, p.MaxStock);
            return new
            {
                id = p.Id.ToString(),
                codigo = !string.IsNullOrWhiteSpace(p.Referencia) ? p.Referencia : $"P-{p.Id:D4}",
                nombre = p.Nombre,
                descripcion = p.Descripcion ?? p.Nombre,
                referencia = p.Referencia ?? "",
                medida = p.Medida ?? "",
                categoria = !string.IsNullOrWhiteSpace(p.TipoProducto)
                    ? p.TipoProducto
                    : (p.Rubro != null ? p.Rubro.Nombre : "General"),
                stock,
                stockDecimal = p.Stock,
                puntoReorden = p.PuntoReorden,
                maxStock = maxVisual,
                rubroId = p.RubroId,
                tipoProducto = p.TipoProducto
            };
        }).ToList();

        return Ok(items);
    }

    [HttpPost("inventario/recalcular")]
    public async Task<ActionResult> RecalcularInventarioDesdeGastos()
    {
        var actualizados = await MantenimientoInventarioHelper.RecalcularStockDesdeGastosAsync(_context);
        await RegistrarTrazabilidadAsync("Inventario", "Inventario", "Recalcular", null,
            $"Inventario recalculado ({actualizados} producto(s) actualizados)");
        return Ok(new { actualizados, mensaje = "Inventario recalculado (entradas por gastos, salidas por consumos y ajustes manuales)." });
    }

    /// <summary>Entrada o salida manual de stock; requiere motivo.</summary>
    [HttpPost("inventario/ajuste")]
    public async Task<ActionResult> RegistrarAjusteInventario([FromBody] AjusteInventarioRequest dto)
    {
        if (dto.ProductoId <= 0)
            return BadRequest(new { mensaje = "Producto inválido." });

        var tipo = (dto.Tipo ?? "").Trim().ToUpperInvariant();
        if (tipo != "ENTRADA" && tipo != "SALIDA")
            return BadRequest(new { mensaje = "Tipo debe ser ENTRADA o SALIDA." });

        if (dto.Cantidad <= 0)
            return BadRequest(new { mensaje = "La cantidad debe ser mayor a cero." });

        var razon = (dto.Razon ?? "").Trim();
        if (razon.Length < 5)
            return BadRequest(new { mensaje = "Indique el motivo del ajuste (mínimo 5 caracteres)." });

        var producto = await _context.Mantenimiento_Productos
            .FirstOrDefaultAsync(p => p.Id == dto.ProductoId && p.Activo);
        if (producto == null)
            return NotFound(new { mensaje = "Producto no encontrado." });

        if (tipo == "SALIDA" && producto.Stock < dto.Cantidad)
        {
            return BadRequest(new
            {
                mensaje = $"Stock insuficiente. Disponible: {producto.Stock}, solicitado: {dto.Cantidad}."
            });
        }

        var ajuste = new Mantenimiento_AjusteInventario
        {
            ProductoId = dto.ProductoId,
            Tipo = tipo,
            Cantidad = dto.Cantidad,
            Razon = razon,
            Fecha = dto.Fecha?.Date ?? DateTime.Today,
            Activo = true
        };

        _context.Mantenimiento_AjustesInventario.Add(ajuste);
        await MantenimientoInventarioHelper.AplicarAjusteNuevoAsync(_context, ajuste);
        await _context.SaveChangesAsync();

        await _context.Entry(producto).ReloadAsync();

        await RegistrarTrazabilidadAsync("Inventario", "AjusteInventario", "Ajuste", ajuste.Id,
            $"{tipo} {dto.Cantidad} de {producto.Nombre}: {razon}",
            new { ajuste.Tipo, ajuste.Cantidad, producto.Stock });

        return Ok(new
        {
            ajuste.Id,
            ajuste.ProductoId,
            ajuste.Tipo,
            ajuste.Cantidad,
            ajuste.Razon,
            ajuste.Fecha,
            stockActual = producto.Stock,
            mensaje = tipo == "ENTRADA"
                ? "Entrada manual registrada."
                : "Salida manual registrada."
        });
    }

    [HttpGet("productos/{productoId}/movimientos")]
    public async Task<ActionResult> GetMovimientosProducto(int productoId)
    {
        var producto = await _context.Mantenimiento_Productos
            .Include(p => p.Rubro)
            .FirstOrDefaultAsync(p => p.Id == productoId && p.Activo);
        if (producto == null) return NotFound();

        var gastos = await _context.Mantenimiento_Gastos
            .Include(g => g.Rubro)
            .Include(g => g.Proveedor)
            .Include(g => g.Maquina)
            .Where(g => g.ProductoId == productoId && g.Cantidad != null && g.Cantidad != 0)
            .OrderByDescending(g => g.Fecha)
            .ThenByDescending(g => g.Id)
            .ToListAsync();

        var consumos = await _context.Mantenimiento_Consumos
            .Include(c => c.Maquina)
            .Include(c => c.HojaVida)
            .Include(c => c.MantenimientoRegistro)
            .Where(c => c.ProductoId == productoId)
            .OrderByDescending(c => c.Fecha)
            .ThenByDescending(c => c.Id)
            .ToListAsync();

        var ajustes = await _context.Mantenimiento_AjustesInventario
            .Where(a => a.ProductoId == productoId)
            .OrderByDescending(a => a.Fecha)
            .ThenByDescending(a => a.Id)
            .ToListAsync();

        var filas = new List<(DateTime Fecha, string Origen, int Orden, object Item)>();

        foreach (var g in gastos)
        {
            filas.Add((g.Fecha, "GASTO", g.Id, new
            {
                clave = $"gasto-{g.Id}",
                origen = "GASTO",
                tipo = "ENTRADA",
                etiqueta = g.Activo ? "Entrada por compra (gasto)" : "Entrada anulada (gasto inactivo)",
                fecha = g.Fecha,
                cantidad = g.Cantidad,
                signo = "+",
                afectaStock = g.Activo,
                g.Id,
                detalle = new
                {
                    rubro = g.Rubro?.Nombre,
                    proveedor = g.Proveedor?.Nombre ?? "Empresa",
                    g.NumeroFactura,
                    g.FacturaPdfUrl,
                    maquina = g.Maquina?.Nombre ?? g.OtraMaquinaNombre,
                    g.Precio,
                    g.PrecioBase,
                    g.PrecioIva,
                    g.Nota,
                    g.NumeroOP,
                    g.EsPendiente,
                    g.EsSolicitudCredito,
                    g.EsEfectivo,
                    estadoGasto = g.Estado,
                    g.Anio,
                    g.Mes
                }
            }));
        }

        var bitacoraIds = consumos.Where(c => c.BitacoraId.HasValue).Select(c => c.BitacoraId!.Value).Distinct().ToList();
        var bitacorasMap = await _context.BitacorasMaquinas
            .Where(b => bitacoraIds.Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b);

        var actIdsAll = consumos
            .SelectMany(c => MantenimientoMaquinaContextoHelper.DeserializarActividadesIds(c.ActividadesIds))
            .Distinct()
            .ToList();
        var actMap = await _context.CronogramaActividades
            .Where(a => actIdsAll.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.Operacion);

        foreach (var c in consumos)
        {
            bitacorasMap.TryGetValue(c.BitacoraId ?? 0, out var ticket);
            var nombresAct = MantenimientoMaquinaContextoHelper.DeserializarActividadesIds(c.ActividadesIds)
                .Where(id => actMap.ContainsKey(id))
                .Select(id => actMap[id])
                .ToList();

            filas.Add((c.Fecha, "CONSUMO", c.Id, new
            {
                clave = $"consumo-{c.Id}",
                origen = "CONSUMO",
                tipo = "SALIDA",
                etiqueta = c.Activo ? "Salida por consumo" : "Consumo anulado",
                fecha = c.Fecha,
                cantidad = c.Cantidad,
                signo = "-",
                afectaStock = c.Activo,
                c.Id,
                detalle = new
                {
                    maquina = c.HojaVida?.Nombre ?? c.Maquina?.Nombre,
                    mantenimiento = c.MantenimientoRegistro != null
                        ? $"Mant. #{c.MantenimientoRegistro.Consecutivo} · {c.MantenimientoRegistro.TipoMantenimiento}"
                        : null,
                    tipoMantenimiento = c.TipoMantenimiento,
                    ticket = ticket == null ? null : $"#{ticket.Consecutivo} — {ticket.Descripcion}",
                    actividades = nombresAct,
                    c.Responsable,
                    c.Nota,
                    c.Anio,
                    c.Mes
                }
            }));
        }

        foreach (var a in ajustes)
        {
            var esEntrada = a.Tipo == "ENTRADA";
            filas.Add((a.Fecha, "AJUSTE", a.Id, new
            {
                clave = $"ajuste-{a.Id}",
                origen = "AJUSTE",
                tipo = esEntrada ? "ENTRADA" : "SALIDA",
                etiqueta = esEntrada ? "Entrada manual" : "Salida manual",
                fecha = a.Fecha,
                cantidad = a.Cantidad,
                signo = esEntrada ? "+" : "-",
                afectaStock = a.Activo,
                a.Id,
                detalle = new { razon = a.Razon }
            }));
        }

        decimal saldo = 0;
        var lista = new List<object>();
        foreach (var fila in filas.OrderBy(f => f.Fecha).ThenBy(f => f.Origen).ThenBy(f => f.Orden))
        {
            dynamic m = fila.Item;
            var delta = m.afectaStock
                ? (m.tipo == "ENTRADA" ? (decimal)m.cantidad : -(decimal)m.cantidad)
                : 0m;
            saldo += delta;
            lista.Add(new
            {
                m.clave,
                m.origen,
                m.tipo,
                m.etiqueta,
                m.fecha,
                m.cantidad,
                m.signo,
                m.afectaStock,
                m.Id,
                m.detalle,
                saldoDespues = saldo
            });
        }

        lista.Reverse();

        var entradasActivas = gastos.Where(g => g.Activo).Sum(g => g.Cantidad ?? 0);
        var salidasActivas = consumos.Where(c => c.Activo).Sum(c => c.Cantidad);
        var entradasAjuste = ajustes.Where(a => a.Activo && a.Tipo == "ENTRADA").Sum(a => a.Cantidad);
        var salidasAjuste = ajustes.Where(a => a.Activo && a.Tipo == "SALIDA").Sum(a => a.Cantidad);

        return Ok(new
        {
            producto = new
            {
                producto.Id,
                codigo = !string.IsNullOrWhiteSpace(producto.Referencia) ? producto.Referencia : $"P-{producto.Id:D4}",
                producto.Nombre,
                producto.Medida,
                producto.Stock,
                producto.PuntoReorden,
                categoria = !string.IsNullOrWhiteSpace(producto.TipoProducto)
                    ? producto.TipoProducto
                    : producto.Rubro?.Nombre
            },
            resumen = new
            {
                totalEntradas = entradasActivas + entradasAjuste,
                totalSalidas = salidasActivas + salidasAjuste,
                entradasGastos = entradasActivas,
                salidasConsumos = salidasActivas,
                entradasAjuste,
                salidasAjuste,
                stockActual = producto.Stock,
                movimientosRegistrados = lista.Count
            },
            movimientos = lista
        });
    }

    #endregion

    #region Consumos inventario

    /// <summary>Misma lista que el módulo Maquinaria (Hoja de Vida), para selector de consumos.</summary>
    [HttpGet("hojas-vida")]
    public async Task<ActionResult> GetHojasVidaParaConsumo()
    {
        var list = await _context.HojasVidaMaquinas
            .Where(h => h.Activo)
            .OrderBy(h => h.Nombre)
            .Select(h => new { h.Id, h.Nombre, h.NumeroInventario, h.Marca })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("hojas-vida/{hojaVidaId}/contexto-consumo")]
    public async Task<ActionResult> GetContextoConsumoHojaVida(int hojaVidaId)
    {
        var hojaVida = await _context.HojasVidaMaquinas.FirstOrDefaultAsync(h => h.Id == hojaVidaId && h.Activo);
        if (hojaVida == null) return NotFound(new { mensaje = "Máquina no encontrada en Maquinaria." });
        return Ok(await ConstruirContextoConsumoAsync(hojaVida));
    }

    /// <summary>Compatibilidad con registros antiguos que usaban MaquinaId de producción.</summary>
    [HttpGet("maquinas/{maquinaId}/contexto-consumo")]
    public async Task<ActionResult> GetContextoConsumoMaquina(int maquinaId)
    {
        var maquina = await _context.Maquinas.FindAsync(maquinaId);
        if (maquina == null) return NotFound(new { mensaje = "Máquina no encontrada." });

        var hojaVida = await MantenimientoMaquinaContextoHelper.ResolverHojaVidaPorMaquinaAsync(_context, maquinaId);
        var ctx = await ConstruirContextoConsumoAsync(hojaVida);
        return Ok(new
        {
            maquina = new { maquina.Id, maquina.Nombre },
            ctx.hojaVida,
            ctx.tiposMantenimiento,
            ctx.mantenimientos
        });
    }

    private sealed class ContextoConsumoPayload
    {
        public object? hojaVida { get; init; }
        public string[] tiposMantenimiento { get; init; } = [];
        public List<MantenimientoConsumoRefDto> mantenimientos { get; init; } = [];
    }

    private async Task<ContextoConsumoPayload> ConstruirContextoConsumoAsync(HojaVidaMaquina? hojaVida)
    {
        var mantenimientos = new List<MantenimientoConsumoRefDto>();
        if (hojaVida != null)
        {
            var registros = await _context.MantenimientosHojaVida
                .Where(m => m.HojaVidaId == hojaVida.Id)
                .OrderByDescending(m => m.Fecha)
                .ThenByDescending(m => m.Id)
                .Take(80)
                .ToListAsync();

            var ticketIds = registros
                .Where(m => m.TicketId.HasValue && m.TicketId > 0)
                .Select(m => m.TicketId!.Value)
                .Distinct()
                .ToList();

            var ticketsMap = ticketIds.Count == 0
                ? new Dictionary<int, int>()
                : await _context.BitacorasMaquinas
                    .Where(b => ticketIds.Contains(b.Id))
                    .ToDictionaryAsync(b => b.Id, b => b.Consecutivo);

            mantenimientos = registros.Select(m =>
            {
                int? ticketConsec = null;
                if (m.TicketId.HasValue && ticketsMap.TryGetValue(m.TicketId.Value, out var c))
                    ticketConsec = c;

                var fechaTxt = m.Fecha.ToString("dd/MM/yyyy");
                var ticketTxt = ticketConsec.HasValue ? $" · Ticket #{ticketConsec}" : "";
                var obs = (m.Observacion ?? "").Replace("\n", " ").Trim();
                if (obs.Length > 90) obs = obs[..90] + "…";

                return new MantenimientoConsumoRefDto
                {
                    Id = m.Id,
                    Consecutivo = m.Consecutivo,
                    TicketId = m.TicketId,
                    TicketConsecutivo = ticketConsec,
                    Fecha = m.Fecha,
                    TipoMantenimiento = m.TipoMantenimiento,
                    Observacion = m.Observacion,
                    EjecutadoPor = m.EjecutadoPor,
                    Etiqueta = $"Mant. #{m.Consecutivo} · {m.TipoMantenimiento}{ticketTxt} · {fechaTxt}"
                };
            }).ToList();
        }

        return new ContextoConsumoPayload
        {
            hojaVida = hojaVida == null
                ? null
                : new { hojaVida.Id, hojaVida.Nombre, hojaVida.NumeroInventario },
            tiposMantenimiento = MantenimientoMaquinaContextoHelper.TiposMantenimiento,
            mantenimientos = mantenimientos
        };
    }

    [HttpGet("consumos")]
    public async Task<ActionResult> GetConsumos([FromQuery] int? anio, [FromQuery] int? mes, [FromQuery] int? productoId)
    {
        var query = _context.Mantenimiento_Consumos
            .Include(c => c.Producto)
            .ThenInclude(p => p!.Rubro)
            .Include(c => c.Maquina)
            .Include(c => c.HojaVida)
            .Include(c => c.MantenimientoRegistro)
            .Where(c => c.Activo);

        if (anio.HasValue) query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue && mes.Value > 0) query = query.Where(c => c.Mes == mes.Value);
        if (productoId.HasValue) query = query.Where(c => c.ProductoId == productoId.Value);

        var items = await query
            .OrderByDescending(c => c.Fecha)
            .ThenByDescending(c => c.Id)
            .Select(c => new
            {
                c.Id,
                c.ProductoId,
                productoNombre = c.Producto != null ? c.Producto.Nombre : "",
                codigo = c.Producto != null && !string.IsNullOrWhiteSpace(c.Producto.Referencia)
                    ? c.Producto.Referencia
                    : (c.Producto != null ? $"P-{c.Producto.Id:D4}" : ""),
                medida = c.Producto != null ? c.Producto.Medida : "",
                c.Cantidad,
                c.Fecha,
                c.MaquinaId,
                c.HojaVidaId,
                maquinaNombre = c.HojaVida != null
                    ? c.HojaVida.Nombre
                    : (c.Maquina != null ? c.Maquina.Nombre : null),
                c.TipoMantenimiento,
                c.MantenimientoHojaVidaId,
                mantenimientoConsecutivo = c.MantenimientoRegistro != null ? c.MantenimientoRegistro.Consecutivo : (int?)null,
                c.BitacoraId,
                c.ActividadesIds,
                actividadIds = MantenimientoMaquinaContextoHelper.DeserializarActividadesIds(c.ActividadesIds),
                c.Responsable,
                c.Nota,
                c.Anio,
                c.Mes,
                stockActual = c.Producto != null ? c.Producto.Stock : 0m
            })
            .ToListAsync();

        return Ok(items);
    }

    /// <summary>Consumos vinculados a mantenimientos de Maquinaria, con valor calculado desde gastos de inventario.</summary>
    [HttpGet("consumos-resumen")]
    public async Task<ActionResult> GetConsumosResumen(
        [FromQuery] int? hojaVidaId,
        [FromQuery] int? mantenimientoHojaVidaId)
    {
        if (mantenimientoHojaVidaId.HasValue)
        {
            var mapa = await ConstruirConsumosResumenAsync(mantenimientoHojaVidaId, hojaVidaId);
            if (mapa.TryGetValue(mantenimientoHojaVidaId.Value, out var single))
                return Ok(single);

            return Ok(new MantenimientoConsumosResumenDto
            {
                MantenimientoHojaVidaId = mantenimientoHojaVidaId.Value
            });
        }

        var resultado = await ConstruirConsumosResumenAsync(null, hojaVidaId);
        return Ok(resultado);
    }

    private async Task<Dictionary<int, MantenimientoConsumosResumenDto>> ConstruirConsumosResumenAsync(
        int? mantenimientoHojaVidaId,
        int? hojaVidaId)
    {
        var query = _context.Mantenimiento_Consumos
            .Include(c => c.Producto!)
            .ThenInclude(p => p.Rubro)
            .Include(c => c.MantenimientoRegistro)
            .Where(c => c.Activo && c.MantenimientoHojaVidaId.HasValue);

        if (mantenimientoHojaVidaId.HasValue)
            query = query.Where(c => c.MantenimientoHojaVidaId == mantenimientoHojaVidaId.Value);
        if (hojaVidaId.HasValue)
            query = query.Where(c => c.HojaVidaId == hojaVidaId.Value);

        var consumos = await query
            .OrderBy(c => c.MantenimientoHojaVidaId)
            .ThenBy(c => c.Id)
            .ToListAsync();

        if (consumos.Count == 0)
            return new Dictionary<int, MantenimientoConsumosResumenDto>();

        var precios = await MantenimientoConsumoPrecioHelper.ObtenerPreciosUnitariosAsync(
            _context,
            consumos.Select(c => c.ProductoId));

        var resultado = new Dictionary<int, MantenimientoConsumosResumenDto>();

        foreach (var grupo in consumos.GroupBy(c => c.MantenimientoHojaVidaId!.Value))
        {
            var equipos = new List<string>();
            var materiales = new List<string>();
            var repuestos = new List<string>();
            var items = new List<MantenimientoConsumoDetalleDto>();
            decimal valorTotal = 0;

            foreach (var c in grupo)
            {
                var producto = c.Producto;
                var codigo = producto != null && !string.IsNullOrWhiteSpace(producto.Referencia)
                    ? producto.Referencia
                    : $"P-{c.ProductoId:D4}";
                var nombre = producto?.Nombre ?? "";
                var medida = producto?.Medida;
                precios.TryGetValue(c.ProductoId, out var precioUnitario);
                var subtotal = Math.Round(precioUnitario * c.Cantidad, 2);
                valorTotal += subtotal;

                var categoria = MantenimientoConsumoPrecioHelper.ClasificarRecurso(producto);
                var linea = MantenimientoConsumoPrecioHelper.FormatearLineaRecurso(codigo, nombre, c.Cantidad, medida);

                switch (categoria)
                {
                    case "equipos": equipos.Add(linea); break;
                    case "repuestos": repuestos.Add(linea); break;
                    default: materiales.Add(linea); break;
                }

                items.Add(new MantenimientoConsumoDetalleDto
                {
                    Id = c.Id,
                    ProductoId = c.ProductoId,
                    Codigo = codigo,
                    ProductoNombre = nombre,
                    TipoProducto = producto?.TipoProducto,
                    RubroNombre = producto?.Rubro?.Nombre,
                    CategoriaRecurso = categoria,
                    Cantidad = c.Cantidad,
                    Medida = medida,
                    PrecioUnitario = precioUnitario,
                    Subtotal = subtotal
                });
            }

            resultado[grupo.Key] = new MantenimientoConsumosResumenDto
            {
                MantenimientoHojaVidaId = grupo.Key,
                MantenimientoConsecutivo = grupo.First().MantenimientoRegistro?.Consecutivo,
                Items = items,
                ValorTotal = Math.Round(valorTotal, 2),
                EquiposTexto = string.Join("\n", equipos),
                MaterialesTexto = string.Join("\n", materiales),
                RepuestosTexto = string.Join("\n", repuestos)
            };
        }

        return resultado;
    }

    [HttpPost("consumos")]
    public async Task<IActionResult> CreateConsumo([FromBody] MantenimientoConsumoWriteDto dto)
    {
        if (dto.ProductoId <= 0)
            return BadRequest(new { mensaje = "Seleccione un producto del inventario." });
        if (dto.Cantidad <= 0)
            return BadRequest(new { mensaje = "La cantidad debe ser mayor a cero." });

        var producto = await _context.Mantenimiento_Productos
            .FirstOrDefaultAsync(p => p.Id == dto.ProductoId && p.Activo);
        if (producto == null)
            return NotFound(new { mensaje = "Producto no encontrado." });

        if (producto.Stock < dto.Cantidad)
            return BadRequest(new { mensaje = $"Stock insuficiente. Disponible: {producto.Stock:0.##}" });

        var validacionMaquina = await ValidarConsumoMaquinaAsync(dto);
        if (validacionMaquina != null) return validacionMaquina;

        var fecha = dto.Fecha.Date;
        var consumo = new Mantenimiento_Consumo
        {
            ProductoId = dto.ProductoId,
            Cantidad = dto.Cantidad,
            Fecha = fecha,
            Responsable = string.IsNullOrWhiteSpace(dto.Responsable) ? null : dto.Responsable.Trim(),
            Nota = string.IsNullOrWhiteSpace(dto.Nota) ? null : dto.Nota.Trim(),
            Activo = true,
            Anio = fecha.Year,
            Mes = fecha.Month
        };
        await MantenimientoMaquinaContextoHelper.AplicarCamposConsumoAsync(_context, consumo, dto);

        _context.Mantenimiento_Consumos.Add(consumo);
        await _context.SaveChangesAsync();
        await MantenimientoInventarioHelper.AplicarConsumoNuevoAsync(_context, consumo);
        await _context.SaveChangesAsync();

        await RegistrarTrazabilidadAsync("Consumos", "Consumo", "Crear", consumo.Id,
            $"Consumo {consumo.Cantidad} de {producto.Nombre}",
            new { consumo.ProductoId, consumo.Cantidad, consumo.HojaVidaId, consumo.Responsable });

        return Ok(new { consumo.Id, mensaje = "Consumo registrado.", stockRestante = producto.Stock });
    }

    [HttpPost("consumos/lote")]
    public async Task<IActionResult> CreateConsumoLote([FromBody] MantenimientoConsumoLoteDto dto)
    {
        if (dto.Lineas == null || dto.Lineas.Count == 0)
            return BadRequest(new { mensaje = "Agregue al menos un producto con cantidad." });

        foreach (var linea in dto.Lineas)
        {
            if (linea.ProductoId <= 0 || linea.Cantidad <= 0)
                return BadRequest(new { mensaje = "Cada línea debe tener producto y cantidad válidos." });
        }

        var baseDto = new MantenimientoConsumoWriteDto
        {
            Fecha = dto.Fecha,
            MaquinaId = dto.MaquinaId,
            HojaVidaId = dto.HojaVidaId,
            MantenimientoHojaVidaId = dto.MantenimientoHojaVidaId,
            TipoMantenimiento = dto.TipoMantenimiento,
            BitacoraId = dto.BitacoraId,
            Responsable = dto.Responsable,
            Nota = dto.Nota,
            ProductoId = dto.Lineas[0].ProductoId,
            Cantidad = dto.Lineas[0].Cantidad
        };
        var validacionMaquina = await ValidarConsumoMaquinaAsync(baseDto);
        if (validacionMaquina != null) return validacionMaquina;

        var demandaPorProducto = dto.Lineas
            .GroupBy(l => l.ProductoId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Cantidad));

        var productoIds = demandaPorProducto.Keys.ToList();
        var productos = await _context.Mantenimiento_Productos
            .Where(p => productoIds.Contains(p.Id) && p.Activo)
            .ToDictionaryAsync(p => p.Id);

        foreach (var (productoId, total) in demandaPorProducto)
        {
            if (!productos.TryGetValue(productoId, out var producto))
                return NotFound(new { mensaje = $"Producto #{productoId} no encontrado." });
            if (producto.Stock < total)
                return BadRequest(new
                {
                    mensaje = $"Stock insuficiente para {producto.Nombre}. Disponible: {producto.Stock:0.##}, solicitado: {total:0.##}"
                });
        }

        var fecha = dto.Fecha.Date;
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var ids = new List<int>();
            foreach (var linea in dto.Lineas)
            {
                var lineDto = new MantenimientoConsumoWriteDto
                {
                    ProductoId = linea.ProductoId,
                    Cantidad = linea.Cantidad,
                    Fecha = dto.Fecha,
                    MaquinaId = dto.MaquinaId,
                    HojaVidaId = dto.HojaVidaId,
                    MantenimientoHojaVidaId = dto.MantenimientoHojaVidaId,
                    TipoMantenimiento = baseDto.TipoMantenimiento,
                    BitacoraId = baseDto.BitacoraId,
                    Responsable = dto.Responsable,
                    Nota = dto.Nota
                };

                var consumo = new Mantenimiento_Consumo
                {
                    ProductoId = linea.ProductoId,
                    Cantidad = linea.Cantidad,
                    Fecha = fecha,
                    Responsable = string.IsNullOrWhiteSpace(dto.Responsable) ? null : dto.Responsable.Trim(),
                    Nota = string.IsNullOrWhiteSpace(dto.Nota) ? null : dto.Nota.Trim(),
                    Activo = true,
                    Anio = fecha.Year,
                    Mes = fecha.Month
                };
                await MantenimientoMaquinaContextoHelper.AplicarCamposConsumoAsync(_context, consumo, lineDto);
                _context.Mantenimiento_Consumos.Add(consumo);
                await _context.SaveChangesAsync();
                await MantenimientoInventarioHelper.AplicarConsumoNuevoAsync(_context, consumo);
                ids.Add(consumo.Id);
            }

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            await RegistrarTrazabilidadAsync("Consumos", "Consumo", "Crear", ids.FirstOrDefault(),
                $"Lote de {ids.Count} consumo(s) registrado(s)",
                new { ids, dto.HojaVidaId, dto.MantenimientoHojaVidaId });
            return Ok(new { ids, registrados = ids.Count, mensaje = $"{ids.Count} consumo(s) registrado(s)." });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    [HttpPut("consumos/{id}")]
    public async Task<IActionResult> UpdateConsumo(int id, [FromBody] MantenimientoConsumoWriteDto dto)
    {
        var existing = await _context.Mantenimiento_Consumos.FindAsync(id);
        if (existing == null || !existing.Activo) return NotFound();

        var anterior = new Mantenimiento_Consumo
        {
            ProductoId = existing.ProductoId,
            Cantidad = existing.Cantidad,
            Activo = existing.Activo
        };

        if (dto.ProductoId <= 0 || dto.Cantidad <= 0)
            return BadRequest(new { mensaje = "Producto y cantidad válidos son obligatorios." });

        var producto = await _context.Mantenimiento_Productos
            .FirstOrDefaultAsync(p => p.Id == dto.ProductoId && p.Activo);
        if (producto == null)
            return NotFound(new { mensaje = "Producto no encontrado." });

        var validacionMaquina = await ValidarConsumoMaquinaAsync(dto);
        if (validacionMaquina != null) return validacionMaquina;

        var fecha = dto.Fecha.Date;
        var actualizado = new Mantenimiento_Consumo
        {
            ProductoId = dto.ProductoId,
            Cantidad = dto.Cantidad,
            Activo = true
        };

        var productoTrasRevertir = await _context.Mantenimiento_Productos.FindAsync(dto.ProductoId);
        if (productoTrasRevertir != null)
        {
            var stockSimulado = productoTrasRevertir.Stock;
            if (anterior.ProductoId == dto.ProductoId)
                stockSimulado += anterior.Cantidad;
            if (stockSimulado < dto.Cantidad)
                return BadRequest(new { mensaje = $"Stock insuficiente. Disponible: {stockSimulado:0.##}" });
        }

        existing.ProductoId = dto.ProductoId;
        existing.Cantidad = dto.Cantidad;
        existing.Fecha = fecha;
        existing.Responsable = string.IsNullOrWhiteSpace(dto.Responsable) ? null : dto.Responsable.Trim();
        existing.Nota = string.IsNullOrWhiteSpace(dto.Nota) ? null : dto.Nota.Trim();
        existing.Anio = fecha.Year;
        existing.Mes = fecha.Month;
        await MantenimientoMaquinaContextoHelper.AplicarCamposConsumoAsync(_context, existing, dto);

        await MantenimientoInventarioHelper.SincronizarEdicionConsumoAsync(_context, anterior, actualizado);
        await _context.SaveChangesAsync();

        await RegistrarTrazabilidadAsync("Consumos", "Consumo", "Actualizar", existing.Id,
            $"Consumo actualizado: {existing.Cantidad} unidades (producto #{existing.ProductoId})");

        return Ok(new { existing.Id, mensaje = "Consumo actualizado." });
    }

    [HttpDelete("consumos/{id}")]
    public async Task<IActionResult> DeleteConsumo(int id)
    {
        var consumo = await _context.Mantenimiento_Consumos.FindAsync(id);
        if (consumo == null || !consumo.Activo) return NotFound();

        await MantenimientoInventarioHelper.RevertirConsumoAsync(_context, consumo);
        consumo.Activo = false;
        await _context.SaveChangesAsync();

        await RegistrarTrazabilidadAsync("Consumos", "Consumo", "Eliminar", consumo.Id,
            $"Consumo anulado: producto #{consumo.ProductoId} · {consumo.Cantidad} unidades");

        return Ok(new { mensaje = "Consumo anulado y stock restaurado." });
    }

    private async Task<IActionResult?> ValidarConsumoMaquinaAsync(MantenimientoConsumoWriteDto dto)
    {
        var tieneMaquina = (dto.HojaVidaId.HasValue && dto.HojaVidaId > 0)
            || (dto.MaquinaId.HasValue && dto.MaquinaId > 0);
        if (!tieneMaquina) return null;

        var hojaVida = await MantenimientoMaquinaContextoHelper.ResolverHojaVidaDesdeDtoAsync(_context, dto);
        if (hojaVida == null)
            return BadRequest(new { mensaje = "Máquina no encontrada en Maquinaria." });

        if (!dto.MantenimientoHojaVidaId.HasValue || dto.MantenimientoHojaVidaId <= 0)
            return BadRequest(new { mensaje = "Seleccione el mantenimiento al que cargar los materiales." });

        var mantenimiento = await _context.MantenimientosHojaVida
            .FirstOrDefaultAsync(m => m.Id == dto.MantenimientoHojaVidaId && m.HojaVidaId == hojaVida.Id);
        if (mantenimiento == null)
            return BadRequest(new { mensaje = "El mantenimiento seleccionado no corresponde a esta máquina." });

        if (string.IsNullOrWhiteSpace(dto.TipoMantenimiento))
            dto.TipoMantenimiento = mantenimiento.TipoMantenimiento;

        var tipo = dto.TipoMantenimiento.Trim();
        if (!MantenimientoMaquinaContextoHelper.TiposMantenimiento.Contains(tipo, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { mensaje = "Tipo de mantenimiento no válido." });

        if (!dto.BitacoraId.HasValue && mantenimiento.TicketId.HasValue && mantenimiento.TicketId > 0)
            dto.BitacoraId = mantenimiento.TicketId;

        return null;
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
        await RegistrarTrazabilidadAsync("Catálogo", "TipoHora", "Crear", item.Id, $"Tipo de hora creado: {item.Nombre}");
        return Ok(item);
    }

    [HttpPut("tiposhora/{id}")]
    public async Task<IActionResult> UpdateTipoHora(int id, [FromBody] Mantenimiento_TipoHora item)
    {
        if (id != item.Id) return BadRequest();
        _context.Entry(item).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "TipoHora", "Actualizar", item.Id, $"Tipo de hora actualizado: {item.Nombre}");
        return NoContent();
    }

    [HttpDelete("tiposhora/{id}")]
    public async Task<IActionResult> DeleteTipoHora(int id)
    {
        var item = await _context.Mantenimiento_TiposHora.FindAsync(id);
        if (item == null) return NotFound();
        item.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "TipoHora", "Eliminar", item.Id, $"Tipo de hora eliminado: {item.Nombre}");
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
        await RegistrarTrazabilidadAsync("Catálogo", "TipoRecargo", "Crear", item.Id, $"Tipo de recargo creado: {item.Nombre}");
        return Ok(item);
    }

    [HttpPut("tiposrecargo/{id}")]
    public async Task<IActionResult> UpdateTipoRecargo(int id, [FromBody] Mantenimiento_TipoRecargo item)
    {
        if (id != item.Id) return BadRequest();
        _context.Entry(item).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "TipoRecargo", "Actualizar", item.Id, $"Tipo de recargo actualizado: {item.Nombre}");
        return NoContent();
    }

    [HttpDelete("tiposrecargo/{id}")]
    public async Task<IActionResult> DeleteTipoRecargo(int id)
    {
        var item = await _context.Mantenimiento_TiposRecargo.FindAsync(id);
        if (item == null) return NotFound();
        item.Activo = false;
        await _context.SaveChangesAsync();
        await RegistrarTrazabilidadAsync("Catálogo", "TipoRecargo", "Eliminar", item.Id, $"Tipo de recargo eliminado: {item.Nombre}");
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
