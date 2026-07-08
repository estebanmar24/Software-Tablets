using Microsoft.AspNetCore.Mvc;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Precio total = base + IVA para gastos normales. Horas extras / recargos no llevan desglose (base e IVA null).
/// </summary>
public static class GastoPrecioIvaHelper
{
    /// <summary>
    /// Rubros de nómina por nombre (GH/SST/Diseño sin TipoHoraId) o HE/Recargo en Producción.
    /// </summary>
    public static bool EsRubroNominaPorNombre(string? rubroNombre)
    {
        if (string.IsNullOrWhiteSpace(rubroNombre)) return false;
        var s = rubroNombre.Trim().ToLowerInvariant();
        return s.Contains("recargo")
               || s.Contains("hora extra")
               || s.Contains("horas extra")
               || s.Contains("tiempo extra");
    }

    /// <summary>
    /// No aplica desglose base/IVA: tipos de hora/recargo o rubro de nómina.
    /// </summary>
    public static bool EsSinDesglosePrecioBaseIva(int? tipoHoraId, int? tipoRecargoId, string? rubroNombre)
        => GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(tipoHoraId, tipoRecargoId)
           || EsRubroNominaPorNombre(rubroNombre);

    /// <summary>
    /// Variante Producción: además coincide con rubros exactos "Horas Extras" / "Recargo".
    /// </summary>
    public static bool EsSinDesglosePrecioBaseIvaProduccion(int? tipoHoraId, int? tipoRecargoId, string? rubroNombre)
    {
        if (GastoMedioPagoHelper.EsGastoLaborHorasExtrasORecargo(tipoHoraId, tipoRecargoId))
            return true;
        if (string.IsNullOrWhiteSpace(rubroNombre)) return false;
        var n = rubroNombre.Trim();
        if (string.Equals(n, "Horas Extras", StringComparison.OrdinalIgnoreCase)
            || string.Equals(n, "Recargo", StringComparison.OrdinalIgnoreCase))
            return true;
        return EsRubroNominaPorNombre(rubroNombre);
    }

    /// <returns>null si OK; en gasto normal asigna Precio = base+iva y conserva base/iva.</returns>
    public static IActionResult? AplicarPrecioBaseIvaSiGastoNormal(
        bool sinDesglose,
        ref decimal precio,
        ref decimal? precioBase,
        ref decimal? precioIva)
    {
        if (sinDesglose)
        {
            precioBase = null;
            precioIva = null;
            return null;
        }

        if (!precioBase.HasValue || !precioIva.HasValue)
            return new BadRequestObjectResult(new { message = "Precio base e IVA son obligatorios (el IVA puede ser 0)." });

        if (precioBase.Value < 0 || precioIva.Value < 0)
            return new BadRequestObjectResult(new { message = "Precio base e IVA no pueden ser negativos." });

        precio = Math.Round(precioBase.Value + precioIva.Value, 2);
        return null;
    }

    /// <summary>
    /// Variante Producción vs resto de módulos para detectar gastos sin desglose base/IVA.
    /// </summary>
    public static IActionResult? AplicarSegunRubroYTipo(
        bool varianteProduccion,
        int? tipoHoraId,
        int? tipoRecargoId,
        string? rubroNombre,
        ref decimal precio,
        ref decimal? precioBase,
        ref decimal? precioIva)
    {
        var sinDesglose = varianteProduccion
            ? EsSinDesglosePrecioBaseIvaProduccion(tipoHoraId, tipoRecargoId, rubroNombre)
            : EsSinDesglosePrecioBaseIva(tipoHoraId, tipoRecargoId, rubroNombre);
        return AplicarPrecioBaseIvaSiGastoNormal(sinDesglose, ref precio, ref precioBase, ref precioIva);
    }
}
