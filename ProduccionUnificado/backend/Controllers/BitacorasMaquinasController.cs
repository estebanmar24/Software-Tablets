using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
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
            return NoContent();
        }
    }
}
