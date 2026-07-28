using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for Planeación Budget and Expense Management.
/// Handles Rubros, Proveedores, Cotizaciones, Presupuestos, and Gastos.
/// hierarchy: Rubro -> Proveedor
/// </summary>
// [Authorize] removed - auth middleware still processes tokens so User.Claims works
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PlaneacionController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly GastoAutorizacionService _gastoAutorizacion;

    public PlaneacionController(AppDbContext context, IWebHostEnvironment env, GastoAutorizacionService gastoAutorizacion)
    {
        _context = context;
        _env = env;
        _gastoAutorizacion = gastoAutorizacion;
    }

    #region Rubros

    /// <summary>
    /// Get all rubros
    /// </summary>
    [HttpGet("rubros")]
    public async Task<ActionResult<IEnumerable<Planeacion_Rubro>>> GetRubros()
    {
        return await _context.Planeacion_Rubros
            .Where(r => r.Activo)
            .OrderBy(r => r.Nombre)
            .ToListAsync();
    }

    /// <summary>
    /// Create a new rubro
    /// </summary>
    [HttpPost("rubros")]
    public async Task<ActionResult<Planeacion_Rubro>> CreateRubro(Planeacion_Rubro rubro)
    {
        _context.Planeacion_Rubros.Add(rubro);
        await _context.SaveChangesAsync();
        return Ok(new { id = rubro.Id });
    }

    /// <summary>
    /// Update a rubro
    /// </summary>
    [HttpPut("rubros/{id}")]
    public async Task<IActionResult> UpdateRubro(int id, Planeacion_Rubro rubro)
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
        var rubro = await _context.Planeacion_Rubros.FindAsync(id);
        if (rubro == null) return NotFound();
        rubro.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Proveedores

    /// <summary>
    /// Get all proveedores, optionally filtered by rubro
    /// </summary>
    [HttpGet("proveedores")]
    public async Task<ActionResult<List<object>>> GetProveedores([FromQuery] int? rubroId)
    {
        return Ok(await ProveedorRubroHelper.ListPlaneacionProveedoresAsync(_context, rubroId));
    }

    /// <summary>
    /// Create a new proveedor
    /// </summary>
    [HttpPost("proveedores")]
    public async Task<ActionResult<Planeacion_Proveedor>> CreateProveedor([FromBody] ProveedorWriteDto dto)
    {
        var nit = dto.NitCedula ?? dto.Nit;
        if (string.IsNullOrWhiteSpace(nit))
            return BadRequest("El NIT o Cédula es obligatorio");
        var rubroIds = dto.ResolveRubroIds();
        if (rubroIds.Count == 0)
            return BadRequest("Seleccione al menos un rubro");
        var proveedor = new Planeacion_Proveedor
        {
            Nombre = dto.Nombre,
            NitCedula = nit,
            Telefono = dto.Telefono,
            PrecioCotizado = dto.PrecioCotizado,
            RubroId = rubroIds[0],
            Activo = true
        };
        _context.Planeacion_Proveedores.Add(proveedor);
        await _context.SaveChangesAsync();
        await ProveedorRubroHelper.SyncPlaneacionAsync(_context, proveedor.Id, rubroIds);
        await _context.SaveChangesAsync();
        return Ok(new { id = proveedor.Id });
    }

    /// <summary>
    /// Update a proveedor
    /// </summary>
    [HttpPut("proveedores/{id}")]
    public async Task<IActionResult> UpdateProveedor(int id, [FromBody] ProveedorWriteDto dto)
    {
        var nit = dto.NitCedula ?? dto.Nit;
        if (string.IsNullOrWhiteSpace(nit))
            return BadRequest("El NIT o Cédula es obligatorio");
        var rubroIds = dto.ResolveRubroIds();
        if (rubroIds.Count == 0)
            return BadRequest("Seleccione al menos un rubro");
        var proveedor = await _context.Planeacion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Nombre = dto.Nombre;
        proveedor.NitCedula = nit;
        proveedor.Telefono = dto.Telefono;
        proveedor.PrecioCotizado = dto.PrecioCotizado;
        proveedor.RubroId = rubroIds[0];
        await ProveedorRubroHelper.SyncPlaneacionAsync(_context, id, rubroIds);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete (deactivate) a proveedor
    /// </summary>
    [HttpDelete("proveedores/{id}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var proveedor = await _context.Planeacion_Proveedores.FindAsync(id);
        if (proveedor == null) return NotFound();
        proveedor.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Personal (Horas Extras y Recargos)

    /// <summary>
    /// Get all personal records
    /// </summary>
    [HttpGet("personal")]
    public async Task<ActionResult<IEnumerable<Planeacion_Personal>>> GetPersonal()
    {
        return await _context.Planeacion_Personal
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .ToListAsync();
    }

    /// <summary>
    /// Create a new personal record
    /// </summary>
    [HttpPost("personal")]
    public async Task<ActionResult<Planeacion_Personal>> CreatePersonal(Planeacion_Personal personal)
    {
        personal.FechaCreacion = DateTime.Now;
        _context.Planeacion_Personal.Add(personal);
        await _context.SaveChangesAsync();
        return Ok(new { id = personal.Id });
    }

    /// <summary>
    /// Update a personal record
    /// </summary>
    [HttpPut("personal/{id}")]
    public async Task<IActionResult> UpdatePersonal(int id, Planeacion_Personal personal)
    {
        if (id != personal.Id) return BadRequest();
        _context.Entry(personal).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Delete (deactivate) a personal record
    /// </summary>
    [HttpDelete("personal/{id}")]
    public async Task<IActionResult> DeletePersonal(int id)
    {
        var personal = await _context.Planeacion_Personal.FindAsync(id);
        if (personal == null) return NotFound();
        personal.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Gastos

    /// <summary>
    /// Get gastos for a specific month/year
    /// </summary>
    [HttpGet("gastos")]
    public async Task<ActionResult<IEnumerable<object>>> GetGastos(int anio, int? mes)
    {
        IQueryable<Planeacion_Gasto> query = _context.Planeacion_Gastos
            .Include(g => g.Proveedor)
            .Include(g => g.Rubro)
            .Include(g => g.CreadoPor)
            .Include(g => g.Personal)
            .Include(g => g.TipoHora)
            .Include(g => g.TipoRecargo);

        if (mes.HasValue && mes.Value > 0)
        {
            var m = mes.Value;
            query = query.Where(g =>
                (g.Anio == anio && g.Mes == m)
                || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio && g.Fecha.Month == m));
        }
        else
        {
            query = query.Where(g =>
                g.Anio == anio || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio));
        }

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
                g.Fecha,
                g.Observaciones,
                g.FacturaPdfUrl,
                g.FechaCreacion,
                g.FechaModificacion,
                g.CreadoPorId,
                CreadoPorNombre = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "",
                g.EsPendiente,
                g.EsSolicitudCredito,
                g.EsEfectivo,
                g.PersonalId,
                PersonalNombre = g.Personal != null ? g.Personal.Nombre : "",
                PersonalCedula = g.Personal != null ? g.Personal.Cedula : "",
                PersonalSalario = g.Personal != null ? g.Personal.Salario : 0,
                g.TipoHoraId,
                TipoHoraNombre = g.TipoHora != null ? g.TipoHora.Nombre : "",
                TipoHoraFactor = g.TipoHora != null ? g.TipoHora.Factor : (decimal?)null,
                g.TipoRecargoId,
                TipoRecargoNombre = g.TipoRecargo != null ? g.TipoRecargo.Nombre : "",
                TipoRecargoFactor = g.TipoRecargo != null ? g.TipoRecargo.Factor : (decimal?)null,
                g.CantidadHoras,
                g.NumeroOP,
                Estado = g.Estado ?? "Montado"
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
        var queryGastos = _context.Planeacion_Gastos.AsQueryable();
        if (mes.HasValue && mes.Value > 0)
        {
            var m = mes.Value;
            queryGastos = queryGastos.Where(g =>
                (g.Anio == anio && g.Mes == m)
                || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio && g.Fecha.Month == m));
        }
        else
        {
            queryGastos = queryGastos.Where(g =>
                g.Anio == anio || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio));
        }
        var gastos = await queryGastos.ToListAsync();

        // 2. Get Budgets
        var queryPresupuestos = _context.Planeacion_PresupuestosMensuales.Where(p => p.Anio == anio);
        if (mes.HasValue && mes.Value > 0) queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes.Value);
        var presupuestos = await queryPresupuestos.ToListAsync();

        // 3. Totals
        var totalPresupuesto = presupuestos.Sum(p => p.Presupuesto);
        var totalGastado = gastos.Sum(g => g.Precio);

        // 4. Group by Rubro
        var rubroIds = gastos.Select(g => g.RubroId)
            .Union(presupuestos.Select(p => p.RubroId))
            .Distinct()
            .ToList();

        var rubrosInfo = await _context.Planeacion_Rubros
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

    /// <summary>
    /// Create a new gasto
    /// </summary>
    [HttpPost("gastos")]
    public async Task<ActionResult<Planeacion_Gasto>> CreateGasto(
        Planeacion_Gasto gasto,
        [FromQuery] int? autorizacionId = null)
    {
        var esLaborP = GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(gasto.TipoHoraId, gasto.TipoRecargoId);

        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        int adminId = 0;
        if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int parsedAdminId))
        {
            adminId = parsedAdminId;
            gasto.CreadoPorId = parsedAdminId;
        }
        if (adminId <= 0 && !esLaborP)
            return BadRequest(new { message = "No se pudo identificar al usuario." });
        try
        {
            await _gastoAutorizacion.ExigirAutorizacionParaGastoNormalAsync(
                "planeacion", autorizacionId, adminId, esLaborP);
        }
        catch (InvalidOperationException exAuth)
        {
            return BadRequest(new { message = exAuth.Message });
        }

        var mpP = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esLaborP, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mpP != null) return (ActionResult<Planeacion_Gasto>)(object)mpP;

        if (!esLaborP && !gasto.EsPendiente && string.IsNullOrWhiteSpace(gasto.NumeroFactura))
            return BadRequest(new { message = "El número de factura es obligatorio para legalizar el gasto." });

        var rubroP = await _context.Planeacion_Rubros.FindAsync(gasto.RubroId);
        var pP = gasto.Precio;
        var pbP = gasto.PrecioBase;
        var piP = gasto.PrecioIva;
        var errIvP = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, gasto.TipoHoraId, gasto.TipoRecargoId, rubroP?.Nombre, ref pP, ref pbP, ref piP);
        if (errIvP != null) return (ActionResult<Planeacion_Gasto>)(object)errIvP;
        gasto.Precio = pP;
        gasto.PrecioBase = pbP;
        gasto.PrecioIva = piP;

        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        gasto.FechaCreacion = DateTime.UtcNow;
        _context.Planeacion_Gastos.Add(gasto);
        await _context.SaveChangesAsync();
        if (autorizacionId.HasValue && autorizacionId.Value > 0)
            await _gastoAutorizacion.VincularGastoRegistradoAsync(autorizacionId.Value, gasto.Id);
        return Ok(new { id = gasto.Id });
    }

    /// <summary>
    /// Update a gasto
    /// </summary>
    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Planeacion_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest("ID mismatch");

        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(gasto.Fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });

        var esLaborPu = GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(gasto.TipoHoraId, gasto.TipoRecargoId);
        var mpPu = GastoMedioPagoHelper.ValidateCreditoOExclusivoEfectivo(esLaborPu, gasto.EsSolicitudCredito, gasto.EsEfectivo);
        if (mpPu != null) return mpPu;

        if (!esLaborPu && !gasto.EsPendiente && string.IsNullOrWhiteSpace(gasto.NumeroFactura))
            return BadRequest(new { message = "El número de factura es obligatorio para legalizar el gasto." });

        var rubroPu = await _context.Planeacion_Rubros.FindAsync(gasto.RubroId);
        var pPu = gasto.Precio;
        var pbPu = gasto.PrecioBase;
        var piPu = gasto.PrecioIva;
        var errIvPu = GastoPrecioIvaHelper.AplicarSegunRubroYTipo(false, gasto.TipoHoraId, gasto.TipoRecargoId, rubroPu?.Nombre, ref pPu, ref pbPu, ref piPu);
        if (errIvPu != null) return errIvPu;
        gasto.Precio = pPu;
        gasto.PrecioBase = pbPu;
        gasto.PrecioIva = piPu;

        // Preserve FechaCreacion
        var existingEntry = await _context.Planeacion_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
        if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;

        gasto.FechaModificacion = DateTime.UtcNow;
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
        var gasto = await _context.Planeacion_Gastos.FindAsync(id);
        if (gasto == null) return NotFound();
        _context.Planeacion_Gastos.Remove(gasto);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Upload PDF Factura
    /// </summary>
    [HttpPost("upload-factura")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult> UploadFactura([FromForm] DTOs.FileUploadDto dto)
    {
        var file = dto.File;
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "facturas");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new { url = $"/uploads/facturas/{uniqueFileName}" });
    }

    /// <summary>
    /// Get Overtime and Surcharges Types
    /// </summary>
    [HttpGet("tipos-horas-recargos")]
    public async Task<ActionResult<object>> GetTiposHorasRecargos()
    {
        var horas = await _context.Produccion_TiposHora.Where(h => h.Activo).ToListAsync();
        var recargos = await _context.Produccion_TiposRecargo.Where(r => r.Activo).ToListAsync();

        return Ok(new
        {
            TiposHora = horas,
            TiposRecargo = recargos
        });
    }

    #endregion

    #region Cotizaciones

    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Planeacion_Cotizaciones
            .Include(c => c.Proveedor)
            .Include(c => c.Rubro)
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
    public async Task<ActionResult<Planeacion_Cotizacion>> CreateCotizacion([FromBody] Planeacion_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.Planeacion_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, Planeacion_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();
        _context.Entry(cotizacion).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.Planeacion_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();
        cotizacion.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Presupuestos

    /// <summary>
    /// Get all presupuestos for a specific year
    /// </summary>
    [HttpGet("presupuestos")]
    public async Task<ActionResult<List<object>>> GetPresupuestos([FromQuery] int anio)
    {
        var presupuestos = await _context.Planeacion_PresupuestosMensuales
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

    /// <summary>
    /// Get presupuesto grid data for a year (Rubro rows x 12 months columns)
    /// </summary>
    [HttpGet("presupuestos/grid")]
    public async Task<ActionResult<object>> GetPresupuestosGrid([FromQuery] int anio)
    {
        var rubros = await _context.Planeacion_Rubros
            .Where(t => t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync();

        var presupuestos = await _context.Planeacion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        var gridData = rubros.Select(rubro => new
        {
            TipoServicioId = rubro.Id, // Kept key as TipoServicioId for frontend compatibility if needed, but it's Rubro Id
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
            TiposServicio = gridData, // Kept as TiposServicio for frontend compatibility
            TotalesMensuales = totalesMensuales,
            TotalAnual = presupuestos.Sum(p => p.Presupuesto)
        });
    }

    /// <summary>
    /// Set or update a presupuesto for a specific Rubro/month/year
    /// </summary>
    [HttpPost("presupuestos")]
    public async Task<ActionResult<Planeacion_PresupuestoMensual>> SetPresupuesto([FromBody] Planeacion_PresupuestoMensual presupuesto)
    {
        var existing = await _context.Planeacion_PresupuestosMensuales
            .FirstOrDefaultAsync(p => 
                p.RubroId == presupuesto.RubroId && 
                p.Anio == presupuesto.Anio && 
                p.Mes == presupuesto.Mes);

        if (existing != null)
        {
            existing.Presupuesto = presupuesto.Presupuesto;
        }
        else
        {
            _context.Planeacion_PresupuestosMensuales.Add(presupuesto);
        }

        await _context.SaveChangesAsync();
        return Ok(presupuesto);
    }

    /// <summary>
    /// Bulk update presupuestos
    /// </summary>
    [HttpPost("presupuestos/bulk")]
    public async Task<IActionResult> SetPresupuestosBulk([FromBody] List<Planeacion_PresupuestoMensual> presupuestos)
    {
        foreach (var p in presupuestos)
        {
            var existing = await _context.Planeacion_PresupuestosMensuales
                .FirstOrDefaultAsync(x => x.RubroId == p.RubroId && x.Anio == p.Anio && x.Mes == p.Mes);

            if (existing != null)
            {
                existing.Presupuesto = p.Presupuesto;
            }
            else
            {
                _context.Planeacion_PresupuestosMensuales.Add(p);
            }
        }
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Updated {presupuestos.Count} presupuestos" });
    }

    #endregion

    #region Graficas (Calculated Data)

    /// <summary>
    /// Get graficas data for a specific month/year
    /// </summary>
    [HttpGet("graficas/{anio}/{mes}")]
    public async Task<ActionResult<object>> GetGraficas(int anio, int mes)
    {
        var queryRubros = _context.Planeacion_Rubros.Where(t => t.Activo);
        var rubros = await queryRubros.ToListAsync();

        var queryPresupuestos = _context.Planeacion_PresupuestosMensuales.Where(p => p.Anio == anio);
        if (mes > 0) queryPresupuestos = queryPresupuestos.Where(p => p.Mes == mes);
        var presupuestos = await queryPresupuestos.ToListAsync();

        IQueryable<Planeacion_Gasto> queryGastos = _context.Planeacion_Gastos;
        if (mes > 0)
        {
            queryGastos = queryGastos.Where(g =>
                (g.Anio == anio && g.Mes == mes)
                || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio && g.Fecha.Month == mes));
        }
        else
        {
            queryGastos = queryGastos.Where(g =>
                g.Anio == anio || ((g.Anio <= 0 || g.Mes < 1 || g.Mes > 12) && g.Fecha.Year == anio));
        }

        var gastos = await queryGastos
            .GroupBy(g => g.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Precio) })
            .ToListAsync();

        var alertas = new List<string>();
        var porRubro = rubros.Select(t =>
        {
            // If annual (mes=0), sum all budgets for the rubro. If monthly, it's just the one.
            var presupuesto = presupuestos.Where(p => p.RubroId == t.Id).Sum(p => p.Presupuesto);
            var gastado = gastos.FirstOrDefault(g => g.RubroId == t.Id)?.Total ?? 0;
            var restante = presupuesto - gastado;

            if (restante < 0 && presupuesto > 0)
            {
                alertas.Add($"El rubro '{t.Nombre}' superó el límite mensual por ${Math.Abs(restante):N0}");
            }

            return new
            {
                RubroId = t.Id,
                Rubro = t.Nombre,
                Presupuesto = presupuesto,
                Gastado = gastado,
                Restante = restante
            };
        }).ToList();

        var totalPresupuesto = porRubro.Sum(x => x.Presupuesto);
        var totalGastado = porRubro.Sum(x => x.Gastado);

        return Ok(new
        {
            Anio = anio,
            Mes = mes,
            PorRubro = porRubro,
            TotalPresupuesto = totalPresupuesto,
            TotalGastado = totalGastado,
            TotalRestante = totalPresupuesto - totalGastado,
            Alertas = alertas
        });
    }

    /// <summary>
    /// Get annual summary
    /// </summary>
    [HttpGet("graficas/anual/{anio}")]
    public async Task<ActionResult<object>> GetGraficasAnual(int anio)
    {
        var rubros = await _context.Planeacion_Rubros.Where(r => r.Activo).ToListAsync();
        var presupuestos = await _context.Planeacion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .GroupBy(p => p.RubroId)
            .Select(g => new { RubroId = g.Key, Total = g.Sum(x => x.Presupuesto) })
            .ToListAsync();
        var gastos = await _context.Planeacion_Gastos
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
