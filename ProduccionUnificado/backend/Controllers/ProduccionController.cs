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

    /// <summary>
    /// Get available periods (month/year combinations) with production data
    /// </summary>
    [HttpGet("periodos-disponibles")]
    public async Task<ActionResult> GetPeriodosDisponibles()
    {
        var periodos = await _context.ProduccionDiaria
            .Select(p => new { Mes = p.Fecha.Month, Anio = p.Fecha.Year })
            .Distinct()
            .OrderByDescending(p => p.Anio)
            .ThenByDescending(p => p.Mes)
            .ToListAsync();
        return Ok(periodos);
    }

    /// <summary>
    /// Get operators that have production data for a given month/year
    /// Returns grouped by usuario+maquina with days count for CaptureGridScreen modal
    /// </summary>
    [HttpGet("operarios-con-datos")]
    public async Task<ActionResult> GetOperariosConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => new {
                usuarioId = g.Key.UsuarioId,
                usuarioNombre = g.First().Usuario != null ? g.First().Usuario.Nombre : "Desconocido",
                maquinaId = g.Key.MaquinaId,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.usuarioNombre)
            .ThenBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get machines that have production data for a given month/year
    /// Returns with maquinaId, maquinaNombre, and diasRegistrados for CaptureGridScreen modal
    /// </summary>
    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult> GetMaquinasConDatos(int mes, int anio)
    {
        var datos = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .GroupBy(p => p.MaquinaId)
            .Select(g => new {
                maquinaId = g.Key,
                maquinaNombre = g.First().Maquina != null ? g.First().Maquina.Nombre : "Desconocida",
                diasRegistrados = g.Select(p => p.Fecha.Date).Distinct().Count()
            })
            .OrderBy(x => x.maquinaNombre)
            .ToListAsync();

        return Ok(datos);
    }

    /// <summary>
    /// Get detailed daily production records for a specific operator and machine
    /// Used by CaptureGridScreen to populate the grid
    /// </summary>
    [HttpGet("detalles")]
    public async Task<ActionResult> GetDetalles(int mes, int anio, int maquinaId, int usuarioId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }

    /// <summary>
    /// Get detailed daily production records for a specific machine (all operators)
    /// Used by CaptureGridScreen when filtered by machine
    /// </summary>
    [HttpGet("detalles-maquina")]
    public async Task<ActionResult> GetDetallesMaquina(int mes, int anio, int maquinaId)
    {
        var detalles = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();
        return Ok(detalles);
    }


    /// <summary>
    /// Delete production data for a specific period, optionally filtered by user or machine
    /// </summary>
    [HttpDelete("borrar")]
    public async Task<IActionResult> BorrarProduccion(int mes, int anio, int? usuarioId = null, int? maquinaId = null)
    {
        var query = _context.ProduccionDiaria.Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (usuarioId.HasValue)
        {
            query = query.Where(p => p.UsuarioId == usuarioId.Value);
        }

        if (maquinaId.HasValue)
        {
            query = query.Where(p => p.MaquinaId == maquinaId.Value);
        }

        var records = await query.ToListAsync();
        if (!records.Any())
        {
            return NotFound("No se encontraron registros para borrar con los filtros proporcionados.");
        }

        _context.ProduccionDiaria.RemoveRange(records);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Se eliminaron {records.Count} registros." });
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

        return Ok(gasto);
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
    /// Get production summary with operators and machines data for a month
    /// </summary>
    [HttpGet("resumen")]
    public async Task<ActionResult> GetResumen(int mes, int anio, int? diaInicio = null, int? diaFin = null)
    {
        // Get all production data for the month
        var query = _context.ProduccionDiaria
            .Include(p => p.Usuario)
            .Include(p => p.Maquina)
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        // Apply day range filter if provided (for weekly reports)
        if (diaInicio.HasValue && diaFin.HasValue)
        {
            query = query.Where(p => p.Fecha.Day >= diaInicio.Value && p.Fecha.Day <= diaFin.Value);
        }

        var produccion = await query.ToListAsync();

        // Get machine metadata for importance and meta calculations
        var maquinas = await _context.Maquinas.Where(m => m.Activo).ToListAsync();

        // Count working days in period
        var diasLaborados = produccion
            .Select(p => p.Fecha.Date)
            .Distinct()
            .Count();

        // Group by Operario + Maquina combination - ALIGNED WITH CalificacionController
        var resumenOperarios = produccion
            .GroupBy(p => new { p.UsuarioId, p.MaquinaId })
            .Select(g => {
                var maq = maquinas.FirstOrDefault(m => m.Id == g.Key.MaquinaId);
                var first = g.First();
                var tirosReferencia = maq?.TirosReferencia ?? 0;
                
                // Calculate TirosConEquivalencia like CalificacionController
                var totalTiros = g.Sum(p => (p.Cambios * tirosReferencia) + p.TirosDiarios);
                var tirosBonificables = g.Sum(p => p.TirosBonificables);
                var diasOp = g.Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use Meta100Porciento like CalificacionController
                var meta100Porciento = maq?.Meta100Porciento ?? maq?.MetaRendimiento ?? 7500;
                var meta100 = meta100Porciento * diasOp;
                var meta75 = meta100 * 0.75m;
                
                var pct75 = meta75 > 0 ? (decimal)totalTiros / meta75 * 100 : 0;
                var pct100 = meta100 > 0 ? (decimal)totalTiros / meta100 * 100 : 0;
                
                string sem75 = pct75 >= 100 ? "Verde" : pct75 >= 75 ? "Amarillo" : "Rojo";
                string sem100 = pct100 >= 100 ? "Verde" : pct100 >= 75 ? "Amarillo" : "Rojo";

                // Apply 75% threshold: Only pay bonificación if operario achieved >= 75% of Meta100
                var valorBonifSum = g.Sum(p => p.ValorAPagarBonificable);
                var valorAPagarBonificableFinal = pct100 >= 75 ? valorBonifSum : 0;

                return new {
                    usuarioId = g.Key.UsuarioId,
                    maquinaId = g.Key.MaquinaId,
                    operario = first.Usuario?.Nombre ?? "Desconocido",
                    maquina = first.Maquina?.Nombre ?? "Desconocida",
                    totalTiros = totalTiros,
                    tirosBonificables = tirosBonificables,
                    totalHorasProductivas = g.Sum(p => p.TotalHorasProductivas),
                    promedioHoraProductiva = g.Average(p => p.PromedioHoraProductiva),
                    totalHoras = g.Sum(p => p.TotalHoras),
                    valorAPagar = g.Sum(p => p.ValorAPagar),
                    valorAPagarBonificable = valorAPagarBonificableFinal,
                    diasLaborados = diasOp,
                    metaBonificacion = meta75,
                    meta100Porciento = meta100,
                    eficiencia = pct100 / 100,
                    porcentajeRendimiento75 = pct75,
                    porcentajeRendimiento100 = pct100,
                    semaforoColor = sem75,
                    semaforoColor100 = sem100
                };
            })
            .OrderBy(r => r.operario)
            .ThenBy(r => r.maquina)
            .ToList();

        // Group by Maquina only - ALIGNED WITH CalificacionController calculation
        var resumenMaquinas = produccion
            .GroupBy(p => p.MaquinaId)
            .Select(g => {
                var maq = maquinas.FirstOrDefault(m => m.Id == g.Key);
                var tirosReferencia = maq?.TirosReferencia ?? 0;
                
                // Calculate TirosConEquivalencia like CalificacionController: (Cambios * TirosReferencia) + TirosDiarios
                var tirosTotales = g.Sum(p => (p.Cambios * tirosReferencia) + p.TirosDiarios);
                var diasMaq = g.Select(p => p.Fecha.Date).Distinct().Count();
                
                // Use Meta100Porciento like CalificacionController
                var meta100Porciento = maq?.Meta100Porciento ?? maq?.MetaRendimiento ?? 7500;
                var meta100 = meta100Porciento * diasMaq;
                var meta75 = meta100 * 0.75m;
                
                var pct = meta100 > 0 ? (decimal)tirosTotales / meta100 * 100 : 0;
                string sem = pct >= 100 ? "Verde" : pct >= 75 ? "Amarillo" : "Rojo";
                
                var importancia = maq?.Importancia ?? 0;
                var calificacion = pct * importancia / 100;

                return new {
                    maquinaId = g.Key,
                    maquina = maq?.Nombre ?? "Desconocida",
                    tirosTotales = tirosTotales,
                    rendimientoEsperado = meta100,
                    meta75Porciento = meta75,
                    meta100Porciento = meta100,
                    porcentajeRendimiento = pct / 100,
                    porcentajeRendimiento100 = pct,
                    semaforoColor = sem,
                    totalTiemposMuertos = g.Sum(p => p.TotalTiemposMuertos),
                    totalTiempoReparacion = g.Sum(p => p.TiempoReparacion),
                    totalTiempoFaltaTrabajo = g.Sum(p => p.TiempoFaltaTrabajo),
                    totalTiempoOtro = g.Sum(p => p.TiempoOtroMuerto),
                    importancia = importancia,
                    calificacion = Math.Round(calificacion, 2)
                };
            })
            .OrderBy(r => r.maquina)
            .ToList();

        // Daily trend
        var tendenciaDiaria = produccion
            .GroupBy(p => p.Fecha.Date)
            .Select(g => new {
                fecha = g.Key,
                tiros = g.Sum(p => p.TirosDiarios),
                desperdicio = g.Sum(p => p.Desperdicio)
            })
            .OrderBy(t => t.fecha)
            .ToList();

        // Plant score (sum of machine calificaciones)
        var calificacionTotalPlanta = resumenMaquinas.Sum(m => m.calificacion);

        return Ok(new {
            resumenOperarios,
            resumenMaquinas,
            tendenciaDiaria,
            calificacionTotalPlanta
        });
    }

    /// <summary>
    /// Get budget summary for a month (renamed from original resumen)
    /// </summary>
    [HttpGet("resumen-gastos")]
    public async Task<ActionResult> GetResumenGastos(int anio, int mes)
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
        var presupuestos = await _context.Produccion_PresupuestosMensuales
            .Where(p => p.Anio == anio)
            .ToListAsync();

        if (!mes.HasValue)
        {
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

        // Performance by Rubro (for progress bars)
        var rubros = await _context.Produccion_Rubros.Where(r => r.Activo).ToListAsync();
        var desempenoRubro = rubros.Select(r => {
            var gastoRubro = gastos.Where(g => g.RubroId == r.Id).Sum(g => g.Precio);
            var presupuestoRubro = mes.HasValue 
                ? (presupuestos.FirstOrDefault(p => p.RubroId == r.Id && p.Mes == mes.Value)?.Presupuesto ?? 0)
                : presupuestos.Where(p => p.RubroId == r.Id).Sum(p => p.Presupuesto);

            return new {
                rubroId = r.Id,
                nombre = r.Nombre,
                gastado = gastoRubro,
                presupuesto = presupuestoRubro,
                restante = presupuestoRubro - gastoRubro
            };
        }).OrderByDescending(x => x.gastado).ToList();

        var totalGastado = gastos.Sum(g => g.Precio);
        var totalPresupuesto = mes.HasValue 
            ? presupuestos.Where(p => p.Mes == mes.Value).Sum(p => p.Presupuesto)
            : presupuestos.Sum(p => p.Presupuesto);

        return Ok(new {
            totalGastado,
            totalPresupuesto,
            totalRestante = totalPresupuesto - totalGastado,
            porRubro,
            desempenoRubro,
            porProveedor,
            porUsuario,
            resumenMensual
        });
    }
}
