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
    public class BitacorasMaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BitacorasMaquinasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BitacoraMaquina>>> GetBitacoras([FromQuery] int? hojaVidaId)
        {
            var query = _context.BitacorasMaquinas.AsQueryable();
            
            if (hojaVidaId.HasValue)
                query = query.Where(b => b.HojaVidaId == hojaVidaId);
                
            return await query.OrderByDescending(b => b.Fecha).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<BitacoraMaquina>> PostBitacora(BitacoraMaquina bitacora)
        {
            bitacora.FechaRegistro = DateTime.UtcNow;

            // Lógica de Consecutivo con Gap Filling por Máquina
            var existentes = await _context.BitacorasMaquinas
                .Where(b => b.HojaVidaId == bitacora.HojaVidaId)
                .Select(b => b.Consecutivo)
                .OrderBy(c => c)
                .ToListAsync();

            int nextConsecutivo = 1;
            foreach (var c in existentes)
            {
                if (c == nextConsecutivo) nextConsecutivo++;
                else if (c > nextConsecutivo) break;
            }
            bitacora.Consecutivo = nextConsecutivo;

            _context.BitacorasMaquinas.Add(bitacora);
            await _context.SaveChangesAsync();
            return Ok(bitacora);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBitacora(int id)
        {
            var bitacora = await _context.BitacorasMaquinas.FindAsync(id);
            if (bitacora == null) return NotFound();
            
            _context.BitacorasMaquinas.Remove(bitacora);
            await _context.SaveChangesAsync();
            await MantenimientoTrazabilidadHelper.RegistrarAsync(_context, HttpContext, "Maquinaria", "Ticket", "Eliminar",
                bitacora.Id, $"Ticket #{bitacora.Consecutivo} eliminado");
            return NoContent();
        }
    }
}
