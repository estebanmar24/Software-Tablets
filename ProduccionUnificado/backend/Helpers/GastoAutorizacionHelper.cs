namespace TiempoProcesos.API.Helpers;

using TiempoProcesos.API.Models;

public static class GastoAutorizacionHelper
{
    public const string AutorizadorNombreMostrar = "Nohora Ortiz";

    public const string EstadoPendiente = "Pendiente";
    public const string EstadoAutorizada = "Autorizada";
    public const string EstadoNoAutorizada = "NoAutorizada";

    public static readonly HashSet<string> ModulosValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "produccion", "planeacion", "sst", "gh", "diseno", "mantenimiento", "talleres",
    };

    public static bool EsAutorizador(string? nombreMostrar, string? role = null)
    {
        if (string.Equals(nombreMostrar?.Trim(), AutorizadorNombreMostrar, StringComparison.OrdinalIgnoreCase))
            return true;

        if (string.IsNullOrWhiteSpace(role)) return false;

        return role.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(r => string.Equals(r, "admin", StringComparison.OrdinalIgnoreCase));
    }

    public static bool ModuloValido(string? modulo) =>
        !string.IsNullOrWhiteSpace(modulo) && ModulosValidos.Contains(modulo.Trim());

    public static bool EsRubroSinAutorizacion(string? nombreRubro)
    {
        var n = (nombreRubro ?? "").Trim().ToLowerInvariant();
        return n.Contains("horas extras") || n.Contains("hora extra") || n.Contains("recargo");
    }

    public static bool EsSolicitante(GastoAutorizacionSolicitud s, int? usuarioId, string? usuarioNombre)
    {
        if (usuarioId.HasValue && s.SolicitadoPorId == usuarioId) return true;
        if (string.IsNullOrWhiteSpace(usuarioNombre) || string.IsNullOrWhiteSpace(s.SolicitadoPorNombre))
            return false;
        return string.Equals(s.SolicitadoPorNombre.Trim(), usuarioNombre.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    public static string EtiquetaModulo(string? modulo) => (modulo ?? "").Trim().ToLowerInvariant() switch
    {
        "produccion" => "Producción",
        "planeacion" => "Planeación",
        "sst" => "SST",
        "gh" => "Gestión Humana",
        "diseno" => "Diseño",
        "mantenimiento" => "Mantenimiento",
        "talleres" => "Talleres",
        _ => modulo ?? "—",
    };

    /// <summary>Convierte el filtro de área de Contabilidad (etiqueta o clave) a clave de módulo.</summary>
    public static string? ResolverModuloFiltro(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var t = input.Trim();
        if (ModulosValidos.Contains(t)) return t.ToLowerInvariant();

        return t.ToLowerInvariant() switch
        {
            "producción" or "produccion" => "produccion",
            "planeación" or "planeacion" => "planeacion",
            "gestión humana" or "gestion humana" => "gh",
            "diseño" or "diseno" => "diseno",
            "mantenimiento" => "mantenimiento",
            "talleres" or "talleres y despachos" => "talleres",
            "sst" => "sst",
            _ => null,
        };
    }
}
