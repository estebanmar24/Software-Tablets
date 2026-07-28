using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Services;

public interface IProgramacionEjecucionService
{
    /// <summary>
    /// Acorta la ventana programada si la producción terminó antes y corre actividades posteriores en la misma máquina.
    /// </summary>
    Task OnTiempoFinalizadoAsync(TiempoProceso tiempo);
}

public class ProgramacionEjecucionService : IProgramacionEjecucionService
{
    private readonly AppDbContext _context;

    public ProgramacionEjecucionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task OnTiempoFinalizadoAsync(TiempoProceso tiempo)
    {
        if (tiempo.Actividad?.Codigo != "02") return;

        var opNum = tiempo.OrdenProduccion?.Numero;
        if (string.IsNullOrWhiteSpace(opNum)) return;

        var opKey = SoloDigitos(opNum);
        if (string.IsNullOrEmpty(opKey)) return;

        var actualEnd = tiempo.HoraFin;
        if (actualEnd <= tiempo.HoraInicio) return;

        var candidatos = await _context.ProgramacionesOPProcesos
            .Include(p => p.ProgramacionOP)
            .Where(p => p.MaquinaId == tiempo.MaquinaId
                && p.FechaInicio <= actualEnd
                && p.FechaFin >= tiempo.HoraInicio
                && p.ProgramacionOP != null)
            .OrderBy(p => p.FechaInicio)
            .ToListAsync();

        var proceso = candidatos.FirstOrDefault(p =>
            EsProgramacionOp(p.ProgramacionOP)
            && OpCoincide(p.ProgramacionOP!.NumeroOP, opKey));

        if (proceso == null) return;

        var scheduledEnd = proceso.FechaFin;
        if (actualEnd >= scheduledEnd.AddMinutes(-1)) return;

        var delta = scheduledEnd - actualEnd;
        if (delta.TotalMinutes < 1) return;

        var anchorEnd = scheduledEnd;
        proceso.FechaFin = actualEnd;

        var posteriores = await _context.ProgramacionesOPProcesos
            .Include(p => p.ProgramacionOP)
            .Where(p => p.MaquinaId == tiempo.MaquinaId
                && p.Id != proceso.Id
                && p.FechaInicio >= anchorEnd)
            .ToListAsync();

        foreach (var p in posteriores)
        {
            p.FechaInicio -= delta;
            p.FechaFin -= delta;
        }

        await _context.SaveChangesAsync();

        var progIds = posteriores.Select(p => p.ProgramacionOPId)
            .Append(proceso.ProgramacionOPId)
            .Distinct()
            .ToList();

        foreach (var progId in progIds)
        {
            var prog = await _context.ProgramacionesOP
                .Include(p => p.Procesos)
                .FirstOrDefaultAsync(p => p.Id == progId);
            if (prog != null)
                await SyncPlaneacionMaquinasAsync(prog);
        }
    }

    private static bool EsProgramacionOp(ProgramacionOP? prog)
        => prog != null
            && (prog.TipoActividad == null
                || prog.TipoActividad == ""
                || prog.TipoActividad.Equals("op", StringComparison.OrdinalIgnoreCase));

    private static bool OpCoincide(string? numeroOp, string opKey)
    {
        var digits = SoloDigitos(numeroOp);
        if (string.IsNullOrEmpty(digits) || string.IsNullOrEmpty(opKey)) return false;
        return digits == opKey || digits.EndsWith(opKey) || opKey.EndsWith(digits);
    }

    private static string SoloDigitos(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var digits = Regex.Replace(value, @"\D", "");
        return digits.TrimStart('0');
    }

    private async Task<int?> ResolveOrdenProduccionIdAsync(ProgramacionOP prog)
    {
        if (prog.OrdenProduccionId.HasValue && prog.OrdenProduccionId.Value > 0)
            return prog.OrdenProduccionId;
        var digits = SoloDigitos(prog.NumeroOP);
        if (string.IsNullOrEmpty(digits)) return null;
        var orden = await _context.OrdenesProduccion.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Numero == digits || o.Numero == prog.NumeroOP.Trim());
        return orden?.Id;
    }

    private async Task RemovePlaneacionMaquinasForProgramacionAsync(ProgramacionOP prog)
    {
        var ordenId = await ResolveOrdenProduccionIdAsync(prog);
        var maquinaIds = prog.Procesos
            .Where(p => p.MaquinaId.HasValue && p.MaquinaId.Value > 0)
            .Select(p => p.MaquinaId!.Value)
            .Distinct()
            .ToList();
        if (maquinaIds.Count == 0) return;

        var query = _context.PlaneacionesMaquinas.Where(p => maquinaIds.Contains(p.MaquinaId));
        if (ordenId.HasValue)
        {
            query = query.Where(p => p.OrdenProduccionId == ordenId.Value);
        }
        else
        {
            var ranges = prog.Procesos
                .Where(p => p.MaquinaId.HasValue)
                .Select(p => new { p.MaquinaId, p.FechaInicio, p.FechaFin })
                .ToList();
            var candidatos = await query.ToListAsync();
            var ids = candidatos
                .Where(c => ranges.Any(r => r.MaquinaId == c.MaquinaId
                    && c.FechaInicio < r.FechaFin && c.FechaFin > r.FechaInicio))
                .Select(c => c.Id)
                .ToList();
            if (ids.Count == 0) return;
            _context.PlaneacionesMaquinas.RemoveRange(candidatos.Where(c => ids.Contains(c.Id)));
            return;
        }

        _context.PlaneacionesMaquinas.RemoveRange(await query.ToListAsync());
    }

    private async Task SyncPlaneacionMaquinasAsync(ProgramacionOP prog)
    {
        if (!string.IsNullOrWhiteSpace(prog.TipoActividad)
            && !prog.TipoActividad.Equals("op", StringComparison.OrdinalIgnoreCase))
            return;

        await RemovePlaneacionMaquinasForProgramacionAsync(prog);

        var ordenId = await ResolveOrdenProduccionIdAsync(prog);
        if (!ordenId.HasValue) return;

        foreach (var proc in prog.Procesos.Where(p => p.MaquinaId.HasValue && p.MaquinaId.Value > 0))
        {
            _context.PlaneacionesMaquinas.Add(new PlaneacionMaquina
            {
                MaquinaId = proc.MaquinaId!.Value,
                OrdenProduccionId = ordenId.Value,
                FechaInicio = proc.FechaInicio,
                FechaFin = proc.FechaFin,
                MetaTiros = prog.MetaTiros,
                Referencia = prog.Referencia ?? prog.Cliente
            });
        }

        await _context.SaveChangesAsync();
    }
}
