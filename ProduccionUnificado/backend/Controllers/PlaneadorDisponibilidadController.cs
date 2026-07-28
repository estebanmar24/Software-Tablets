using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/PlaneadorDisponibilidad")]
public class PlaneadorDisponibilidadController : ControllerBase
{
    private readonly AppDbContext _context;

    public PlaneadorDisponibilidadController(AppDbContext context)
    {
        _context = context;
    }

    // ---------- Horarios ----------

    [HttpGet("horarios")]
    public async Task<IActionResult> GetHorarios([FromQuery] bool includeInactive = false)
    {
        var q = _context.Horarios.AsQueryable();
        if (!includeInactive) q = q.Where(h => h.Activo);

        var list = await q
            .OrderBy(h => h.Codigo)
            .ThenBy(h => h.Id)
            .Select(h => new
            {
                h.Id,
                h.Codigo,
                h.Nombre,
                inicio = h.InicioSemana.ToString(@"hh\:mm"),
                fin = h.FinSemana.ToString(@"hh\:mm"),
                inicioSemana = h.InicioSemana.ToString(@"hh\:mm"),
                finSemana = h.FinSemana.ToString(@"hh\:mm"),
                inicioSabado = h.InicioSabado.ToString(@"hh\:mm"),
                finSabado = h.FinSabado.ToString(@"hh\:mm"),
                h.Activo
            })
            .ToListAsync();
        return Ok(list);
    }

    public class HorarioWriteDto
    {
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        /// <summary>Hora inicio (única). Alias: InicioSemana.</summary>
        public string? Inicio { get; set; }
        /// <summary>Hora fin (única). Alias: FinSemana.</summary>
        public string? Fin { get; set; }
        public string? InicioSemana { get; set; }
        public string? FinSemana { get; set; }
        public string? InicioSabado { get; set; }
        public string? FinSabado { get; set; }
        public bool Activo { get; set; } = true;
    }

    private static void ResolveHorarioHoras(HorarioWriteDto dto, out string ini, out string fin)
    {
        ini = (dto.Inicio ?? dto.InicioSemana ?? "").Trim();
        fin = (dto.Fin ?? dto.FinSemana ?? "").Trim();
    }

    [HttpPost("horarios")]
    public async Task<IActionResult> CreateHorario([FromBody] HorarioWriteDto dto)
    {
        if (dto == null) return BadRequest("Datos requeridos.");
        var codigo = (dto.Codigo ?? "").Trim();
        var nombre = (dto.Nombre ?? "").Trim();
        if (string.IsNullOrWhiteSpace(codigo)) return BadRequest("Código requerido.");
        if (string.IsNullOrWhiteSpace(nombre)) return BadRequest("Nombre requerido.");
        ResolveHorarioHoras(dto, out var iniRaw, out var finRaw);
        if (!TryParseHora(iniRaw, out var ini) || !TryParseHora(finRaw, out var fin))
            return BadRequest("Hora inicio/fin inválida (use HH:mm).");
        if (fin <= ini) return BadRequest("La hora fin debe ser posterior al inicio.");

        var dup = await _context.Horarios.AnyAsync(h => h.Activo && h.Codigo == codigo);
        if (dup) return Conflict($"Ya existe un turno activo con código {codigo}.");

        var entity = new Horario
        {
            Codigo = codigo,
            Nombre = nombre,
            InicioSemana = ini,
            FinSemana = fin,
            InicioSabado = ini,
            FinSabado = fin,
            Activo = true
        };
        _context.Horarios.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(MapHorario(entity));
    }

    [HttpPut("horarios/{id:int}")]
    public async Task<IActionResult> UpdateHorario(int id, [FromBody] HorarioWriteDto dto)
    {
        var entity = await _context.Horarios.FindAsync(id);
        if (entity == null) return NotFound("Turno no encontrado.");
        if (dto == null) return BadRequest("Datos requeridos.");

        var codigo = (dto.Codigo ?? "").Trim();
        var nombre = (dto.Nombre ?? "").Trim();
        if (string.IsNullOrWhiteSpace(codigo)) return BadRequest("Código requerido.");
        if (string.IsNullOrWhiteSpace(nombre)) return BadRequest("Nombre requerido.");
        ResolveHorarioHoras(dto, out var iniRaw, out var finRaw);
        if (!TryParseHora(iniRaw, out var ini) || !TryParseHora(finRaw, out var fin))
            return BadRequest("Hora inicio/fin inválida (use HH:mm).");
        if (fin <= ini) return BadRequest("La hora fin debe ser posterior al inicio.");

        var dup = await _context.Horarios.AnyAsync(h => h.Activo && h.Codigo == codigo && h.Id != id);
        if (dup) return Conflict($"Ya existe un turno activo con código {codigo}.");

        entity.Codigo = codigo;
        entity.Nombre = nombre;
        entity.InicioSemana = ini;
        entity.FinSemana = fin;
        entity.InicioSabado = ini;
        entity.FinSabado = fin;
        entity.Activo = dto.Activo;
        await _context.SaveChangesAsync();
        return Ok(MapHorario(entity));
    }

    /// <summary>Baja lógica: deja de aparecer en captura/operarios y roster. No borra histórico.</summary>
    [HttpDelete("horarios/{id:int}")]
    public async Task<IActionResult> DeleteHorario(int id)
    {
        var entity = await _context.Horarios.FindAsync(id);
        if (entity == null) return NotFound("Turno no encontrado.");

        entity.Activo = false;
        var configs = await _context.MaquinaTurnoConfigs.Where(c => c.HorarioId == id).ToListAsync();
        if (configs.Count > 0)
            _context.MaquinaTurnoConfigs.RemoveRange(configs);

        await _context.SaveChangesAsync();
        return Ok(new { id, eliminado = true, mensaje = "Turno desactivado. Ya no aparece para operarios ni en el roster." });
    }

    private static object MapHorario(Horario h) => new
    {
        h.Id,
        h.Codigo,
        h.Nombre,
        inicio = h.InicioSemana.ToString(@"hh\:mm"),
        fin = h.FinSemana.ToString(@"hh\:mm"),
        inicioSemana = h.InicioSemana.ToString(@"hh\:mm"),
        finSemana = h.FinSemana.ToString(@"hh\:mm"),
        inicioSabado = h.InicioSabado.ToString(@"hh\:mm"),
        finSabado = h.FinSabado.ToString(@"hh\:mm"),
        h.Activo
    };

