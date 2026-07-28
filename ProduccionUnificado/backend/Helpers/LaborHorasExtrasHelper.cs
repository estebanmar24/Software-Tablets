namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Cálculo de horas extras / recargos según salario vigente.
/// Divisor mensual: 220 hasta el 14/07/2026; 210 desde el 15/07/2026 inclusive.
/// </summary>
public static class LaborHorasExtrasHelper
{
    public const decimal HorasMensualesAntes = 220m;
    public const decimal HorasMensualesDesdeJul2026 = 210m;

    /// <summary>Fecha a partir de la cual aplica el divisor 210 (inclusive).</summary>
    public static readonly DateTime FechaCambioDivisor = new(2026, 7, 15);

    [Obsolete("Usar HorasMensualesPara(fecha). Conservado por compatibilidad.")]
    public const decimal HorasMensualesLegales = HorasMensualesAntes;

    public static decimal HorasMensualesPara(DateTime? fechaReferencia = null)
    {
        var fecha = (fechaReferencia ?? DateTime.Today).Date;
        return fecha >= FechaCambioDivisor ? HorasMensualesDesdeJul2026 : HorasMensualesAntes;
    }

    public static decimal ValorHora(decimal salario, DateTime? fechaReferencia = null) =>
        salario > 0 ? salario / HorasMensualesPara(fechaReferencia) : 0;

    public static decimal CalcularValorAPagar(
        decimal salario,
        decimal factor,
        decimal cantidadHoras,
        DateTime? fechaReferencia = null)
    {
        if (salario <= 0 || factor <= 0 || cantidadHoras <= 0) return 0;
        return Math.Round(
            ValorHora(salario, fechaReferencia) * factor * cantidadHoras,
            0,
            MidpointRounding.AwayFromZero);
    }
}
