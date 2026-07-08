using Microsoft.AspNetCore.Mvc;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Validación: gastos normales deben ser explícitamente crédito (solicitud) o efectivo, no ambos ni ninguno.
/// No aplica a líneas de horas extras / recargos (identificadas por tipo de hora o recargo).
/// </summary>
public static class GastoMedioPagoHelper
{
    public static bool EsGastoLaborHorasExtrasORecargo(int? tipoHoraId, int? tipoRecargoId)
        => tipoHoraId.HasValue || tipoRecargoId.HasValue;

    /// <returns>null si OK, o BadRequest si falta o es inválida la combinación.</returns>
    public static IActionResult? ValidateCreditoOExclusivoEfectivo(bool esLaborNomina, bool esSolicitudCredito, bool esEfectivo)
    {
        if (esLaborNomina)
            return null;
        if (esSolicitudCredito == esEfectivo)
            return new BadRequestObjectResult(new { message = "Debe indicar si el gasto es por crédito o en efectivo." });
        return null;
    }
}
