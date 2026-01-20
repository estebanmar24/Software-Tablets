using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TalleresPersonalController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TalleresPersonalController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Talleres_Personal>>> GetPersonal()
        {
            return await _context.Talleres_Personal
                .Where(p => p.Activo)
                .OrderBy(p => p.Nombre)
                .ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<Talleres_Personal>> CreatePersonal(Talleres_Personal personal)
        {
            _context.Talleres_Personal.Add(personal);
            await _context.SaveChangesAsync();
            return CreatedAtAction("GetPersonal", new { id = personal.Id }, personal);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePersonal(int id, Talleres_Personal personal)
        {
            if (id != personal.Id) return BadRequest();

            var existing = await _context.Talleres_Personal.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Nombre = personal.Nombre;
            existing.Cargo = personal.Cargo;
            existing.Salario = personal.Salario;
            
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePersonal(int id)
        {
            var personal = await _context.Talleres_Personal.FindAsync(id);
            if (personal == null) return NotFound();

            personal.Activo = false; // Soft delete
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
