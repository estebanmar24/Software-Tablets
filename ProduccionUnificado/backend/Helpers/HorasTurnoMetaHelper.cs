using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Meta de horas de turno por máquina y mes.
/// Base: L-V 8h, Sáb 4h (sin domingos ni festivos).
/// Turno doble el mismo día: duplica las horas base de ese día (16h L-V, 8h Sáb).
/// </summary>
public static class HorasTurnoMetaHelper
{
    public static bool TieneActividad(ProduccionDiaria p) =>
        p.TotalHoras > 0 || p.RendimientoFinal > 0 || p.Cambios > 0;

    public static bool EsDobleTurnoDia(IReadOnlyList<ProduccionDiaria> registrosDia)
    {
        var activos = registrosDia.Where(TieneActividad).ToList();
        if (activos.Count < 2)
            return false;

        if (activos.Select(r => r.UsuarioId).Distinct().Count() >= 2)
            return true;

        if (activos.Where(r => r.HorarioId.HasValue).Select(r => r.HorarioId!.Value).Distinct().Count() >= 2)
            return true;

        return false;
    }

    public static decimal HorasBaseLaborablesDia(DateTime fecha)
    {
        if (fecha.DayOfWeek == DayOfWeek.Sunday || HorarioLaboralHelper.EsFestivoColombia(fecha))
            return 0;

        return fecha.DayOfWeek == DayOfWeek.Saturday ? 4m : 8m;
    }

    /// <summary>
    /// Horas de turno meta del mes para una máquina (considera turnos dobles por día).
    /// </summary>
    public static decimal CalcularHorasTurnoMesMaquina(
        int maquinaId,
        int mes,
        int anio,
        IEnumerable<ProduccionDiaria> produccion,
        int? diaInicio = null,
        int? diaFin = null)
    {
        var diasEnMes = DateTime.DaysInMonth(anio, mes);
        var dStart = diaInicio ?? 1;
        var dEnd = diaFin ?? diasEnMes;

        var porDia = produccion
            .Where(p => p.MaquinaId == maquinaId)
            .GroupBy(p => p.Fecha.Date)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<ProduccionDiaria>)g.ToList());

        decimal total = 0;
        for (var dia = dStart; dia <= dEnd; dia++)
        {
            var fecha = new DateTime(anio, mes, dia);
            var baseDia = HorasBaseLaborablesDia(fecha);
            if (baseDia <= 0)
                continue;

            var doble = porDia.TryGetValue(fecha.Date, out var regs) && EsDobleTurnoDia(regs);
            total += doble ? baseDia * 2 : baseDia;
        }

        return total;
    }

    public static Dictionary<int, decimal> CalcularHorasTurnoPorMaquina(
        IEnumerable<ProduccionDiaria> produccion,
        IEnumerable<int> maquinaIds,
        int mes,
        int anio,
        int? diaInicio = null,
        int? diaFin = null)
    {
        var lista = produccion.ToList();
        return maquinaIds.Distinct().ToDictionary(
            id => id,
            id => CalcularHorasTurnoMesMaquina(id, mes, anio, lista, diaInicio, diaFin));
    }
}