    private static bool TryParseHora(string? raw, out TimeSpan ts)
    {
        ts = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var s = raw.Trim();
        if (TimeSpan.TryParseExact(s, new[] { @"h\:mm", @"hh\:mm", @"h\:mm\:ss", @"hh\:mm\:ss" }, null, out ts))
            return true;
        if (TimeSpan.TryParse(s, out ts)) return true;
        // "6am", "14:00", etc.
        if (DateTime.TryParse(s, out var dt))
        {
            ts = dt.TimeOfDay;
            return true;
        }
        return false;
    }

    // ---------- Config turnos por máquina ----------

    [HttpGet("maquinas/{maquinaId:int}/turnos-config")]
    public async Task<IActionResult> GetTurnosConfig(int maquinaId)
    {
        var rows = await _context.MaquinaTurnoConfigs
            .Include(c => c.Horario)
            .Where(c => c.MaquinaId == maquinaId)
            .OrderBy(c => c.Horario!.Codigo)
            .Select(c => new
            {
                c.Id,
                c.MaquinaId,
                c.HorarioId,
                horarioCodigo = c.Horario != null ? c.Horario.Codigo : "",
                horarioNombre = c.Horario != null ? c.Horario.Nombre : "",
                c.Activo,
                c.RequiereOperario,
                c.AuxiliaresRequeridos
            })
            .ToListAsync();
        return Ok(rows);
    }

    public class TurnoConfigItemDto
    {
        public int HorarioId { get; set; }
        public bool Activo { get; set; } = true;
        public bool RequiereOperario { get; set; } = true;
        public int AuxiliaresRequeridos { get; set; }
    }

    [HttpPut("maquinas/{maquinaId:int}/turnos-config")]
    public async Task<IActionResult> PutTurnosConfig(int maquinaId, [FromBody] List<TurnoConfigItemDto> items)
    {
        var maquina = await _context.Maquinas.FindAsync(maquinaId);
        if (maquina == null) return NotFound("Máquina no encontrada.");

        items ??= new List<TurnoConfigItemDto>();
        // Solo turnos activos y horarios válidos; deduplicar por HorarioId
        var toSave = items
            .Where(i => i.HorarioId > 0 && i.Activo)
            .GroupBy(i => i.HorarioId)
            .Select(g => g.Last())
            .ToList();

        var horarioIds = toSave.Select(i => i.HorarioId).ToList();
        if (horarioIds.Count > 0)
        {
            var valid = await _context.Horarios
                .Where(h => h.Activo && horarioIds.Contains(h.Id))
                .Select(h => h.Id)
                .ToListAsync();
            toSave = toSave.Where(i => valid.Contains(i.HorarioId)).ToList();
        }

        var existentes = await _context.MaquinaTurnoConfigs
            .Where(c => c.MaquinaId == maquinaId)
            .ToListAsync();
        if (existentes.Count > 0)
        {
            _context.MaquinaTurnoConfigs.RemoveRange(existentes);
            await _context.SaveChangesAsync();
        }

        foreach (var item in toSave)
        {
            _context.MaquinaTurnoConfigs.Add(new MaquinaTurnoConfig
            {
                MaquinaId = maquinaId,
                HorarioId = item.HorarioId,
                Activo = true,
                RequiereOperario = item.RequiereOperario,
                AuxiliaresRequeridos = Math.Max(0, item.AuxiliaresRequeridos)
            });
        }

        await _context.SaveChangesAsync();
        return await GetTurnosConfig(maquinaId);
    }

    [HttpPut("maquinas/{maquinaId:int}/estado-operativo")]
    public async Task<IActionResult> PutEstadoOperativo(int maquinaId, [FromBody] EstadoOperativoDto dto)
    {
        var maquina = await _context.Maquinas.FindAsync(maquinaId);
        if (maquina == null) return NotFound("Máquina no encontrada.");

        var estado = (dto.EstadoOperativo ?? "Operativa").Trim();
        var allowed = new[] { "Operativa", "Dañada", "Mantenimiento" };
        if (!allowed.Contains(estado, StringComparer.OrdinalIgnoreCase))
            return BadRequest("EstadoOperativo inválido. Use Operativa | Dañada | Mantenimiento.");

        maquina.EstadoOperativo = allowed.First(a => a.Equals(estado, StringComparison.OrdinalIgnoreCase));
        await _context.SaveChangesAsync();
        return Ok(new { maquina.Id, maquina.Nombre, maquina.EstadoOperativo, activo = maquina.Activo });
    }

    public class EstadoOperativoDto
    {
        public string EstadoOperativo { get; set; } = "Operativa";
    }

    // ---------- Roster semanal ----------

    [HttpGet("roster")]
    public async Task<IActionResult> GetRoster([FromQuery] string semanaInicio)
    {
        if (!TryParseSemanaRoster(semanaInicio, out var sabado, out var sabadoFin))
            return BadRequest("semanaInicio inválida. Use YYYY-MM-DD (lunes de inicio de semana).");

        var anio = ISOWeek.GetYear(sabado);
        var semana = ISOWeek.GetWeekOfYear(sabado);

        var asignaciones = await _context.RosterAsignaciones
            .Include(a => a.Usuario)
            .Include(a => a.Horario)
            .Include(a => a.Maquina)
            .Where(a => a.FechaDia >= sabado && a.FechaDia <= sabadoFin)
            .OrderBy(a => a.FechaDia)
            .ThenBy(a => a.MaquinaId)
            .ThenBy(a => a.HorarioId)
            .ThenBy(a => a.EsAuxiliar)
            .Select(a => new
            {
                a.Id,
                a.Anio,
                a.SemanaIso,
                fechaDia = a.FechaDia.ToString("yyyy-MM-dd"),
                a.MaquinaId,
                maquinaNombre = a.Maquina != null ? a.Maquina.Nombre : "",
                a.HorarioId,
                horarioCodigo = a.Horario != null ? a.Horario.Codigo : "",
                horarioNombre = a.Horario != null ? a.Horario.Nombre : "",
                a.UsuarioId,
                usuarioNombre = a.Usuario != null ? a.Usuario.Nombre : "",
                a.EsAuxiliar,
                horaInicio = a.HoraInicio.HasValue ? a.HoraInicio.Value.ToString(@"hh\:mm") : null,
                horaFin = a.HoraFin.HasValue ? a.HoraFin.Value.ToString(@"hh\:mm") : null,
                a.EsDescanso,
                a.DescuentaComida,
                a.MinutosComida
            })
            .ToListAsync();

        var turnosDia = await _context.RosterTurnoDias
            .Include(t => t.Horario)
            .Where(t => t.FechaDia >= sabado && t.FechaDia <= sabadoFin)
            .Select(t => new
            {
                t.Id,
                fechaDia = t.FechaDia.ToString("yyyy-MM-dd"),
                t.MaquinaId,
                t.HorarioId,
                horarioCodigo = t.Horario != null ? t.Horario.Codigo : "",
                horarioNombre = t.Horario != null ? t.Horario.Nombre : "",
                t.Incluir
            })
            .ToListAsync();

        var diasFestivos = await _context.RosterDiasFestivos
            .Where(f => f.FechaDia >= sabado && f.FechaDia <= sabadoFin)
            .OrderBy(f => f.FechaDia)
            .Select(f => new
            {
                fechaDia = f.FechaDia.ToString("yyyy-MM-dd"),
                f.Observacion
            })
            .ToListAsync();

        return Ok(new
        {
            semanaInicio = sabado.ToString("yyyy-MM-dd"),
            semanaFin = sabadoFin.ToString("yyyy-MM-dd"),
            anio,
            semanaIso = semana,
            asignaciones,
            turnosDia,
            diasFestivos
        });
    }

