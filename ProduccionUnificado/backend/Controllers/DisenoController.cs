using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.DTOs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for Diseño Budget and Expense Management.
/// Handles Rubros, Proveedores, Cotizaciones, Presupuestos, and Gastos.
/// hierarchy: Rubro -> Proveedor
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DisenoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public DisenoController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    #region Rubros

    [HttpGet("rubros")]
    public async Task<ActionResult<IEnumerable<Diseno_Rubro>>> GetRubros()
    {
        return await _context.Diseno_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
    }

    [HttpPost("rubros")]
    public async Task<ActionResult<Diseno_Rubro>> CreateRubro(Diseno_Rubro rubro)
    {
        _context.Diseno_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(new { id = rubro.Id });
    }

    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, Diseno_Rubro rubro)
    {
        if (id != rubro.Id) return BadRequest();
        _context.Entry(rubro).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("rubros/{id}")]
    public async Task<IActionResult> DeleteRubro(int id)
    {
        var rubro = await _context.Diseno_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Proveedores

    [HttpGet("proveedores")]
    public async Task<ActionResult<List<object>>> GetProveedores([FromQuery] int? rubroId)
    {
        return Ok(await ProveedorRubroHelper.ListDisenoProveedoresAsync(_context, rubroId));
    }

    [HttpPost("proveedores")]
    public async Task<ActionResult<Diseno_Proveedor>> CreateProveedor([FromBody] ProveedorWriteDto dto)
    {
        var nit = dto.NitCedula ?? dto.Nit;
        if (string.IsNullOrWhiteSpace(nit))
            return BadRequest("El NIT o Cédula es obligatorio");
        var rubroIds = dto.ResolveRubroIds();
        if (rubroIds.Count == 0)
            return BadRequest("Seleccione al menos un rubro");
        var proveedor = new Diseno_Proveedor
        {
            Nombre = dto.Nombre,
            NitCedula = nit,
            Telefono = dto.Telefono,
            RubroId = rubroIds[0],
            Activo = true
        };
        _context.Diseno_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        await ProveedorRubroHelper.SyncDisenoAsync(_context, proveedor.Id, rubroIds);
        await _context.SaveChangesAsync();
        return Ok(new { id = proveedor.Id });
    }

    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] ProveedorWriteDto dto)
    {
        var nit = dto.NitCedula ?? dto.Nit;
        if (string.IsNullOrWhiteSpace(nit))
            return BadRequest("El NIT o Cédula es obligatorio");
        var rubroIds = dto.ResolveRubroIds();
        if (rubroIds.Count == 0)
            return BadRequest("Seleccione al menos un rubro");
        var proveedor = await _context.Diseno_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Nombre = dto.Nombre;
        proveedor.NitCedula = nit;
        proveedor.Telefono = dto.Telefono;
        proveedor.RubroId = rubroIds[0];
        await ProveedorRubroHelper.SyncDisenoAsync(_context, id, rubroIds);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Diseno_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Gastos

    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int anio, int? mes)
    {
        var query = _context.Diseno_Gastos
            .Include(g => g.Proveedor)
            .Include(g => g.Rubro)
            .Include(g => g.CreadoPor)
            .Where(g => g.Anio == anio);

        if (mes.HasValue && mes.Value > 0)
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
                g.PrecioBase,
                g.PrecioIva,
                g.EsSolicitudCredito,
                g.EsEfectivo,
                g.Fecha,
                g.Observaciones,
                g.TipoTrabajo,
                g.OrdenProduccion,
                g.FacturaPdfUrl,
                g.EsPendiente,
                g.FechaCreacion,
                g.FechaModificacion,
                g.CreadoPorId,
                CreadoPorNombre = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "",
                Estado = g.Estado ?? "Montado"
            })
            .ToListAsync();

        return Ok(gastos);
    }

    [HttpGet("gastos/resumen")]
    public async Task<ActionResult<object>> GetGastosResumen([FromQuery] int anio, [FromQuery] int? mes)
    {
        var queryGastos = _context.Diseno_Gastos.Where(g => g.Anio == anio);
        if (mes.HasValue && mes.Value > 0) queryGastos = queryGastos.Where(g => g.Mes == mes.Value);
        var gastos = await queryGastos.ToListAsync();

        var queryPresupuestos = _context.Diseno_PresupuestosMensuales.Where(p => p.Anio == anio);
        if (mes.HasValue && mes.Value > 0) queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes.Value);
        var presupuestos = await queryPresupuestos.ToListAsync();

        var totalPresupuesto = presupuestos.Sum(p => p.Presupuesto);
        var totalGastado = gastos.Sum(g => g.Precio);

        var rubroIds = gastos.Select(g => g.RubroId)
            .Union(presupuestos.Select(p => p.RubroId))
            .Distinct()
            .ToList();

        var rubrosInfo = await _context.Diseno_Rubros
            .Where(t => rubroIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Nombre);

        var resumenPorRubro = rubroIds.Select(id => new
        {
            RubroId = id,
            RubroNombre = rubrosInfo.ContainsKey(id) ? rubrosInfo[id] : "Desconocido",
            Presupuesto = presupuestos.Where(p => p.RubroId == id).Sum(p => p.Presupuesto),
            Gastado = gastos.Where(g => g.RubroId == id).Sum(g => g.Precio),
            CantidadGastos = gastos.Count(g => g.RubroId == id)
        }).ToList();

        return Ok(new
        {
            Anio = anio,
            Mes = mes,
            TotalPresupuesto = totalPresupuesto,
            TotalGastado = totalGastado,
            TotalRestante = totalPresupuesto - totalGastado,
            ResumenPorRubro = resumenPorRubro
        });
    }

    [HttpPost("gastos")]
    public async Task<ActionResult<Diseno_Gasto>> CreateGasto(Diseno_Gasto gasto)
    {
        var mpD = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(false, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mpD != null) return (ActionResult<Diseno_Gasto>)(object)mpD;

        var rubroD = await _context.Diseno_Rubros.FindAsync(gasto.RubroId);
        var pD = gasto.Precio;
        var pbD = gasto.PrecioBase;
        var piD = gasto.PrecioIva;
        var errIvD = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, null, null, rubroD?.Nombre, ref pD, ref pbD, ref piD);
        if (errIvD != null) return (ActionResult<Diseno_Gasto>)(object)errIvD;
        gasto.Precio = pD;
        gasto.PrecioBase = pbD;
        gasto.PrecioIva = piD;

        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
            gasto.CreadoPorId = adminId;

        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        gasto.FechaCreacion = DateTime.UtcNow;
        _context.Diseno_Gastos.Add(gasto);
        await _context.SaveChangesAsync();
        return Ok(new { id = gasto.Id });
    }

    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Diseno_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest();

        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        var mpDu = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(false, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mpDu != null) return mpDu;

        var rubroDu = await _context.Diseno_Rubros.FindAsync(gasto.RubroId);
        var pDu = gasto.Precio;
        var pbDu = gasto.PrecioBase;
        var piDu = gasto.PrecioIva;
        var errIvDu = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, null, null, rubroDu?.Nombre, ref pDu, ref pbDu, ref piDu);
        if (errIvDu != null) return errIvDu;
        gasto.Precio = pDu;
        gasto.PrecioBase = pbDu;
        gasto.PrecioIva = piDu;

        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        var existingEntry = await _context.Diseno_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;

        gasto.FechaModificacion = DateTime.UtcNow;
        _context.Entry(gasto).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("gastos/{id}")]
    public async Task<IActionResult> DeleteGasto(int id)
    {
        var gasto = await _context.Diseno_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();
        _context.Diseno_Gastos.Remove(gasto);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("upload-factura")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult> UploadFactura([FromForm] DTOs.FileUploadDto dto)
    {
        var file = dto.File;
        if (file == null || file.Length == 0) return BadRequest("No file uploaded");
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "facturas");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);
        var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);
        using (var stream = new FileStream(filePath, FileMode.Create)) await file.CopyToAsync(stream);
        return Ok(new { url = $"/uploads/facturas/{uniqueFileName}" });
    }

    #endregion

    #region Cotizaciones

    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Diseno_Cotizaciones
            .Include(c => c.Proveedor)
            .Include(c => c.Rubro)
            .Where(c => c.Activo);

        if (proveedorId.HasValue) query = query.Where(c => c.ProveedorId == proveedorId.Value);
        if (anio.HasValue) query = query.Where(c => c.Anio == anio.Value);
        if (mes.HasValue) query = query.Where(c => c.Mes == mes.Value);

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
    public async Task<ActionResult<Diseno_Cotizacion>> CreateCotizacion([FromBody] Diseno_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.Diseno_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, Diseno_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.Diseno_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Presupuestos

    [HttpGet("presupuestos")]
    public async Task<ActionResult<List<object>>> GetPresupuestos([FromQuery] int anio)
    {
        var presupuestos = await _context.Diseno_PresupuestosMensuales
            .Include(p => p.Rubro)
            .Where(p => p.Anio == anio)
            .OrderBy(p => p.Rubro!.Nombre)
            .ThenBy(p => p.Mes)
            .Select(p => new
            {
                p.Id,
                p.RubroId,
                RubroNombre = p.Rubro!.Nombre,
                p.Anio,
                p.Mes,
                p.Presupuesto
            })
            .ToListAsync();

        return Ok(presupuestos);
    }

    [HttpGet("presupuestos/grid")]
    public async Task<ActionResult<object>> GetPresupuestosGrid([FromQuery] int anio)
    {
        var rubros = await _context.Diseno_Rubros
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync();

        var presupuestos = await _context.Diseno_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        var gridData = rubros.Select(rubro => new
        {
            TipoServicioId = rubro.Id, // compatibility
            TipoServicioNombre = rubro.Nombre,
            Meses = Enumerable.Range(1, 12).Select(mes =>
            {
                var presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == rubro.Id && p.Mes == mes);
                return new
                {
                    Mes = mes,
                    PresupuestoId = presupuesto?.Id,
                    Presupuesto = presupuesto?.Presupuesto ?? 0
                };
            }).ToList()
        }).ToList();

        var totalesMensuales = Enumerable.Range(1, 12).Select(mes =>
            presupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto)
        ).ToList();

        return Ok(new
        {
            Anio = anio,
            TiposServicio = gridData, // compatibility
            TotalesMensuales = totalesMensuales,
            TotalAnual = presupuestos.Sum(p => p.Presupuesto)
        });
    }

    [HttpPost("presupuestos")]
    public async Task<ActionResult<Diseno_PresupuestoMensual>> SetPresupuesto([FromBody] Diseno_PresupuestoMensual presupuesto)
    {
        var existing = await _context.Diseno_PresupuestosMensuales
            .FirstOrDefaultAsync(p => 
                p.RubroId == presupuesto.RubroId && 
                p.Anio == presupuesto.Anio && 
                p.Mes == presupuesto.Mes);

        if (existing != null) existing.Presupuesto = presupuesto.Presupuesto;
        else _context.Diseno_PresupuestosMensuales.Add(presupuesto);

        await _context.SaveChangesAsync();
        return Ok(presupuesto);
    }

    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<Diseno_PresupuestoMensual> presupuestos)
    {
        foreach (var p in presupuestos)
        {
            var existing = await _context.Diseno_PresupuestosMensuales
                .FirstOrDefaultAsync(x => x.RubroId == p.RubroId && x.Anio == p.Anio && x.Mes == p.Mes);

            if (existing != null) existing.Presupuesto = p.Presupuesto;
            else _context.Diseno_PresupuestosMensuales.Add(p);
        }
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Updated {presupuestos.Count} presupuestos" });
    }

    #endregion

    #region Graficas

    [HttpGet("graficas/{anio}/{mes}")]
    public async Task<ActionResult<object>> GetGraficas(int anio, int mes)
    {
        var rubros = await _context.Diseno_Rubros.Where(t => t.Activo).ToListAsync();
        var queryPresupuestos = _context.Diseno_PresupuestosMensuales.Where(p => p.Anio == anio);
        if (mes > 0) queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes);
        var presupuestos = await queryPresupuestos.ToListAsync();

        var queryGastos = _context.Diseno_Gastos.Where(g => g.Anio == anio);
        if (mes > 0) queryGastos = queryGastos.Where(g => g.Mes == mes);
        
        var gastos = await queryGastos
            .GroupBy(g => g.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Precio) })
            .ToListAsync();

        var alertas = new List<string>();
        var porRubro = rubros.Select(t =>
        {
            var presupuesto = presupuestos.FirstOrDefault(p => p.RubroId == t.Id)?.Presupuesto ?? 0;
            var gastado = gastos.FirstOrDefault(g => g.RubroId == t.Id)?.Total ?? 0;
            var restante = presupuesto - gastado;
            return new { RubroId = t.Id, Rubro = t.Nombre, Presupuesto = presupuesto, Gastado = gastado, Restante = restante };
        }).ToList();

        alertas.AddRange(porRubro.Where(x => x.Restante < 0 && x.Presupuesto > 0).Select(x => $"El rubro '{x.Rubro}' superó el límite mensual por ${Math.Abs(x.Restante):N0}"));

        return Ok(new
        {
            Anio = anio,
            Mes = mes,
            PorRubro = porRubro,
            TotalPresupuesto = porRubro.Sum(x => x.Presupuesto),
            TotalGastado = porRubro.Sum(x => x.Gastado),
            TotalRestante = porRubro.Sum(x => x.Presupuesto) - porRubro.Sum(x => x.Gastado),
            Alertas = alertas
        });
    }

    /// <summary>
    /// Get graficas data for a full year (all 12 months)
    /// </summary>
    [HttpGet("graficas/anual/{anio}")]
    public async Task<ActionResult<object>> GetGraficasAnual(int anio)
    {
        var rubros = await _context.Diseno_Rubros.Where(r => r.Activo).ToListAsync();
        var presupuestos = await _context.Diseno_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();
        var gastos = await _context.Diseno_Gastos
            .Where(g => g.Anio == anio)
            .ToListAsync();

        var porMes = Enumerable.Range(1, 12).Select(mes =>
        {
            var presupuestoMes = presupuestos.Where(p => p.Mes == mes).Sum(p => p.Presupuesto);
            var gastadoMes = gastos.Where(g => g.Mes == mes).Sum(g => g.Precio);
            return new
            {
                Mes = mes,
                Presupuesto = presupuestoMes,
                Gastado = gastadoMes,
                Restante = presupuestoMes - gastadoMes
            };
        }).ToList();

        var porRubro = rubros.Select(r =>
        {
            var presupuesto = presupuestos.Where(p => p.RubroId == r.Id).Sum(p => p.Presupuesto);
            var gastado = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio);
            return new
            {
                RubroId = r.Id,
                Rubro = r.Nombre,
                Presupuesto = presupuesto,
                Gastado = gastado,
                Restante = presupuesto - gastado
            };
        }).ToList();

        return Ok(new
        {
            Anio = anio,
            PorMes = porMes,
            PorRubro = porRubro,
            TotalPresupuesto = porRubro.Sum(x => x.Presupuesto),
            TotalGastado = porRubro.Sum(x => x.Gastado),
            TotalRestante = porRubro.Sum(x => x.Presupuesto) - porRubro.Sum(x => x.Gastado)
        });
    }

    #endregion
}
