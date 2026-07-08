using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class DesperdicioController : ControllerBase
{
    private readonly AppDbContext _context;

    public DesperdicioController(AppDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // UTILIDADES
    // ==========================================

    [HttpGet("init")]
    public IActionResult InitDb()
    {
        try
        {
            // Script PostgreSQL para crear tablas si no existen
            var sqlCodigo = @"
                CREATE TABLE IF NOT EXISTS ""CodigosDesperdicio"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Codigo"" TEXT NOT NULL,
                    ""Descripcion"" TEXT,
                    ""Activo"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""FechaCreacion"" TIMESTAMP NOT NULL DEFAULT NOW()
                );";

            var sqlRegistro = @"
                CREATE TABLE IF NOT EXISTS ""RegistrosDesperdicio"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""MaquinaId"" INTEGER NOT NULL,
                    ""UsuarioId"" INTEGER NOT NULL,
                    ""CodigoDesperdicioId"" INTEGER NOT NULL,
                    ""OrdenProduccion"" TEXT,
                    ""Cantidad"" DECIMAL NOT NULL,
                    ""Fecha"" TIMESTAMP NOT NULL,
                    ""FechaRegistro"" TIMESTAMP NOT NULL DEFAULT NOW()
                );";

            _context.Database.ExecuteSqlRaw(sqlCodigo);
            _context.Database.ExecuteSqlRaw(sqlRegistro);
            
            return Ok("Tablas CodigosDesperdicio y RegistrosDesperdicio verificadas/creadas (PostgreSQL)");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error inicializando DB: {ex.Message}");
        }
    }

    [HttpGet("migracion-taller-externo")]
    public IActionResult MigracionTallerExterno()
    {
        try
        {
            var sql = @"
                ALTER TABLE ""RegistrosDesperdicio"" ALTER COLUMN ""MaquinaId"" DROP NOT NULL;
                ALTER TABLE ""RegistrosDesperdicio"" ALTER COLUMN ""UsuarioId"" DROP NOT NULL;
                ALTER TABLE ""RegistrosDesperdicio"" ADD COLUMN IF NOT EXISTS ""EsTallerExterno"" boolean NOT NULL DEFAULT false;
            ";
            _context.Database.ExecuteSqlRaw(sql);
            return Ok("Migración manual para Taller Externo aplicada.");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error migrando: {ex.Message}");
        }
    }

    [HttpGet("fix-nullable")]
    public IActionResult FixNullable()
    {
        try
        {
            // Alterar tabla para permitir NULL en CodigoDesperdicioId
            var sql = @"ALTER TABLE ""RegistrosDesperdicio"" ALTER COLUMN ""CodigoDesperdicioId"" DROP NOT NULL;";
            _context.Database.ExecuteSqlRaw(sql);
            return Ok("Columna CodigoDesperdicioId ahora permite NULL");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error fixing nullable: {ex.Message}");
        }
    }

    [HttpGet("add-nota-column")]
    public IActionResult AddNotaColumn()
    {
        try
        {
            var sql = @"ALTER TABLE ""RegistrosDesperdicio"" ADD COLUMN IF NOT EXISTS ""Nota"" TEXT;";
            _context.Database.ExecuteSqlRaw(sql);
            return Ok("Columna Nota agregada a RegistrosDesperdicio");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error agregando columna Nota: {ex.Message}");
        }
    }

    // ==========================================
    // CÓDIGOS DE DESPERDICIO
    // ==========================================

    [HttpGet("codigos")]
    public async Task<ActionResult<IEnumerable<CodigoDesperdicio>>> GetCodigos()
    {
        return await _context.CodigosDesperdicio
            .OrderBy(c => c.Codigo)
            .ToListAsync();
    }

    [HttpGet("codigos/activos")]
    public async Task<ActionResult<IEnumerable<CodigoDesperdicio>>> GetCodigosActivos()
    {
        return await _context.CodigosDesperdicio
            .Where(c => c.Activo)
            .OrderBy(c => c.Codigo)
            .ToListAsync();
    }

    [HttpPost("codigos")]
    public async Task<ActionResult<CodigoDesperdicio>> CrearCodigo(CodigoDesperdicio codigo)
    {
        if (await _context.CodigosDesperdicio.AnyAsync(c => c.Codigo == codigo.Codigo))
        {
            return BadRequest("El código ya existe");
        }

        codigo.FechaCreacion = DateTime.Now;
        _context.CodigosDesperdicio.Add(codigo);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCodigos), new { id = codigo.Id }, codigo);
    }

    [HttpPut("codigos/{id}")]
    public async Task<IActionResult> ActualizarCodigo(int id, CodigoDesperdicio codigo)
    {
        if (id != codigo.Id) return BadRequest();

        var existente = await _context.CodigosDesperdicio.FindAsync(id);
        if (existente == null) return NotFound();

        existente.Codigo = codigo.Codigo;
        existente.Descripcion = codigo.Descripcion;
        existente.Activo = codigo.Activo;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("codigos/{id}")]
    public async Task<IActionResult> EliminarCodigo(int id)
    {
        var codigo = await _context.CodigosDesperdicio.FindAsync(id);
        if (codigo == null) return NotFound();

        // Verificar si tiene registros asociados
        if (await _context.RegistrosDesperdicio.AnyAsync(r => r.CodigoDesperdicioId == id))
        {
            return BadRequest("No se puede eliminar el código porque tiene registros asociados. Inactívelo en su lugar.");
        }

        _context.CodigosDesperdicio.Remove(codigo);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ==========================================
    // REGISTROS DE DESPERDICIO
    // ==========================================

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetRegistros(int? maquinaId, DateTime? fecha, int? usuarioId, string? ordenProduccion, int? codigoDesperdicioId, int? mes, int? anio)
    {
        var query = _context.RegistrosDesperdicio
            .Include(r => r.CodigoDesperdicio)
            .Include(r => r.Usuario)
            .Include(r => r.Maquina)
            .AsQueryable();

        if (maquinaId.HasValue)
        {
            query = query.Where(r => r.MaquinaId == maquinaId.Value);
        }

        // Month/year filter takes priority over exact date
        if (mes.HasValue && anio.HasValue)
        {
            query = query.Where(r => r.Fecha.Month == mes.Value && r.Fecha.Year == anio.Value);
        }
        else if (fecha.HasValue)
        {
            query = query.Where(r => r.Fecha.Date == fecha.Value.Date);
        }

        if (usuarioId.HasValue)
        {
            query = query.Where(r => r.UsuarioId == usuarioId.Value);
        }

        if (codigoDesperdicioId.HasValue)
        {
            query = query.Where(r => r.CodigoDesperdicioId == codigoDesperdicioId.Value);
        }

        if (!string.IsNullOrEmpty(ordenProduccion))
        {
            query = query.Where(r => r.OrdenProduccion != null && r.OrdenProduccion.Contains(ordenProduccion));
        }

        var registros = await query
            .OrderByDescending(r => r.FechaRegistro)
            .Select(r => new
            {
                r.Id,
                r.MaquinaId,
                MaquinaNombre = r.EsTallerExterno ? "Taller Externo" : (r.Maquina != null ? r.Maquina.Nombre : "-"),
                r.UsuarioId,
                UsuarioNombre = r.EsTallerExterno ? "Taller Externo" : (r.Usuario != null ? r.Usuario.Nombre : "-"),
                r.EsTallerExterno,
                r.Fecha,
                r.OrdenProduccion,
                r.CodigoDesperdicioId,
                Codigo = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Codigo : "S/C",
                Descripcion = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Descripcion : "Sin Categoría",
                r.Cantidad,
                r.Nota,
                RegistradoPor = r.RegistradoPor,
                r.FechaRegistro
            })
            .ToListAsync();

        return Ok(registros);
    }

    [HttpGet("relaciones")]
    public async Task<ActionResult<object>> GetRelaciones()
    {
        // Obtener relaciones unicas para filtrado en cascada
        var relaciones = await _context.RegistrosDesperdicio
            .Select(r => new { r.MaquinaId, r.UsuarioId })
            .Distinct()
            .ToListAsync();

        return Ok(relaciones);
    }

    [HttpGet("total")]
    public async Task<ActionResult<decimal>> GetTotalDesperdicio(int maquinaId, DateTime fecha)
    {
        var total = await _context.RegistrosDesperdicio
            .Where(r => r.MaquinaId == maquinaId && r.Fecha.Date == fecha.Date)
            .SumAsync(r => r.Cantidad);

        return Ok(total);
    }

    /// <summary>
    /// Get monthly waste summary grouped by Machine
    /// </summary>
    [HttpGet("resumen-mensual")]
    public async Task<ActionResult<IEnumerable<object>>> GetDesperdicioSummary(
        [FromQuery] int? maquinaId,
        [FromQuery] int? mes,
        [FromQuery] int? anio,
        [FromQuery] int? usuarioId,
        [FromQuery] string? ordenProduccion)
    {
        var query = _context.RegistrosDesperdicio
            .Include(r => r.Maquina)
            .AsQueryable();

        if (mes.HasValue && anio.HasValue)
            query = query.Where(r => r.Fecha.Month == mes.Value && r.Fecha.Year == anio.Value);

        if (maquinaId.HasValue)
            query = query.Where(r => r.MaquinaId == maquinaId.Value);

        if (usuarioId.HasValue)
            query = query.Where(r => r.UsuarioId == usuarioId.Value);

        if (!string.IsNullOrEmpty(ordenProduccion))
            query = query.Where(r => r.OrdenProduccion != null && r.OrdenProduccion.Contains(ordenProduccion));

        var summary = await query
            .GroupBy(t => new { t.MaquinaId, t.EsTallerExterno, MaquinaNombre = t.Maquina != null ? t.Maquina.Nombre : null })
            .Select(g => new
            {
                MaquinaId = g.Key.MaquinaId,
                MaquinaNombre = g.Key.EsTallerExterno ? "Taller Externo" : g.Key.MaquinaNombre,
                Cantidad = g.Sum(r => r.Cantidad)
            })
            .ToListAsync();

        return Ok(summary);
    }

    [HttpGet("reporte")]
    public async Task<ActionResult<Dictionary<string, decimal>>> GetReporteMensual(int maquinaId, int mes, int anio)
    {
        var registros = await _context.RegistrosDesperdicio
            .Where(r => r.MaquinaId == maquinaId && r.Fecha.Month == mes && r.Fecha.Year == anio)
            .ToListAsync();

        // Group by day AND operator for proper per-row distribution
        var reporte = registros
            .GroupBy(r => $"{r.Fecha.Day}_{r.UsuarioId}")
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Cantidad));

        return Ok(reporte);
    }

    /// <summary>
    /// Trazabilidad anual de desperdicio:
    /// - Totales por mes
    /// - Código más crítico por mes
    /// - Top códigos por mes
    /// </summary>
    [HttpGet("trazabilidad-anual")]
    public async Task<ActionResult<object>> GetTrazabilidadAnual([FromQuery] int anio, [FromQuery] int? mesHasta)
    {
        if (anio < 2000 || anio > 2100)
            return BadRequest("Año inválido");
        var mesLimite = mesHasta.HasValue && mesHasta.Value >= 1 && mesHasta.Value <= 12 ? mesHasta.Value : 12;

        var registros = await _context.RegistrosDesperdicio
            .Include(r => r.CodigoDesperdicio)
            .Include(r => r.Maquina)
            .Where(r => r.Fecha.Year == anio && r.Fecha.Month <= mesLimite)
            .ToListAsync();

        var mesesNombres = new[]
        {
            "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        };

        var totalPorMes = Enumerable.Range(1, mesLimite)
            .Select(m =>
            {
                var total = registros.Where(r => r.Fecha.Month == m).Sum(r => r.Cantidad);
                return new
                {
                    mes = m,
                    nombreMes = mesesNombres[m],
                    total
                };
            })
            .ToList();

        var totalAnual = totalPorMes.Sum(x => x.total);
        var mesMasCritico = totalPorMes.OrderByDescending(x => x.total).FirstOrDefault();

        var codigosPorMes = Enumerable.Range(1, mesLimite)
            .Select(m =>
            {
                var topCodigos = registros
                    .Where(r => r.Fecha.Month == m)
                    .GroupBy(r => new
                    {
                        Codigo = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Codigo : "S/C",
                        Descripcion = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Descripcion : "Sin Categoría"
                    })
                    .Select(g => new
                    {
                        codigo = g.Key.Codigo,
                        descripcion = g.Key.Descripcion,
                        total = g.Sum(x => x.Cantidad)
                    })
                    .OrderByDescending(x => x.total)
                    .Take(5)
                    .ToList();

                var codigoMasCritico = topCodigos.FirstOrDefault();

                return new
                {
                    mes = m,
                    nombreMes = mesesNombres[m],
                    totalMes = totalPorMes.First(x => x.mes == m).total,
                    codigoMasCritico,
                    topCodigos
                };
            })
            .ToList();

        var topMaquinasPorMes = Enumerable.Range(1, mesLimite)
            .Select(m =>
            {
                var totalMes = totalPorMes.First(x => x.mes == m).total;
                var topMaquinas = registros
                    .Where(r => r.Fecha.Month == m)
                    .GroupBy(r => new
                    {
                        r.MaquinaId,
                        Nombre = r.EsTallerExterno ? "Taller Externo" : (r.Maquina != null ? r.Maquina.Nombre : "Sin máquina")
                    })
                    .Select(g =>
                    {
                        var total = g.Sum(x => x.Cantidad);
                        return new
                        {
                            maquinaId = g.Key.MaquinaId,
                            maquinaNombre = g.Key.Nombre,
                            total,
                            porcentaje = totalMes > 0
                                ? Math.Round(total / totalMes * 100m, 2)
                                : 0m
                        };
                    })
                    .OrderByDescending(x => x.total)
                    .Take(5)
                    .ToList();

                return new
                {
                    mes = m,
                    nombreMes = mesesNombres[m],
                    totalMes,
                    topMaquinas
                };
            })
            .ToList();

        var codigosAcumulado = registros
            .GroupBy(r => new
            {
                Codigo = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Codigo : "S/C",
                Descripcion = r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Descripcion : "Sin Categoría"
            })
            .Select(g => new
            {
                codigo = g.Key.Codigo,
                descripcion = g.Key.Descripcion,
                total = g.Sum(x => x.Cantidad)
            })
            .OrderByDescending(x => x.total)
            .ToList();

        var codigosTopMatriz = codigosAcumulado.Take(8).ToList();
        var matrizCodigoMes = codigosTopMatriz
            .Select(c => new
            {
                codigo = c.codigo,
                descripcion = c.descripcion,
                valores = Enumerable.Range(1, mesLimite)
                    .Select(m => registros
                        .Where(r =>
                            r.Fecha.Month == m &&
                            (r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Codigo : "S/C") == c.codigo &&
                            (r.CodigoDesperdicio != null ? r.CodigoDesperdicio.Descripcion : "Sin Categoría") == c.descripcion)
                        .Sum(r => r.Cantidad))
                    .ToList()
            })
            .ToList();

        return Ok(new
        {
            anio,
            mesHasta = mesLimite,
            totalAnual,
            mesMasCritico,
            totalPorMes,
            codigosPorMes,
            topMaquinasPorMes,
            codigosAcumulado,
            meses = Enumerable.Range(1, mesLimite)
                .Select(m => new { mes = m, nombreMes = mesesNombres[m] })
                .ToList(),
            matrizCodigoMes
        });
    }

    [HttpPost]
    public async Task<ActionResult<RegistroDesperdicio>> CrearRegistro(RegistroDesperdicio registro)
    {
        registro.FechaRegistro = DateTime.Now;
        if (!string.IsNullOrWhiteSpace(registro.RegistradoPor))
            registro.RegistradoPor = registro.RegistradoPor.Trim();
        _context.RegistrosDesperdicio.Add(registro);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRegistros), new { id = registro.Id }, registro);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> EliminarRegistro(int id)
    {
        var registro = await _context.RegistrosDesperdicio.FindAsync(id);
        if (registro == null) return NotFound();

        _context.RegistrosDesperdicio.Remove(registro);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> ActualizarRegistro(int id, RegistroDesperdicio registro)
    {
        if (id != registro.Id) return BadRequest("ID no coincide");

        var existente = await _context.RegistrosDesperdicio.FindAsync(id);
        if (existente == null) return NotFound();

        existente.MaquinaId = registro.EsTallerExterno ? null : registro.MaquinaId;
        existente.UsuarioId = registro.EsTallerExterno ? null : registro.UsuarioId;
        existente.EsTallerExterno = registro.EsTallerExterno;
        existente.Fecha = registro.Fecha;
        existente.OrdenProduccion = registro.OrdenProduccion;
        existente.CodigoDesperdicioId = registro.CodigoDesperdicioId;
        existente.Cantidad = registro.Cantidad;
        existente.Nota = registro.Nota;

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
