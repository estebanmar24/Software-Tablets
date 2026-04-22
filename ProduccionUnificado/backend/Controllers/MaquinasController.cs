using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class MaquinasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MaquinasController(AppDbContext context)
        {
            _context = context;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Maquina>>> GetMaquinas([FromQuery] bool? soloActivas = null)
        {
            var query = _context.Maquinas.AsQueryable();
            
            // Filter by active status if requested
            if (soloActivas == true)
            {
                query = query.Where(m => m.Activo);
            }
            
            // Exclude TERMINADOS
            query = query.Where(m => m.Nombre != null && !m.Nombre.Contains("TERMINADOS"));
            
            var maquinas = await query.ToListAsync();

            // Implementar Natural Sort Order (2A < 10A)
            var resultado = maquinas
                .OrderBy(m => 
                {
                    var match = Regex.Match(m.Nombre ?? "", @"^\d+");
                    return match.Success ? int.Parse(match.Value) : int.MaxValue;
                })
                .ThenBy(m => m.Nombre ?? "")
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

                // Auto-snapshot: create or update the meta snapshot for the CURRENT month
                var now = DateTime.Now;
                var mes = now.Month;
                var anio = now.Year;

                var snapshot = await _context.MetasMensuales
                    .FirstOrDefaultAsync(s => s.MaquinaId == id && s.Mes == mes && s.Anio == anio);

                if (snapshot != null)
                {
                    snapshot.Meta100Porciento = maquina.Meta100Porciento;
                    snapshot.MetaRendimiento = maquina.MetaRendimiento;
                    snapshot.Importancia = maquina.Importancia;
                    snapshot.TirosReferencia = maquina.TirosReferencia;
                    snapshot.ValorPorTiro = maquina.ValorPorTiro;
                    snapshot.Tarifa = maquina.Tarifa;
                }
                else
                {
                    _context.MetasMensuales.Add(new MetaMensual
                    {
                        MaquinaId = id,
                        Mes = mes,
                        Anio = anio,
                        Meta100Porciento = maquina.Meta100Porciento,
                        MetaRendimiento = maquina.MetaRendimiento,
                        Importancia = maquina.Importancia,
                        TirosReferencia = maquina.TirosReferencia,
                        ValorPorTiro = maquina.ValorPorTiro,
                        Tarifa = maquina.Tarifa
                    });
                }

                await _context.SaveChangesAsync();
                Console.WriteLine($"[META SNAPSHOT] Updated snapshot for MaquinaId={id}, {mes}/{anio}");
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
