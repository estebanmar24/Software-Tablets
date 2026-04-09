using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace TiempoProcesos.API.Controllers;

/// <summary>
/// Controller for Talleres y Despachos Budget and Expense Management.
/// Handles Rubros, Proveedores, Presupuestos, Gastos, and Graficas.
/// </summary>
// [Authorize]
[ApiController]
[Route("api/[controller]")]
public class TalleresController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public TalleresController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
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

    /// <summary>
    /// Upload PDF Factura
    /// </summary>
    [HttpPost("upload-factura")]
    public async Task<ActionResult> UploadFactura(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        // Ensure uploads folder exists
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "facturas");
        if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

        // Generate unique filename
        var uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Return relative URL
        return Ok(new { url = $"/uploads/facturas/{uniqueFileName}" });
    }

    #endregion

    #region Proveedores

    /// <summary>
    /// Get all proveedores
    /// </summary>
    [HttpGet("proveedores")]
    public async Task<ActionResult<IEnumerable<object>>> GetProveedores()
    {
        return await _context.Talleres_Proveedores
            .Include(p => p.Rubro)
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .Select(p => new {
                p.Id,
                p.Nombre,
                p.NitCedula,
                p.Telefono,
                p.PrecioCotizado,
                p.Activo,
                p.RubroId,
                RubroNombre = p.Rubro != null ? p.Rubro.Nombre : ""
            })
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

        var existingProveedor = await _context.Talleres_Proveedores.FindAsync(id);
        if (existingProveedor == null) return NotFound();

        existingProveedor.Nombre = proveedor.Nombre;
        existingProveedor.NitCedula = proveedor.NitCedula;
        existingProveedor.Telefono = proveedor.Telefono;
        existingProveedor.PrecioCotizado = proveedor.PrecioCotizado;
        existingProveedor.RubroId = proveedor.RubroId;

        _context.Entry(existingProveedor).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Create a new gasto
    /// </summary>
    [HttpPost("gastos")]
    public async Task<ActionResult<Talleres_Gasto>> CreateGasto(Talleres_Gasto gasto)
    {
        if (!ModelState.IsValid)
        {
            var errors = string.Join("; ", ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage));
            Console.WriteLine($"[CreateGasto] Validation Errors: {errors}"); // Log to console
            return BadRequest($"Validation Failed: {errors}");
        }

        Console.WriteLine($"[CreateGasto] EsPendiente from Frontend: {gasto.EsPendiente}");

        try 
        {
            // Set Creator
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
            {
                gasto.CreadoPorId = adminId;
            }

            gasto.FechaCreacion = DateTime.UtcNow;
            _context.Talleres_Gastos.Add(gasto);
            await _context.SaveChangesAsync();
            return Ok(new { id = gasto.Id });
        }
        catch (Exception ex)
        {
            var errorMessage = ex.Message;
            if (ex.InnerException != null) errorMessage += " | Inner: " + ex.InnerException.Message;
            Console.WriteLine($"[ERROR] CreateGasto Exception: {errorMessage}");
            return StatusCode(500, new { error = "Database Error", message = errorMessage });
        }
    }

    /// <summary>
    /// Update a gasto
    /// </summary>
    [HttpPut("gastos/{id}")]
    public async Task<IActionResult> UpdateGasto(int id, Talleres_Gasto gasto)
    {
        if (id != gasto.Id) return BadRequest("ID mismatch");

        if (!ModelState.IsValid)
        {
             var errors = string.Join("; ", ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage));
            Console.WriteLine($"[UpdateGasto] Validation Errors: {errors}");
            return BadRequest($"Validation Failed: {errors}");
        }

        Console.WriteLine($"[UpdateGasto] ID: {id}, EsPendiente from Frontend: {gasto.EsPendiente}");

        // Preserve FechaCreacion
    var existingEntry = await _context.Talleres_Gastos.AsNoTracking().FirstOrDefaultAsync(g => g.Id == id);
    if (existingEntry != null) gasto.FechaCreacion = existingEntry.FechaCreacion;
    
    gasto.FechaModificacion = DateTime.UtcNow;
    _context.Entry(gasto).State = EntityState.Modified;
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
            .Include(g => g.Personal) // Include Personal
            .Include(g => g.TipoHora) // Include TipoHora
            .Include(g => g.TipoRecargo) // Include TipoRecargo
            .Include(g => g.CreadoPor) // Include Creator
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
                g.Observaciones,
                g.FacturaPdfUrl,
                // New Fields for Display
                g.PersonalId,
                PersonalNombre = g.Personal != null ? g.Personal.Nombre : "",
                g.CantidadHoras,
                g.NumeroOP,
                g.TipoHoraId,
                // Add Names for Types
                TipoHoraNombre = g.TipoHora != null ? g.TipoHora.Nombre : "",
                TipoHoraPorcentaje = g.TipoHora != null ? g.TipoHora.Porcentaje : 0,
                TipoHoraFactor = g.TipoHora != null ? g.TipoHora.Factor : 0,
                g.TipoRecargoId,
                TipoRecargoNombre = g.TipoRecargo != null ? g.TipoRecargo.Nombre : "",
                TipoRecargoPorcentaje = g.TipoRecargo != null ? g.TipoRecargo.Porcentaje : 0,
                TipoRecargoFactor = g.TipoRecargo != null ? g.TipoRecargo.Factor : 0,
                g.FechaCreacion,
                g.FechaModificacion,
                g.CreadoPorId,
                CreadoPorNombre = g.CreadoPor != null ? g.CreadoPor.NombreMostrar : "",
                g.EsPendiente
            })
            .ToListAsync();

        return Ok(gastos);
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

    // ===================== HORAS EXTRAS REPORT =====================
    /// <summary>
    /// Get overtime (Horas Extras) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/horas-extras-report")]
    public async Task<ActionResult<List<object>>> GetHorasExtrasReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Horas Extras" rubro ID
        var rubroHE = await _context.Talleres_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        if (rubroHE == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Talleres_Gastos
            .Where(g => g.RubroId == rubroHE.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Personal)
            .Include(g => g.TipoHora)
            .OrderByDescending(g => g.Fecha)
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                PersonalNombre = g.Personal != null ? g.Personal.Nombre : "N/A",
                PersonalDocumento = g.Personal != null ? g.Personal.Documento : "",
                Salario = g.Personal != null ? g.Personal.Salario : 0,
                ValorHora = g.Personal != null ? (g.Personal.Salario / 220m) : 0,
                NumeroOP = g.NumeroOP ?? "",
                TipoHoraNombre = g.TipoHora != null ? g.TipoHora.Nombre : "N/A",
                Factor = g.TipoHora != null ? g.TipoHora.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Observaciones ?? ""
            })
            .ToListAsync();

        return Ok(gastos);
    }

    // ===================== RECARGOS REPORT =====================
    /// <summary>
    /// Get surcharge (Recargo) records for Excel export within a date range
    /// </summary>
    [HttpGet("gastos/recargos-report")]
    public async Task<ActionResult<List<object>>> GetRecargosReport(DateTime fechaInicio, DateTime fechaFin)
    {
        // Find "Recargo" rubro ID
        var rubroRecargo = await _context.Talleres_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");
        if (rubroRecargo == null) return Ok(new List<object>());

        // Normalize dates to UTC
        fechaInicio = fechaInicio.Date.ToUniversalTime();
        fechaFin = fechaFin.Date.AddDays(1).AddSeconds(-1).ToUniversalTime();

        var gastos = await _context.Talleres_Gastos
            .Where(g => g.RubroId == rubroRecargo.Id && g.Fecha >= fechaInicio && g.Fecha <= fechaFin)
            .Include(g => g.Personal)
            .Include(g => g.TipoRecargo)
            .OrderByDescending(g => g.Fecha)
            .Select(g => new {
                Id = g.Id,
                Fecha = g.Fecha,
                PersonalNombre = g.Personal != null ? g.Personal.Nombre : "N/A",
                PersonalDocumento = g.Personal != null ? g.Personal.Documento : "",
                Salario = g.Personal != null ? g.Personal.Salario : 0,
                ValorHora = g.Personal != null ? (g.Personal.Salario / 220m) : 0,
                NumeroOP = g.NumeroOP ?? "",
                TipoRecargoNombre = g.TipoRecargo != null ? g.TipoRecargo.Nombre : "N/A",
                Factor = g.TipoRecargo != null ? g.TipoRecargo.Factor : 0,
                CantidadHoras = g.CantidadHoras ?? 0,
                Precio = g.Precio,
                Nota = g.Observaciones ?? ""
            })
            .ToListAsync();

        return Ok(gastos);
    }

    #endregion

    #region File Upload

    /// <summary>
    /// Upload a factura PDF file
    /// </summary>
    // ==========================================
    // COTIZACIONES (QUOTES)
    // ==========================================

    [HttpGet("cotizaciones")]
    public async Task<ActionResult<List<object>>> GetCotizaciones([FromQuery] int? proveedorId, [FromQuery] int? anio, [FromQuery] int? mes)
    {
        var query = _context.Talleres_Cotizaciones
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
    public async Task<ActionResult<Talleres_Cotizacion>> CreateCotizacion([FromBody] Talleres_Cotizacion cotizacion)
    {
        cotizacion.Activo = true;
        _context.Talleres_Cotizaciones.Add(cotizacion);
        await _context.SaveChangesAsync();
        return Ok(new { id = cotizacion.Id });
    }

    [HttpPut("cotizaciones/{id}")]
    public async Task<IActionResult> UpdateCotizacion(int id, Talleres_Cotizacion cotizacion)
    {
        if (id != cotizacion.Id) return BadRequest();

        // Ensure we don't clear fields if partial update (but here we expect full object usually, or at least keys)
        // Better to fetch and update?
        // For simplicity, we assume full update or mapped fields. But EntityState.Modified updates all.
        // Let's use simple approach as in other controllers.
        
        _context.Entry(cotizacion).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Talleres_Cotizaciones.Any(e => e.Id == id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

    [HttpDelete("cotizaciones/{id}")]
    public async Task<IActionResult> DeleteCotizacion(int id)
    {
        var cotizacion = await _context.Talleres_Cotizaciones.FindAsync(id);
        if (cotizacion == null) return NotFound();

        cotizacion.Activo = false; // Soft delete
        _context.Entry(cotizacion).State = EntityState.Modified;
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

    #region Maestros

    [HttpGet("horarios")]
    public async Task<ActionResult<IEnumerable<Horario>>> GetHorarios()
    {
        return await _context.Horarios.Where(h => h.Activo).OrderBy(h => h.Codigo).ToListAsync();
    }

    #endregion

    [HttpPost("gastos/recalcular")]
    public async Task<IActionResult> RecalcularGastos()
    {
        var rubroHE = await _context.Talleres_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Horas Extras");
        var rubroRecargo = await _context.Talleres_Rubros.FirstOrDefaultAsync(r => r.Nombre == "Recargo");

        var ids = new List<int>();
        if (rubroHE != null) ids.Add(rubroHE.Id);
        if (rubroRecargo != null) ids.Add(rubroRecargo.Id);

        if (!ids.Any()) return Ok("No rubros found");

        var gastos = await _context.Talleres_Gastos
            .Where(g => ids.Contains(g.RubroId))
            .Include(g => g.Personal) // Need Personal Salary
            .Include(g => g.TipoHora) // Need Factors
            .Include(g => g.TipoRecargo)
            .ToListAsync();

        int count = 0;
        foreach (var g in gastos)
        {
            if (g.Personal == null || g.Personal.Salario <= 0) continue;

            decimal factor = 0;
            if (g.RubroId == rubroHE?.Id && g.TipoHora != null) factor = g.TipoHora.Factor;
            if (g.RubroId == rubroRecargo?.Id && g.TipoRecargo != null) factor = g.TipoRecargo.Factor;
            
            if (factor > 0 && g.CantidadHoras > 0)
            {
                decimal hourlyRate = g.Personal.Salario / 220m;
                g.Precio = Math.Round(hourlyRate * factor * g.CantidadHoras.Value, 2);
                count++;
            }
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Recalculated {count} records." });
    }
}
