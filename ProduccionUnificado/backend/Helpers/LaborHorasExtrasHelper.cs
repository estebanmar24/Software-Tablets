namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Cálculo de horas extras / recargos según salario vigente (Colombia: 220 h/mes).
/// </summary>
public static class LaborHorasExtrasHelper
{
    public const decimal HorasMensualesLegales = 220m;

    public static decimal ValorHora(decimal salario) =>
        salario > 0 ? salario / HorasMensualesLegales : 0;

    public static decimal CalcularValorAPagar(decimal salario, decimal factor, decimal cantidadHoras)
    {
        if (salario <= 0 || factor <= 0 || cantidadHoras <= 0) return 0;
        return Math.Round(ValorHora(salario) * factor * cantidadHoras, 0, MidpointRounding.AwayFromZero);
    }
}
