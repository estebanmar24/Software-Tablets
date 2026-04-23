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
    public class CronogramasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CronogramasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("FullData")]
        public async Task<IActionResult> GetFullData([FromQuery] int maquinaId, [FromQuery] int anio)
        {
            // Traer actividades activas
            var actividades = await _context.CronogramaActividades
                .Where(a => a.Activo)
                .OrderBy(a => a.Id)
                .ToListAsync();

            // Si no hay actividades, insertar las del Excel por defecto
            if (actividades.Count == 0)
            {
                var baseActs = new List<CronogramaActividad>
                {
                    new CronogramaActividad { Operacion = "Verificar lubricación automática" },
                    new CronogramaActividad { Operacion = "Limpiar filtros de aire" },
                    new CronogramaActividad { Operacion = "Purgar compresor" },
                    new CronogramaActividad { Operacion = "Limpiar alimentador" },
                    new CronogramaActividad { Operacion = "Grasa a bielas" },
                    new CronogramaActividad { Operacion = "Limpiar aceite" },
                    new CronogramaActividad { Operacion = "Limpiar paredes máquina" },
                    new CronogramaActividad { Operacion = "Limpiar cremallera y guias" },
                    new CronogramaActividad { Operacion = "Lubricar guias y cremallera" },
                    new CronogramaActividad { Operacion = "Lubricar orificios de fabrica" },
                    new CronogramaActividad { Operacion = "Limpiar plancha troquel" },
                    new CronogramaActividad { Operacion = "Limpiar moretones" },
                    new CronogramaActividad { Operacion = "Limpiar y lubricar puentes" }
                };
                _context.CronogramaActividades.AddRange(baseActs);
                await _context.SaveChangesAsync();
                actividades = await _context.CronogramaActividades.Where(a => a.Activo).OrderBy(a => a.Id).ToListAsync();
            }

            // Traer los registros (las marcas del calendario)
            var registros = await _context.CronogramaRegistros
                .Where(r => r.HojaVidaId == maquinaId && r.Anio == anio)
                .ToListAsync();

            return Ok(new { actividades, registros });
        }

        [HttpPost("ToggleStatus")]
        public async Task<IActionResult> ToggleStatus([FromBody] CronogramaRegistro req)
        {
            var registro = await _context.CronogramaRegistros
                .FirstOrDefaultAsync(r => r.HojaVidaId == req.HojaVidaId && 
                                          r.ActividadId == req.ActividadId && 
                                          r.Anio == req.Anio && 
                                          r.Mes == req.Mes);

            if (registro == null)
            {
                // Crear nuevo registro (Estado inicial: 1 = Ejecutado)
                req.Estado = 1;
                _context.CronogramaRegistros.Add(req);
            }
            else
            {
                // Rotar entre 5 estados (1-5) y volver a 0 (Pendiente)
                // 1=E, 2=A, 3=NE, 4=P, 5=I, 0=Pendiente
                registro.Estado = (registro.Estado + 1) % 6;
            }

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("Actividad")]
        public async Task<IActionResult> AddActividad([FromBody] CronogramaActividad act)
        {
            _context.CronogramaActividades.Add(act);
            await _context.SaveChangesAsync();
            return Ok(act);
        }

        [HttpPut("Actividad/{id}")]
        public async Task<IActionResult> UpdateActividad(int id, [FromBody] CronogramaActividad act)
        {
            var existing = await _context.CronogramaActividades.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Operacion = act.Operacion;
            existing.Categoria = act.Categoria;
            existing.Activo = act.Activo;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        [HttpDelete("Actividad/{id}")]
        public async Task<IActionResult> DeleteActividad(int id)
        {
            var existing = await _context.CronogramaActividades.FindAsync(id);
            if (existing == null) return NotFound();

            // En lugar de borrar físicamente (para no romper el historial), podemos marcar como inactivo
            existing.Activo = false; 
            
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
