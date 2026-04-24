using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;

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
                    new CronogramaActividad { Operacion = "Verificar lubricación automática", TipoMantenimiento = "preventivo" },
                    new CronogramaActividad { Operacion = "Limpiar filtros de aire", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Purgar compresor", TipoMantenimiento = "preventivo" },
                    new CronogramaActividad { Operacion = "Limpiar alimentador", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Grasa a bielas", TipoMantenimiento = "preventivo" },
                    new CronogramaActividad { Operacion = "Limpiar aceite", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Limpiar paredes máquina", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Limpiar cremallera y guias", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Lubricar guias y cremallera", TipoMantenimiento = "preventivo" },
                    new CronogramaActividad { Operacion = "Lubricar orificios de fabrica", TipoMantenimiento = "preventivo" },
                    new CronogramaActividad { Operacion = "Limpiar plancha troquel", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Limpiar moretones", TipoMantenimiento = "limpieza" },
                    new CronogramaActividad { Operacion = "Limpiar y lubricar puentes", TipoMantenimiento = "preventivo" }
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
        public async Task<IActionResult> ToggleStatus([FromBody] CronogramaToggleDto req)
        {
            var registro = await _context.CronogramaRegistros
                .FirstOrDefaultAsync(r => r.HojaVidaId == req.HojaVidaId && 
                                          r.ActividadId == req.ActividadId && 
                                          r.Anio == req.Anio && 
                                          r.Mes == req.Mes &&
                                          r.Dia == req.Dia);

            if (registro == null)
            {
                var nuevo = new CronogramaRegistro
                {
                    HojaVidaId = req.HojaVidaId,
                    ActividadId = req.ActividadId,
                    Anio = req.Anio,
                    Mes = req.Mes,
                    Dia = req.Dia,
                    Estado = req.Estado ?? 0
                };
                _context.CronogramaRegistros.Add(nuevo);
            }
            else
            {
                registro.Estado = req.Estado ?? 0;
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
            existing.TipoMantenimiento = act.TipoMantenimiento;
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