    public class DiaFestivoDto
    {
        public string FechaDia { get; set; } = "";
        public bool Festivo { get; set; }
        public string? Observacion { get; set; }
    }

    /// <summary>Marca o desmarca un día como festivo (persistido por fecha).</summary>
    [HttpPut("roster/dias-festivos")]
    public async Task<IActionResult> PutDiaFestivo([FromBody] DiaFestivoDto dto)
    {
        if (dto == null || !DateTime.TryParse(dto.FechaDia, out var diaRaw))
            return BadRequest("fechaDia inválida.");
        var dia = diaRaw.Date;

        var existente = await _context.RosterDiasFestivos.FirstOrDefaultAsync(f => f.FechaDia == dia);
        if (dto.Festivo)
        {
            var obs = string.IsNullOrWhiteSpace(dto.Observacion) ? null : dto.Observacion.Trim();
            if (existente == null)
            {
                _context.RosterDiasFestivos.Add(new RosterDiaFestivo
                {
                    FechaDia = dia,
                    Observacion = obs
                });
            }
            else
            {
                existente.Observacion = obs;
            }
        }
        else if (existente != null)
        {
            _context.RosterDiasFestivos.Remove(existente);
        }

        await _context.SaveChangesAsync();
        return Ok(new
        {
            fechaDia = dia.ToString("yyyy-MM-dd"),
            festivo = dto.Festivo,
            observacion = dto.Festivo ? (dto.Observacion ?? "").Trim() : null
        });
    }

    public class TurnoDiaDto
    {
        public string FechaDia { get; set; } = "";
        public int MaquinaId { get; set; }
        public int HorarioId { get; set; }
        /// <summary>true = agregar solo ese día; false = quitar solo ese día.</summary>
        public bool Incluir { get; set; }
    }

