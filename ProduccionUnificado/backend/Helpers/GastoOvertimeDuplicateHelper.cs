using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Detecta registros duplicados de horas extras / recargos (mismo operario, horario, cantidad y tipo).
/// </summary>
public static class GastoOvertimeDuplicateHelper
{
    public static string? NormalizeTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var raw = value.Trim();
        var parts = raw.Split(':');
        if (parts.Length < 2 || !int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m))
            return raw;
        h = Math.Clamp(h, 0, 23);
        m = Math.Clamp(m, 0, 59);
        return $"{h:D2}:{m:D2}";
    }

    public static bool SameCantidad(decimal? a, decimal? b) =>
        Math.Round(a ?? 0m, 2) == Math.Round(b ?? 0m, 2);

    public static bool IsOvertimeLabor(int? tipoHoraId, int? tipoRecargoId) =>
        tipoHoraId.HasValue || tipoRecargoId.HasValue;

    public const string DuplicateMessage =
        "Ya existe un registro con los mismos datos (operario, horario, cantidad y tipo de hora/recargo).";

    private static (DateTime inicio, DateTime fin) RangoDia(DateTime fecha)
    {
        var dia = fecha.Date;
        return (dia, dia.AddDays(1));
    }

    private static bool HorariosCoinciden(string? existHi, string? existHf, string targetHi, string targetHf)
    {
        var hiE = NormalizeTime(existHi);
        var hfE = NormalizeTime(existHf);
        if (hiE == targetHi && hfE == targetHf) return true;
        if (string.IsNullOrEmpty(hiE) && string.IsNullOrEmpty(hfE) &&
            (!string.IsNullOrEmpty(targetHi) || !string.IsNullOrEmpty(targetHf)))
            return true;
        return false;
    }

    private static bool MatchesOvertimeSnapshot(
        decimal? cantidadHoras,
        string? horaInicio,
        string? horaFin,
        decimal? targetCantidad,
        string targetHoraInicio,
        string targetHoraFin)
    {
        return SameCantidad(cantidadHoras, targetCantidad)
            && HorariosCoinciden(horaInicio, horaFin, targetHoraInicio, targetHoraFin);
    }

    public static async Task<bool> ExistsProduccionDuplicateAsync(
        AppDbContext context,
        Produccion_Gasto gasto,
        int? excludeId = null)
    {
        if (!IsOvertimeLabor(gasto.TipoHoraId, gasto.TipoRecargoId) || !gasto.UsuarioId.HasValue)
            return false;

        var hi = NormalizeTime(gasto.HoraInicio);
        var hf = NormalizeTime(gasto.HoraFin);
        var (diaInicio, diaFin) = RangoDia(gasto.Fecha);

        var candidatos = await context.Produccion_Gastos.AsNoTracking()
            .Where(g =>
                (excludeId == null || g.Id != excludeId) &&
                g.UsuarioId == gasto.UsuarioId &&
                g.Fecha >= diaInicio && g.Fecha < diaFin &&
                g.TipoHoraId == gasto.TipoHoraId &&
                g.TipoRecargoId == gasto.TipoRecargoId)
            .Select(g => new { g.CantidadHoras, g.HoraInicio, g.HoraFin })
            .ToListAsync();

        return candidatos.Any(g => MatchesOvertimeSnapshot(
            g.CantidadHoras, g.HoraInicio, g.HoraFin,
            gasto.CantidadHoras, hi, hf));
    }

    public static async Task<bool> ExistsTalleresDuplicateAsync(
        AppDbContext context,
        Talleres_Gasto gasto,
        int? excludeId = null)
    {
        if (!IsOvertimeLabor(gasto.TipoHoraId, gasto.TipoRecargoId) || !gasto.PersonalId.HasValue)
            return false;

        var hi = NormalizeTime(gasto.HoraInicio);
        var hf = NormalizeTime(gasto.HoraFin);
        var (diaInicio, diaFin) = RangoDia(gasto.Fecha);

        var candidatos = await context.Talleres_Gastos.AsNoTracking()
            .Where(g =>
                (excludeId == null || g.Id != excludeId) &&
                g.PersonalId == gasto.PersonalId &&
                g.Fecha >= diaInicio && g.Fecha < diaFin &&
                g.TipoHoraId == gasto.TipoHoraId &&
                g.TipoRecargoId == gasto.TipoRecargoId)
            .Select(g => new { g.CantidadHoras, g.HoraInicio, g.HoraFin })
            .ToListAsync();

        return candidatos.Any(g => MatchesOvertimeSnapshot(
            g.CantidadHoras, g.HoraInicio, g.HoraFin,
            gasto.CantidadHoras, hi, hf));
    }

    public static async Task<bool> ExistsMantenimientoDuplicateAsync(
        AppDbContext context,
        Mantenimiento_Gasto gasto,
        int? excludeId = null)
    {
        if (!IsOvertimeLabor(gasto.TipoHoraId, gasto.TipoRecargoId) || !gasto.UsuarioId.HasValue)
            return false;

        var hi = NormalizeTime(gasto.HoraInicio);
        var hf = NormalizeTime(gasto.HoraFin);
        var (diaInicio, diaFin) = RangoDia(gasto.Fecha);

        var candidatos = await context.Mantenimiento_Gastos.AsNoTracking()
            .Where(g =>
                (excludeId == null || g.Id != excludeId) &&
                g.Activo &&
                g.UsuarioId == gasto.UsuarioId &&
                g.Fecha >= diaInicio && g.Fecha < diaFin &&
                g.TipoHoraId == gasto.TipoHoraId &&
                g.TipoRecargoId == gasto.TipoRecargoId)
            .Select(g => new { g.CantidadHoras, g.HoraInicio, g.HoraFin })
            .ToListAsync();

        return candidatos.Any(g => MatchesOvertimeSnapshot(
            g.CantidadHoras, g.HoraInicio, g.HoraFin,
            gasto.CantidadHoras, hi, hf));
    }
}
