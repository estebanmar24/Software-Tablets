using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class PublicMaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PublicMaquinasController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/PublicMaquinas/HojaVida/5
        [HttpGet("HojaVida/{id}")]
        public async Task<ActionResult<object>> GetHojaVida(int id)
        {
            var hoja = await _context.HojasVidaMaquinas
                .Include(h => h.Fotos)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (hoja == null)
            {
                return NotFound();
            }

            // También cargamos las bitácoras (tickets) de esta máquina
            var bitacoras = await _context.BitacorasMaquinas
                .Where(b => b.HojaVidaId == id)
                .OrderByDescending(b => b.Fecha)
                .ToListAsync();

            return new
            {
                HojaVida = hoja,
                Bitacoras = bitacoras
            };
        }
    }
}
