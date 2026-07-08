using System.Text.RegularExpressions;

namespace TiempoProcesos.API.Helpers;

public sealed class SubcodigoCatalogEntry
{
    public string Codigo { get; init; } = string.Empty;
    public string Detalle { get; init; } = string.Empty;
}

public sealed class SubcodigoParseResult
{
    public string SubCodigoActividad { get; init; } = string.Empty;
    public string SubCodigoDetalle { get; init; } = string.Empty;
    public string Observaciones { get; init; } = string.Empty;
}

/// <summary>
/// Catálogo y parser de subcódigos (mismo criterio que tablets / App.tsx).
/// </summary>
public static class SubcodigoActividadHelper
{
    private static readonly Dictionary<string, List<SubcodigoCatalogEntry>> Catalog = new()
    {
        ["03"] =
        [
            new() { Codigo = "301", Detalle = "Daño electrico" },
            new() { Codigo = "302", Detalle = "Daño mecanico" },
            new() { Codigo = "303", Detalle = "Daño electroMecanico" },
            new() { Codigo = "399", Detalle = "Otro (especificar en observaciones)" },
        ],
        ["08"] =
        [
            new() { Codigo = "801", Detalle = "Cambio de mantilla" },
            new() { Codigo = "802", Detalle = "Esperando repuesto/Mecanico/Tecnico" },
            new() { Codigo = "803", Detalle = "Material Defectuoso" },
            new() { Codigo = "804", Detalle = "Problemas de humedad" },
            new() { Codigo = "805", Detalle = "Problemas de Registro" },
            new() { Codigo = "806", Detalle = "Sin fluido electrico" },
            new() { Codigo = "807", Detalle = "Tinta no conforme" },
            new() { Codigo = "808", Detalle = "Cambio de cuchilla" },
            new() { Codigo = "809", Detalle = "Limpieza de cilindros" },
            new() { Codigo = "810", Detalle = "Hoja en bateria" },
            new() { Codigo = "899", Detalle = "Otro (especificar en observaciones)" },
        ],
        ["13"] =
        [
            new() { Codigo = "1301", Detalle = "Esperando material" },
            new() { Codigo = "1302", Detalle = "Esperando planchas" },
            new() { Codigo = "1399", Detalle = "Otro (especificar en observaciones)" },
        ],
        ["14"] =
        [
            new() { Codigo = "1401", Detalle = "Cambio de bateria" },
            new() { Codigo = "1402", Detalle = "Calibracion de franjas" },
            new() { Codigo = "1403", Detalle = "Reunion programada" },
            new() { Codigo = "1404", Detalle = "Lavada de baterias" },
            new() { Codigo = "1499", Detalle = "Otro (especificar en observaciones)" },
        ],
    };

    public static IReadOnlyList<SubcodigoCatalogEntry> ObtenerPorActividad(string? actividadCodigo)
    {
        var cod = NormalizarActividadCodigo(actividadCodigo);
        return cod != null && Catalog.TryGetValue(cod, out var list) ? list : Array.Empty<SubcodigoCatalogEntry>();
    }

    public static string? NormalizarActividadCodigo(string? codigo)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return null;
        var digits = Regex.Replace(codigo.Trim(), @"\D", "");
        if (string.IsNullOrEmpty(digits)) return null;
        return digits.Length >= 2 ? digits[^2..] : digits.PadLeft(2, '0');
    }

    /// <summary>
    /// Detecta subcódigo en comentario/observaciones y devuelve campos listos para guardar.
    /// </summary>
    public static SubcodigoParseResult? TryParseFromText(string? texto, string? actividadCodigo)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var actCod = NormalizarActividadCodigo(actividadCodigo);
        if (actCod == null || !Catalog.TryGetValue(actCod, out var subs) || subs.Count == 0)
            return null;

        var raw = texto.Trim();

        // Formato tablet: "Subcodigo 08: 803 - Material Defectuoso | resto"
        var formal = Regex.Match(raw, @"Subc[oó]digo\s*(\d+)\s*:\s*(\d+)\s*-\s*([^|]+)", RegexOptions.IgnoreCase);
        if (formal.Success)
        {
            var codigoEncontrado = formal.Groups[2].Value.Trim();
            var entry = BuscarEntrada(subs, actCod, codigoEncontrado);
            if (entry != null)
            {
                var resto = Regex.Replace(raw, @"Subc[oó]digo\s*\d+\s*:\s*\d+\s*-\s*[^|]*\|?\s*", "", RegexOptions.IgnoreCase).Trim();
                return Build(entry, actCod, resto);
            }
        }

        // Buscar códigos del catálogo (más largos primero: 1301 antes de 301)
        foreach (var sub in subs.OrderByDescending(s => s.Codigo.Length))
        {
            if (ContieneCodigo(raw, sub.Codigo))
                return Build(sub, actCod, LimpiarCodigoDelTexto(raw, sub.Codigo));
        }

        // Números sueltos en el comentario (ej. "803 material malo")
        foreach (Match m in Regex.Matches(raw, @"\b(\d{3,4})\b"))
        {
            var entry = BuscarEntrada(subs, actCod, m.Groups[1].Value);
            if (entry != null)
                return Build(entry, actCod, LimpiarCodigoDelTexto(raw, entry.Codigo));
        }

        return null;
    }

    private static SubcodigoCatalogEntry? BuscarEntrada(List<SubcodigoCatalogEntry> subs, string actCod, string token)
    {
        var num = Regex.Replace(token, @"\D", "");
        if (string.IsNullOrEmpty(num)) return null;

        var exact = subs.FirstOrDefault(s => s.Codigo == num);
        if (exact != null) return exact;

        // Subgrupo sin prefijo de actividad (ej. act 08 + "03" -> 803)
        if (num.Length <= 2)
        {
            var compuesto = actCod + num.PadLeft(2, '0');
            return subs.FirstOrDefault(s => s.Codigo == compuesto);
        }

        if (num.StartsWith(actCod, StringComparison.Ordinal) && num.Length > actCod.Length)
        {
            var suffix = num[actCod.Length..];
            return subs.FirstOrDefault(s => s.Codigo.EndsWith(suffix, StringComparison.Ordinal));
        }

        return null;
    }

    private static bool ContieneCodigo(string text, string codigo) =>
        Regex.IsMatch(text, $@"\b{Regex.Escape(codigo)}\b", RegexOptions.IgnoreCase);

    private static string LimpiarCodigoDelTexto(string text, string codigo)
    {
        var cleaned = Regex.Replace(text, $@"\b{Regex.Escape(codigo)}\b", " ", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\s{2,}", " ").Trim();
        return cleaned;
    }

    private static SubcodigoParseResult Build(SubcodigoCatalogEntry entry, string actCod, string restoObs)
    {
        var obsTablet = $"Subcodigo {actCod}: {entry.Codigo} - {entry.Detalle}";
        var obs = string.IsNullOrWhiteSpace(restoObs) ? obsTablet : $"{obsTablet} | {restoObs.Trim()}";
        return new SubcodigoParseResult
        {
            SubCodigoActividad = entry.Codigo,
            SubCodigoDetalle = entry.Detalle,
            Observaciones = obs
        };
    }
}
