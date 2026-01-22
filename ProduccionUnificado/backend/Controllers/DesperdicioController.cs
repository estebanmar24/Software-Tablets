using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

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
    public async Task<ActionResult<IEnumerable<object>>> GetRegistros(int? maquinaId, DateTime? fecha)
    {
        var query = _context.RegistrosDesperdicio
            .Include(r => r.CodigoDesperdicio)
            .Include(r => r.Usuario)
            .AsQueryable();

        if (maquinaId.HasValue)
        {
            query = query.Where(r => r.MaquinaId == maquinaId.Value);
        }

        if (fecha.HasValue)
        {
            query = query.Where(r => r.Fecha.Date == fecha.Value.Date);
        }

        var registros = await query
            .OrderByDescending(r => r.FechaRegistro)
            .Select(r => new
            {
                r.Id,
                r.MaquinaId,
                r.UsuarioId,
                UsuarioNombre = r.Usuario!.Nombre,
                r.Fecha,
                r.OrdenProduccion,
                r.CodigoDesperdicioId,
                Codigo = r.CodigoDesperdicio!.Codigo,
                Descripcion = r.CodigoDesperdicio!.Descripcion, // Fix warning CS8602 con ! o ?
                r.Cantidad,
                r.FechaRegistro
            })
            .ToListAsync();

        return Ok(registros);
    }

    [HttpGet("total")]
    public async Task<ActionResult<decimal>> GetTotalDesperdicio(int maquinaId, DateTime fecha)
    {
        var total = await _context.RegistrosDesperdicio
            .Where(r => r.MaquinaId == maquinaId && r.Fecha.Date == fecha.Date)
            .SumAsync(r => r.Cantidad);

        return Ok(total);
    }

    [HttpGet("reporte")]
    public async Task<ActionResult<Dictionary<int, decimal>>> GetReporteMensual(int maquinaId, int mes, int anio)
    {
        var registros = await _context.RegistrosDesperdicio
            .Where(r => r.MaquinaId == maquinaId && r.Fecha.Month == mes && r.Fecha.Year == anio)
            .ToListAsync();

        var reporte = registros
            .GroupBy(r => r.Fecha.Day)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Cantidad));

        return Ok(reporte);
    }

    [HttpPost]
    public async Task<ActionResult<RegistroDesperdicio>> CrearRegistro(RegistroDesperdicio registro)
    {
        registro.FechaRegistro = DateTime.Now;
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
}