    /// <summary>Upsert excepción de turno para un día (agregar o quitar personalizado).</summary>
    [HttpPut("roster/turnos-dia")]
    public async Task<IActionResult> UpsertTurnoDia([FromBody] TurnoDiaDto dto)
    {
        if (dto == null || !DateTime.TryParse(dto.FechaDia, out var diaRaw))
            return BadRequest("fechaDia inválida.");
        if (dto.MaquinaId <= 0 || dto.HorarioId <= 0)
            return BadRequest("maquinaId y horarioId requeridos.");

        var dia = diaRaw.Date;
        var existente = await _context.RosterTurnoDias
            .FirstOrDefaultAsync(t => t.FechaDia == dia && t.MaquinaId == dto.MaquinaId && t.HorarioId == dto.HorarioId);

        if (existente != null)
        {
            existente.Incluir = dto.Incluir;
        }
        else
        {
            _context.RosterTurnoDias.Add(new RosterTurnoDia
            {
                FechaDia = dia,
                MaquinaId = dto.MaquinaId,
                HorarioId = dto.HorarioId,
                Incluir = dto.Incluir
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new
        {
            fechaDia = dia.ToString("yyyy-MM-dd"),
            dto.MaquinaId,
            dto.HorarioId,
            dto.Incluir
        });
    }

    /// <summary>Quita la excepción: el día vuelve al config base de la máquina.</summary>
    [HttpDelete("roster/turnos-dia")]
    public async Task<IActionResult> DeleteTurnoDia(
        [FromQuery] string fechaDia,
        [FromQuery] int maquinaId,
        [FromQuery] int horarioId)
    {
        if (!DateTime.TryParse(fechaDia, out var diaRaw))
            return BadRequest("fechaDia inválida.");
        var dia = diaRaw.Date;
        var row = await _context.RosterTurnoDias
            .FirstOrDefaultAsync(t => t.FechaDia == dia && t.MaquinaId == maquinaId && t.HorarioId == horarioId);
        if (row == null) return NoContent();
        _context.RosterTurnoDias.Remove(row);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    public class RosterAsignacionDto
    {
        public string FechaDia { get; set; } = "";
        public int MaquinaId { get; set; }
        public int HorarioId { get; set; }
        public int UsuarioId { get; set; }
        public bool EsAuxiliar { get; set; }
        public string? HoraInicio { get; set; }
        public string? HoraFin { get; set; }
        public bool EsDescanso { get; set; }
        public bool DescuentaComida { get; set; }
        public int MinutosComida { get; set; }
    }

    public class RosterPutDto
    {
        public string SemanaInicio { get; set; } = "";
        public List<RosterAsignacionDto> Asignaciones { get; set; } = new();
    }

    [HttpPut("roster")]
    public async Task<IActionResult> PutRoster([FromBody] RosterPutDto dto)
    {
        if (dto == null || !TryParseSemanaRoster(dto.SemanaInicio, out var sabado, out var sabadoFin))
            return BadRequest("semanaInicio inválida. Use YYYY-MM-DD (lunes de inicio de semana).");

        var anio = ISOWeek.GetYear(sabado);
        var semana = ISOWeek.GetWeekOfYear(sabado);

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var existentes = await _context.RosterAsignaciones
                .Where(a => a.FechaDia >= sabado && a.FechaDia <= sabadoFin)
                .ToListAsync();
            _context.RosterAsignaciones.RemoveRange(existentes);
            // Borrar primero evita violar IX_RosterAsignaciones_Dia_Maq_Hor_Usr al reinsertar filas iguales.
            await _context.SaveChangesAsync();

            var seen = new HashSet<string>();
            foreach (var item in dto.Asignaciones ?? new List<RosterAsignacionDto>())
            {
                if (!DateTime.TryParse(item.FechaDia, out var diaRaw)) continue;
                var dia = diaRaw.Date;
                if (dia < sabado || dia > sabadoFin) continue;
                if (item.MaquinaId <= 0 || item.HorarioId <= 0 || item.UsuarioId <= 0) continue;

                var key = $"{dia:yyyy-MM-dd}|{item.MaquinaId}|{item.HorarioId}|{item.UsuarioId}";
                if (!seen.Add(key)) continue;

                TimeSpan? horaInicio = null;
                TimeSpan? horaFin = null;
                if (!string.IsNullOrWhiteSpace(item.HoraInicio) && TryParseHora(item.HoraInicio, out var hi))
                    horaInicio = hi;
                if (!string.IsNullOrWhiteSpace(item.HoraFin) && TryParseHora(item.HoraFin, out var hf))
                    horaFin = hf;

                _context.RosterAsignaciones.Add(new RosterAsignacion
                {
                    Anio = anio,
                    SemanaIso = semana,
                    FechaDia = dia,
                    MaquinaId = item.MaquinaId,
                    HorarioId = item.HorarioId,
                    UsuarioId = item.UsuarioId,
                    EsAuxiliar = item.EsAuxiliar,
                    HoraInicio = horaInicio,
                    HoraFin = horaFin,
                    EsDescanso = item.EsDescanso,
                    DescuentaComida = item.DescuentaComida,
                    MinutosComida = Math.Max(0, item.MinutosComida),
                });
            }

            await _context.SaveChangesAsync();
            await SyncTurnosConfigFromRosterAsync(sabado, sabadoFin);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await GetRoster(sabado.ToString("yyyy-MM-dd"));
    }

    [HttpPost("roster/copiar-semana")]
    public async Task<IActionResult> CopiarSemanaAnterior([FromBody] RosterPutDto dto)
    {
        if (dto == null || !TryParseSemanaRoster(dto.SemanaInicio, out var sabado, out var sabadoFin))
            return BadRequest("semanaInicio inválida.");

        var prevSabado = sabado.AddDays(-7);
        var prevSabadoFin = prevSabado.AddDays(6);
        var prev = await _context.RosterAsignaciones
            .Where(a => a.FechaDia >= prevSabado && a.FechaDia <= prevSabadoFin)
            .ToListAsync();

        if (prev.Count == 0)
            return Ok(new { mensaje = "La semana anterior no tiene asignaciones.", copiadas = 0 });

        var anio = ISOWeek.GetYear(sabado);
        var semana = ISOWeek.GetWeekOfYear(sabado);
        var delta = (sabado - prevSabado).Days;

        var existentes = await _context.RosterAsignaciones
            .Where(a => a.FechaDia >= sabado && a.FechaDia <= sabadoFin)
            .ToListAsync();
        _context.RosterAsignaciones.RemoveRange(existentes);
        await _context.SaveChangesAsync();

        var seenCopia = new HashSet<string>();
        foreach (var a in prev)
        {
            var dia = a.FechaDia.AddDays(delta);
            var key = $"{dia:yyyy-MM-dd}|{a.MaquinaId}|{a.HorarioId}|{a.UsuarioId}";
            if (!seenCopia.Add(key)) continue;

            _context.RosterAsignaciones.Add(new RosterAsignacion
            {
                Anio = anio,
                SemanaIso = semana,
                FechaDia = dia,
                MaquinaId = a.MaquinaId,
                HorarioId = a.HorarioId,
                UsuarioId = a.UsuarioId,
                EsAuxiliar = a.EsAuxiliar,
                HoraInicio = a.HoraInicio,
                HoraFin = a.HoraFin,
                EsDescanso = a.EsDescanso,
                DescuentaComida = a.DescuentaComida,
                MinutosComida = a.MinutosComida,
            });
        }

        await _context.SaveChangesAsync();
        return await GetRoster(sabado.ToString("yyyy-MM-dd"));
    }

    // ---------- Novedades ----------

    [HttpGet("personal/novedades")]
    public async Task<IActionResult> GetNovedades(
        [FromQuery] string? desde = null,
        [FromQuery] string? hasta = null)
    {
        var q = _context.PersonalNovedades.Include(n => n.Usuario).AsQueryable();

        if (DateTime.TryParse(desde, out var d0))
            q = q.Where(n => n.FechaFin >= d0.Date);
        if (DateTime.TryParse(hasta, out var d1))
            q = q.Where(n => n.FechaInicio <= d1.Date);

        var list = await q
            .OrderByDescending(n => n.FechaInicio)
            .Take(200)
            .Select(n => new
            {
                n.Id,
                n.UsuarioId,
                usuarioNombre = n.Usuario != null ? n.Usuario.Nombre : "",
                n.Tipo,
                fechaInicio = n.FechaInicio.ToString("yyyy-MM-dd"),
                fechaFin = n.FechaFin.ToString("yyyy-MM-dd"),
                n.Observacion,
                n.MedioDia,
                n.Jornada
            })
            .ToListAsync();
        return Ok(list);
    }

    public class NovedadDto
    {
        public int UsuarioId { get; set; }
        public string Tipo { get; set; } = "falta";
        public string FechaInicio { get; set; } = "";
        public string FechaFin { get; set; } = "";
        public string? Observacion { get; set; }
        public bool MedioDia { get; set; }
        /// <summary>manana | tarde (solo si MedioDia).</summary>
        public string? Jornada { get; set; }
    }

    [HttpPost("personal/novedades")]
    public async Task<IActionResult> PostNovedad([FromBody] NovedadDto dto)
    {
        if (dto.UsuarioId <= 0) return BadRequest("UsuarioId requerido.");
        if (!DateTime.TryParse(dto.FechaInicio, out var fi) || !DateTime.TryParse(dto.FechaFin, out var ff))
            return BadRequest("Fechas inválidas.");
        if (ff.Date < fi.Date) return BadRequest("FechaFin debe ser >= FechaInicio.");

        var tipo = (dto.Tipo ?? "falta").Trim().ToLowerInvariant();
        var allowed = new[] { "incapacidad", "falta", "permiso", "baja" };
        if (!allowed.Contains(tipo)) return BadRequest("Tipo inválido.");

        string? jornada = null;
        if (dto.MedioDia)
        {
            jornada = (dto.Jornada ?? "").Trim().ToLowerInvariant();
            if (jornada is not ("manana" or "tarde"))
                return BadRequest("Para medio día indique jornada: manana o tarde.");
        }

        var user = await _context.Usuarios.FindAsync(dto.UsuarioId);
        if (user == null) return NotFound("Usuario no encontrado.");

        var entity = new PersonalNovedad
        {
            UsuarioId = dto.UsuarioId,
            Tipo = tipo,
            FechaInicio = fi.Date,
            FechaFin = ff.Date,
            Observacion = dto.Observacion,
            MedioDia = dto.MedioDia,
            Jornada = jornada
        };
        _context.PersonalNovedades.Add(entity);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            entity.Id,
            entity.UsuarioId,
            usuarioNombre = user.Nombre,
            entity.Tipo,
            fechaInicio = entity.FechaInicio.ToString("yyyy-MM-dd"),
            fechaFin = entity.FechaFin.ToString("yyyy-MM-dd"),
            entity.Observacion,
            entity.MedioDia,
            entity.Jornada
        });
    }

    [HttpDelete("personal/novedades/{id:int}")]
    public async Task<IActionResult> DeleteNovedad(int id)
    {
        var entity = await _context.PersonalNovedades.FindAsync(id);
        if (entity == null) return NotFound();
        _context.PersonalNovedades.Remove(entity);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Avisos de disponibilidad ----------

    [HttpGet("disponibilidad/avisos")]
    public async Task<IActionResult> GetAvisos(
        [FromQuery] int maquinaId,
        [FromQuery] string inicio,
        [FromQuery] string fin)
    {
        if (maquinaId <= 0) return BadRequest("maquinaId requerido.");
        if (!DateTime.TryParse(inicio, out var inicioDt) || !DateTime.TryParse(fin, out var finDt))
            return BadRequest("inicio/fin inválidos.");
        if (finDt <= inicioDt)
            return Ok(new { avisos = Array.Empty<object>() });

        var avisos = await BuildAvisosAsync(maquinaId, inicioDt, finDt);
        return Ok(new { avisos });
    }

    private async Task<List<object>> BuildAvisosAsync(int maquinaId, DateTime inicioDt, DateTime finDt)
    {
        var result = new List<object>();
        var maquina = await _context.Maquinas.FindAsync(maquinaId);
        if (maquina == null)
        {
            result.Add(new { codigo = "maquina_no_encontrada", mensaje = "Máquina no encontrada." });
            return result;
        }

        var nombreMaq = maquina.Nombre ?? $"#{maquinaId}";
        if (!maquina.Activo)
        {
            result.Add(new
            {
                codigo = "maquina_inactiva",
                mensaje = $"Máquina {nombreMaq} está inactiva."
            });
        }

        var estado = string.IsNullOrWhiteSpace(maquina.EstadoOperativo) ? "Operativa" : maquina.EstadoOperativo;
        if (!estado.Equals("Operativa", StringComparison.OrdinalIgnoreCase))
        {
            result.Add(new
            {
                codigo = "maquina_no_operativa",
                mensaje = $"Máquina {nombreMaq} en estado {estado}."
            });
        }

        var configs = await _context.MaquinaTurnoConfigs
            .Include(c => c.Horario)
            .Where(c => c.MaquinaId == maquinaId && c.Activo)
            .ToListAsync();

        var horariosAll = await _context.Horarios.Where(h => h.Activo).ToListAsync();
        var diaInicio = inicioDt.Date;
        var diaFin = finDt.Date;
        if (finDt.TimeOfDay == TimeSpan.Zero && finDt > inicioDt)
            diaFin = finDt.Date.AddDays(-1);

        var overrides = await _context.RosterTurnoDias
            .Where(t => t.MaquinaId == maquinaId && t.FechaDia >= diaInicio && t.FechaDia <= diaFin)
            .ToListAsync();

        for (var dia = diaInicio; dia <= diaFin; dia = dia.AddDays(1))
        {
            var dayStart = dia;
            var dayEnd = dia.AddDays(1);
            var segStart = inicioDt > dayStart ? inicioDt : dayStart;
            var segEnd = finDt < dayEnd ? finDt : dayEnd;
            if (segEnd <= segStart) continue;

            var (fromTod, toTod) = DaySegmentToTimeOfDay(dia, segStart, segEnd);
            var overlapping = FindOverlappingHorarios(horariosAll, dia, fromTod, toTod);
            if (overlapping.Count == 0)
            {
                result.Add(new
                {
                    codigo = "fuera_horario_estandar",
                    mensaje = $"{nombreMaq}: {dia:yyyy-MM-dd} {segStart:HH:mm}-{segEnd:HH:mm} no solapa con ningún turno del catálogo."
                });
                continue;
            }

            // Turnos efectivos del día = config máquina ± excepciones del día
            var baseIds = configs.Count > 0
                ? configs.Select(c => c.HorarioId).ToHashSet()
                : new HashSet<int>();
            var excl = overrides.Where(o => o.FechaDia == dia && !o.Incluir).Select(o => o.HorarioId).ToHashSet();
            var add = overrides.Where(o => o.FechaDia == dia && o.Incluir).Select(o => o.HorarioId).ToHashSet();
            var effectiveIds = baseIds.Where(id => !excl.Contains(id)).Concat(add).ToHashSet();

            if (configs.Count > 0 || excl.Count > 0 || add.Count > 0)
            {
                var fuera = overlapping.Where(h => !effectiveIds.Contains(h.Id)).ToList();
                foreach (var h in fuera)
                {
                    result.Add(new
                    {
                        codigo = "horario_fuera_config",
                        mensaje = $"{nombreMaq}: {dia:yyyy-MM-dd} cae en {h.Nombre} no habilitado ese día."
                    });
                }

                overlapping = overlapping.Where(h => effectiveIds.Contains(h.Id)).ToList();
            }

            foreach (var horario in overlapping)
            {
                var cfg = configs.FirstOrDefault(c => c.HorarioId == horario.Id);
                var requiereOp = cfg?.RequiereOperario ?? true;
                var auxReq = cfg?.AuxiliaresRequeridos ?? 0;

                var asignacionesDia = await _context.RosterAsignaciones
                    .Include(a => a.Usuario)
                    .Where(a => a.FechaDia == dia && a.MaquinaId == maquinaId && a.HorarioId == horario.Id)
                    .ToListAsync();

                var operarios = asignacionesDia.Where(a => !a.EsAuxiliar).ToList();
                var auxiliares = asignacionesDia.Where(a => a.EsAuxiliar).ToList();

                if (requiereOp && operarios.Count == 0)
                {
                    result.Add(new
                    {
                        codigo = "sin_operario",
                        mensaje = $"{nombreMaq}: sin operario en roster para {horario.Nombre} el {dia:yyyy-MM-dd}."
                    });
                }

                foreach (var op in operarios)
                {
                    var novedad = await FindNovedadAfectaAsync(op.UsuarioId, dia, horario);
                    if (novedad != null)
                    {
                        var nom = op.Usuario?.Nombre ?? $"#{op.UsuarioId}";
                        result.Add(new
                        {
                            codigo = "operario_con_novedad",
                            mensaje = $"{nombreMaq}: {nom} tiene {DescribeNovedad(novedad)} el {dia:yyyy-MM-dd} ({horario.Nombre}).",
                            usuarioId = op.UsuarioId,
                            usuarioNombre = nom,
                            tipoNovedad = novedad.Tipo,
                            medioDia = novedad.MedioDia,
                            jornada = novedad.Jornada,
                            fechaDia = dia.ToString("yyyy-MM-dd"),
                            horarioId = horario.Id,
                            horarioNombre = horario.Nombre
                        });
                    }
                }

                if (auxReq > 0 && auxiliares.Count < auxReq)
                {
                    result.Add(new
                    {
                        codigo = "falta_auxiliar",
                        mensaje = $"{nombreMaq}: faltan auxiliares en {horario.Nombre} el {dia:yyyy-MM-dd} (tiene {auxiliares.Count}, requiere {auxReq})."
                    });
                }

                foreach (var aux in auxiliares)
                {
                    var novedad = await FindNovedadAfectaAsync(aux.UsuarioId, dia, horario);
                    if (novedad != null)
                    {
                        var nom = aux.Usuario?.Nombre ?? $"#{aux.UsuarioId}";
                        result.Add(new
                        {
                            codigo = "auxiliar_con_novedad",
                            mensaje = $"{nombreMaq}: auxiliar {nom} tiene {DescribeNovedad(novedad)} el {dia:yyyy-MM-dd}.",
                            usuarioId = aux.UsuarioId,
                            usuarioNombre = nom,
                            tipoNovedad = novedad.Tipo,
                            medioDia = novedad.MedioDia,
                            jornada = novedad.Jornada,
                            fechaDia = dia.ToString("yyyy-MM-dd"),
                            horarioId = horario.Id,
                            horarioNombre = horario.Nombre
                        });
                    }
                }
            }
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var unique = new List<object>();
        foreach (var a in result)
        {
            var msg = a.GetType().GetProperty("mensaje")?.GetValue(a)?.ToString() ?? "";
            if (string.IsNullOrEmpty(msg) || seen.Add(msg))
                unique.Add(a);
        }
        return unique;
    }

    /// <summary>Resumen máquina ↔ turnos ↔ operarios para el tramo (usado al programar OP).</summary>
    [HttpGet("disponibilidad/cobertura")]
    public async Task<IActionResult> GetCobertura(
        [FromQuery] int maquinaId,
        [FromQuery] string inicio,
        [FromQuery] string fin)
    {
        if (maquinaId <= 0) return BadRequest("maquinaId requerido.");
        if (!DateTime.TryParse(inicio, out var inicioDt) || !DateTime.TryParse(fin, out var finDt))
            return BadRequest("inicio/fin inválidos.");
        if (finDt <= inicioDt)
            return Ok(new { maquinaId, turnos = Array.Empty<object>() });

        var maquina = await _context.Maquinas.FindAsync(maquinaId);
        if (maquina == null) return NotFound("Máquina no encontrada.");

        var allMaquinas = await _context.Maquinas.Where(m => m.Activo).AsNoTracking().ToListAsync();
        var rosterMaquinaIds = RosterProcesoMaquinaHelper.RosterMaquinaIdsRelacionados(maquinaId, allMaquinas).ToList();

        var configs = await _context.MaquinaTurnoConfigs
            .Include(c => c.Horario)
            .Where(c => c.MaquinaId == maquinaId && c.Activo)
            .ToListAsync();

        var horariosAll = await _context.Horarios.Where(h => h.Activo).ToListAsync();
        var diaInicio = inicioDt.Date;
        var diaFin = finDt.Date;
        if (finDt.TimeOfDay == TimeSpan.Zero && finDt > inicioDt)
            diaFin = finDt.Date.AddDays(-1);

        var overrides = await _context.RosterTurnoDias
            .Where(t => t.MaquinaId == maquinaId && t.FechaDia >= diaInicio && t.FechaDia <= diaFin)
            .ToListAsync();

        var allAsignaciones = await _context.RosterAsignaciones
            .Include(a => a.Usuario)
            .Include(a => a.Horario)
            .Where(a => rosterMaquinaIds.Contains(a.MaquinaId) && a.FechaDia >= diaInicio && a.FechaDia <= diaFin)
            .ToListAsync();

        var turnos = new List<object>();
        var customSlots = new HashSet<string>();

        for (var dia = diaInicio; dia <= diaFin; dia = dia.AddDays(1))
        {
            var dayStart = dia;
            var dayEnd = dia.AddDays(1);
            var segStart = inicioDt > dayStart ? inicioDt : dayStart;
            var segEnd = finDt < dayEnd ? finDt : dayEnd;
            if (segEnd <= segStart) continue;

            // Turnos planificados en Horarios (HoraInicio/HoraFin por celda).
            var customGroups = allAsignaciones
                .Where(a => a.FechaDia == dia && !a.EsAuxiliar && !a.EsDescanso
                    && a.HoraInicio.HasValue && a.HoraFin.HasValue)
                .GroupBy(a => new { a.HoraInicio, a.HoraFin, a.HorarioId });

            foreach (var grp in customGroups)
            {
                var first = grp.First();
                var iniTs = first.HoraInicio!.Value;
                var finTs = first.HoraFin!.Value;
                if (finTs <= iniTs) continue;
                if (!SegmentOverlapsTimeOfDay(segStart, segEnd, iniTs, finTs)) continue;

                var slotKey = $"{dia:yyyy-MM-dd}|{iniTs}|{finTs}|{first.HorarioId}";
                if (!customSlots.Add(slotKey)) continue;

                var horarioRef = first.Horario ?? horariosAll.FirstOrDefault(h => h.Id == first.HorarioId);
                var cfgCustom = configs.FirstOrDefault(c => c.HorarioId == first.HorarioId);
                var personasCustom = new List<object>();
                foreach (var a in grp)
                {
                    var nov = horarioRef != null
                        ? await FindNovedadAfectaAsync(a.UsuarioId, dia, horarioRef)
                        : null;
                    personasCustom.Add(new
                    {
                        a.UsuarioId,
                        nombre = a.Usuario?.Nombre ?? $"#{a.UsuarioId}",
                        esAuxiliar = false,
                        novedad = nov == null ? null : new
                        {
                            nov.Tipo,
                            nov.MedioDia,
                            nov.Jornada,
                            label = DescribeNovedad(nov)
                        }
                    });
                }

                turnos.Add(new
                {
                    fechaDia = dia.ToString("yyyy-MM-dd"),
                    horarioId = first.HorarioId,
                    codigo = horarioRef?.Codigo ?? "PLAN",
                    nombre = horarioRef?.Nombre ?? "Horario planificado",
                    inicio = FormatHoraTimeSpan(iniTs),
                    fin = FormatHoraTimeSpan(finTs),
                    requiereOperario = cfgCustom?.RequiereOperario ?? true,
                    auxiliaresRequeridos = cfgCustom?.AuxiliaresRequeridos ?? 0,
                    sinOperario = !personasCustom.Any(),
                    personas = personasCustom
                });
            }

            var (fromTod, toTod) = DaySegmentToTimeOfDay(dia, segStart, segEnd);
            var overlapping = FindOverlappingHorarios(horariosAll, dia, fromTod, toTod);

            var baseIds = configs.Count > 0
                ? configs.Select(c => c.HorarioId).ToHashSet()
                : new HashSet<int>();
            var excl = overrides.Where(o => o.FechaDia == dia && !o.Incluir).Select(o => o.HorarioId).ToHashSet();
            var add = overrides.Where(o => o.FechaDia == dia && o.Incluir).Select(o => o.HorarioId).ToHashSet();
            var effectiveIds = baseIds.Where(id => !excl.Contains(id)).Concat(add).ToHashSet();
            overlapping = overlapping.Where(h => effectiveIds.Contains(h.Id)).ToList();

            foreach (var horario in overlapping)
            {
                var cfg = configs.FirstOrDefault(c => c.HorarioId == horario.Id);
                var asignacionesDia = allAsignaciones
                    .Where(a => a.FechaDia == dia && a.HorarioId == horario.Id
                        && !(a.HoraInicio.HasValue && a.HoraFin.HasValue && !a.EsDescanso))
                    .ToList();

                var (rangoIni, rangoFin) = HorarioRangoDia(horario, dia);
                var personas = new List<object>();
                foreach (var a in asignacionesDia)
                {
                    if (a.EsDescanso) continue;
                    var nov = await FindNovedadAfectaAsync(a.UsuarioId, dia, horario);
                    personas.Add(new
                    {
                        a.UsuarioId,
                        nombre = a.Usuario?.Nombre ?? $"#{a.UsuarioId}",
                        esAuxiliar = a.EsAuxiliar,
                        novedad = nov == null ? null : new
                        {
                            nov.Tipo,
                            nov.MedioDia,
                            nov.Jornada,
                            label = DescribeNovedad(nov)
                        }
                    });
                }

                turnos.Add(new
                {
                    fechaDia = dia.ToString("yyyy-MM-dd"),
                    horarioId = horario.Id,
                    codigo = horario.Codigo,
                    nombre = horario.Nombre,
                    inicio = FormatHoraTimeSpan(rangoIni),
                    fin = FormatHoraTimeSpan(rangoFin),
                    requiereOperario = cfg?.RequiereOperario ?? true,
                    auxiliaresRequeridos = cfg?.AuxiliaresRequeridos ?? 0,
                    sinOperario = (cfg?.RequiereOperario ?? true) && !asignacionesDia.Any(x => !x.EsAuxiliar && !x.EsDescanso),
                    personas
                });
            }
        }

        return Ok(new
        {
            maquinaId,
            maquinaNombre = maquina.Nombre,
            estadoOperativo = string.IsNullOrWhiteSpace(maquina.EstadoOperativo) ? "Operativa" : maquina.EstadoOperativo,
            turnos
        });
    }

    private static string FormatHoraTimeSpan(TimeSpan ts) =>
        $"{ts.Hours:D2}:{ts.Minutes:D2}";

    private static (TimeSpan inicio, TimeSpan fin) HorarioRangoDia(Horario h, DateTime dia)
    {
        if (dia.DayOfWeek == DayOfWeek.Saturday)
            return (h.InicioSabado, h.FinSabado);
        return (h.InicioSemana, h.FinSemana);
    }

    private static bool SegmentOverlapsTimeOfDay(
        DateTime segStart,
        DateTime segEnd,
        TimeSpan turnoInicio,
        TimeSpan turnoFin)
    {
        var day = segStart.Date;
        var (fromTod, toTod) = DaySegmentToTimeOfDay(day, segStart, segEnd);
        if (turnoFin <= turnoInicio) return false;
        return fromTod < turnoFin && toTod > turnoInicio;
    }

    private async Task<PersonalNovedad?> FindNovedadAfectaAsync(int usuarioId, DateTime dia, Horario horario)
    {
        var list = await _context.PersonalNovedades
            .Where(n => n.UsuarioId == usuarioId && n.FechaInicio <= dia && n.FechaFin >= dia)
            .ToListAsync();
        return list.FirstOrDefault(n => NovedadAfectaTurno(n, horario));
    }

    /// <summary>
    /// Medio día: mañana = turno con punto medio &lt; 12:00; tarde = ≥ 12:00.
    /// Día completo afecta cualquier turno.
    /// </summary>
    private static bool NovedadAfectaTurno(PersonalNovedad n, Horario horario)
    {
        if (!n.MedioDia) return true;
        var mid = horario.InicioSemana + (horario.FinSemana - horario.InicioSemana) / 2;
        var jornada = (n.Jornada ?? "").Trim().ToLowerInvariant();
        if (jornada == "manana") return mid < TimeSpan.FromHours(12);
        if (jornada == "tarde") return mid >= TimeSpan.FromHours(12);
        return true;
    }

    private static string DescribeNovedad(PersonalNovedad n)
    {
        var tipo = n.Tipo ?? "novedad";
        if (!n.MedioDia) return tipo;
        var j = (n.Jornada ?? "").Trim().ToLowerInvariant() == "tarde" ? "tarde" : "mañana";
        return $"{tipo} (medio día {j})";
    }

    /// <summary>
    /// Convierte el tramo [segStart, segEnd) de un día calendario a horas del día.
    /// Si segEnd es medianoche del día siguiente (fin de día completo), usa 24:00
    /// para que los turnos (p.ej. 06:00-14:00) sí solapen. Antes TimeOfDay=00:00
    /// hacía que los días intermedios del rango no devolvieran ningún turno.
    /// </summary>
    private static (TimeSpan fromTod, TimeSpan toTod) DaySegmentToTimeOfDay(
        DateTime dia,
        DateTime segStart,
        DateTime segEnd)
    {
        var dayStart = dia.Date;
        var dayEnd = dayStart.AddDays(1);
        var fromTod = segStart <= dayStart ? TimeSpan.Zero : segStart.TimeOfDay;
        TimeSpan toTod;
        if (segEnd >= dayEnd)
            toTod = TimeSpan.FromHours(24);
        else if (segEnd.TimeOfDay == TimeSpan.Zero && segEnd > segStart)
            toTod = TimeSpan.FromHours(24); // medianoche como fin exclusivo del día
        else
            toTod = segEnd.TimeOfDay;
        if (toTod <= fromTod && segEnd > segStart)
            toTod = TimeSpan.FromHours(24);
        return (fromTod, toTod);
    }

    private static List<Horario> FindOverlappingHorarios(
        List<Horario> horarios,
        DateTime dia,
        TimeSpan segStart,
        TimeSpan segEnd)
    {
        // Horario único (inicio/fin) aplica todos los días, incluido fin de semana.
        _ = dia;
        var list = new List<Horario>();
        foreach (var h in horarios)
        {
            var t0 = h.InicioSemana;
            var t1 = h.FinSemana;
            if (t1 <= t0) continue;
            if (segStart < t1 && segEnd > t0)
                list.Add(h);
        }
        return list;
    }

    /// <summary>Semana roster lun a dom inclusive (7 días). semanaInicio = lunes de arranque.</summary>
    private static bool TryParseSemanaRoster(string? semanaInicio, out DateTime lunes, out DateTime domingoFin)
    {
        lunes = default;
        domingoFin = default;
        if (string.IsNullOrWhiteSpace(semanaInicio) || !DateTime.TryParse(semanaInicio, out var raw))
            return false;
        var d = raw.Date;
        var offset = d.DayOfWeek == DayOfWeek.Sunday ? 6 : (int)d.DayOfWeek - 1;
        lunes = d.AddDays(-offset);
        domingoFin = lunes.AddDays(6);
        return true;
    }

    /// <summary>
    /// Tras guardar Horarios, activa en Turnos los horarios usados en la semana
    /// (asignación por proceso virtual → también en máquinas físicas del proceso).
    /// </summary>
    private async Task SyncTurnosConfigFromRosterAsync(DateTime sabado, DateTime sabadoFin)
    {
        var asignaciones = await _context.RosterAsignaciones
            .AsNoTracking()
            .Where(a => a.FechaDia >= sabado && a.FechaDia <= sabadoFin && !a.EsDescanso)
            .ToListAsync();
        if (asignaciones.Count == 0) return;

        var maquinas = await _context.Maquinas.Where(m => m.Activo).AsNoTracking().ToListAsync();
        var horarios = await _context.Horarios.Where(h => h.Activo).AsNoTracking().ToListAsync();
        var persIds = horarios
            .Where(h => string.Equals(h.Codigo, "PERS", StringComparison.OrdinalIgnoreCase))
            .Select(h => h.Id)
            .ToHashSet();

        var horarioIdsByMaquina = new Dictionary<int, HashSet<int>>();

        foreach (var a in asignaciones)
        {
            if (a.HorarioId <= 0) continue;
            if (!a.HoraInicio.HasValue && persIds.Contains(a.HorarioId)) continue;

            var hid = RosterProcesoMaquinaHelper.ResolverHorarioIdPorRango(
                a.HoraInicio, a.HoraFin, a.HorarioId, horarios);
            if (persIds.Contains(hid) && !a.HoraInicio.HasValue) continue;

            foreach (var mid in RosterProcesoMaquinaHelper.TurnosMaquinaIdsDesdeAsignacion(a.MaquinaId, maquinas))
            {
                if (!horarioIdsByMaquina.TryGetValue(mid, out var set))
                {
                    set = new HashSet<int>();
                    horarioIdsByMaquina[mid] = set;
                }
                set.Add(hid);
            }
        }

        foreach (var (maquinaId, horarioIds) in horarioIdsByMaquina)
            await ReplaceTurnosConfigAsync(maquinaId, horarioIds, horarios);
    }

    private async Task ReplaceTurnosConfigAsync(int maquinaId, HashSet<int> horarioIds, List<Horario> horarios)
    {
        var existentes = await _context.MaquinaTurnoConfigs
            .Where(c => c.MaquinaId == maquinaId)
            .ToListAsync();
        if (existentes.Count > 0)
        {
            _context.MaquinaTurnoConfigs.RemoveRange(existentes);
            await _context.SaveChangesAsync();
        }

        foreach (var hid in horarioIds.OrderBy(x => x))
        {
            if (!horarios.Any(h => h.Id == hid)) continue;
            _context.MaquinaTurnoConfigs.Add(new MaquinaTurnoConfig
            {
                MaquinaId = maquinaId,
                HorarioId = hid,
                Activo = true,
                RequiereOperario = true,
                AuxiliaresRequeridos = 0
            });
        }

        await _context.SaveChangesAsync();
    }
}
