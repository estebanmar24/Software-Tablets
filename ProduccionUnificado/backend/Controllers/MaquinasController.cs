using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MaquinasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Maquina>>> GetMaquinas([FromQuery] bool? soloActivas = null)
        {
            var query = _context.Maquinas.AsQueryable();
            
            // Filter by active status if requested
            if (soloActivas == true)
            {
                query = query.Where(m => m.Activo);
            }
            
            var maquinas = await query.ToListAsync();

            // Implementar Natural Sort Order (2A < 10A)
            var resultado = maquinas
                .OrderBy(m => 
                {
                    var match = Regex.Match(m.Nombre, @"^\d+");
                    return match.Success ? int.Parse(match.Value) : int.MaxValue;
                })
                .ThenBy(m => m.Nombre)
                .ToList();

            return resultado;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Maquina>> GetMaquina(int id)
        {
            var maquina = await _context.Maquinas.FindAsync(id);

            if (maquina == null)
            {
                return NotFound();
            }

            return maquina;
        }

        [HttpPost]
        public async Task<ActionResult<Maquina>> PostMaquina(Maquina maquina)
        {
            _context.Maquinas.Add(maquina);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetMaquina", new { id = maquina.Id }, maquina);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutMaquina(int id, Maquina maquina)
        {
            if (id != maquina.Id)
            {
                return BadRequest();
            }

            _context.Entry(maquina).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Maquinas.Any(e => e.Id == id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMaquina(int id)
        {
            var maquina = await _context.Maquinas.FindAsync(id);
            if (maquina == null)
            {
                return NotFound();
            }

            _context.Maquinas.Remove(maquina);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
