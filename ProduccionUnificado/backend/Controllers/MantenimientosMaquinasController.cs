using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Helpers;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class MantenimientosMaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MantenimientosMaquinasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<MantenimientoHojaVida>>> GetMantenimientos([FromQuery] int? hojaVidaId)
        {
            var query = _context.MantenimientosHojaVida.Include(m => m.Fotos).AsQueryable();
            
            if (hojaVidaId.HasValue)
                query = query.Where(m => m.HojaVidaId == hojaVidaId);
                
            return await query.OrderByDescending(m => m.Fecha).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<MantenimientoHojaVida>> PostMantenimiento(MantenimientoHojaVida mant)
        {
            mant.FechaRegistro = DateTime.UtcNow;

            // Calcular Consecutivo Reutilizable (Gap Filling) por Máquina
            var existentes = await _context.MantenimientosHojaVida
                .Where(m => m.HojaVidaId == mant.HojaVidaId)
                .Select(m => m.Consecutivo)
                .OrderBy(c => c)
                .ToListAsync();

            int nextConsecutivo = 1;
            foreach (var c in existentes)
            {
                if (c == nextConsecutivo) nextConsecutivo++;
                else if (c > nextConsecutivo) break;
            }
            mant.Consecutivo = nextConsecutivo;
            
            // Asegurar que las IDs de fotos nuevas sean 0
            if (mant.Fotos != null)
            {
                foreach (var foto in mant.Fotos)
                {
                    foto.Id = 0;
                    foto.MantenimientoId = 0;
                }
            }

            _context.MantenimientosHojaVida.Add(mant);
            
            // Si el mantenimiento resuelve un ticket, marcarlo como resuelto
            if (mant.TicketId.HasValue && mant.TicketId > 0)
            {
                var ticket = await _context.BitacorasMaquinas.FindAsync(mant.TicketId.Value);
                if (ticket != null)
                {
                    ticket.Resuelto = true;
                }
            }

            await _context.SaveChangesAsync();
            await MantenimientoTrazabilidadHelper.RegistrarAsync(_context, HttpContext, "Maquinaria", "Mantenimiento", "Crear",
                mant.Id, $"Mantenimiento {mant.TipoMantenimiento} #{mant.Consecutivo} en máquina #{mant.HojaVidaId}",
                new { mant.EjecutadoPor, mant.TicketId });
            return Ok(mant);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutMantenimiento(int id, MantenimientoHojaVida mant)
        {
            if (id != mant.Id) return BadRequest();

            var existente = await _context.MantenimientosHojaVida
                .Include(m => m.Fotos)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (existente == null) return NotFound();

            // Actualizar campos básicos
            _context.Entry(existente).CurrentValues.SetValues(mant);

            // Sincronizar Fotos
            _context.MantenimientoFotos.RemoveRange(existente.Fotos);
            if (mant.Fotos != null)
            {
                foreach (var f in mant.Fotos)
                {
                    existente.Fotos.Add(new MantenimientoFoto { Url = f.Url });
                }
            }

            await _context.SaveChangesAsync();
            await MantenimientoTrazabilidadHelper.RegistrarAsync(_context, HttpContext, "Maquinaria", "Mantenimiento", "Actualizar",
                mant.Id, $"Mantenimiento actualizado: {mant.TipoMantenimiento} #{mant.Consecutivo}");

            // Si al editar se asoció un ticket, marcarlo como resuelto
            if (mant.TicketId.HasValue && mant.TicketId > 0)
            {
                var ticket = await _context.BitacorasMaquinas.FindAsync(mant.TicketId.Value);
                if (ticket != null)
                {
                    ticket.Resuelto = true;
                    await _context.SaveChangesAsync();
                }
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMantenimiento(int id)
        {
            var mant = await _context.MantenimientosHojaVida.FindAsync(id);
            if (mant == null) return NotFound();
            
            _context.MantenimientosHojaVida.Remove(mant);
            await _context.SaveChangesAsync();
            await MantenimientoTrazabilidadHelper.RegistrarAsync(_context, HttpContext, "Maquinaria", "Mantenimiento", "Eliminar",
                mant.Id, $"Mantenimiento eliminado: {mant.TipoMantenimiento} #{mant.Consecutivo}");
            return NoContent();
        }
    }
}
