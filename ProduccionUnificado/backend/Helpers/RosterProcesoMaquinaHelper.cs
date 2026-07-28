using System.Globalization;
using System.Text;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Mapeo proceso Gantt ↔ máquinas físicas Perla (espejo del frontend opProcesoMaquina).
/// </summary>
public static class RosterProcesoMaquinaHelper
{
    public static readonly string[] ProcesosVirtualesGantt =
    {
        "Conversion", "Corrugacion", "Corte", "Impresion", "Acabado",
        "Colaminado", "Troquelado", "Despique", "Pegadora", "Terminado Manual"
    };

    private static readonly Dictionary<string, string[]> ProcesoCodigosPerla = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Conversion"] = new[] { "1a", "1b" },
        ["Corrugacion"] = new[] { "13a", "13b" },
        ["Corte"] = new[] { "2a", "2b" },
        ["Impresion"] = new[] { "3", "4", "5", "6", "7" },
        ["Acabado"] = new[] { "11", "16", "8c" },
        ["Colaminado"] = new[] { "10a", "10b" },
        ["Troquelado"] = new[] { "8a", "8b", "9" },
        ["Pegadora"] = new[] { "14" },
    };

    private static readonly HashSet<string> VirtualNames = new(ProcesosVirtualesGantt, StringComparer.OrdinalIgnoreCase);

    public static string NormalizarNombre(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return "";
        var sb = new StringBuilder();
        foreach (var c in nombre.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().ToLowerInvariant().Trim();
    }

    public static string? CodigoPerlaDesdeNombre(string? nombre)
    {
        var n = (nombre ?? "").Trim();
        if (n.Length == 0) return null;
        var m = System.Text.RegularExpressions.Regex.Match(n, @"^(\d{1,2})([a-z])?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        var num = m.Groups[1].Value.PadLeft(2, '0');
        var letter = m.Groups[2].Success ? m.Groups[2].Value.ToLowerInvariant() : "";
        return num + letter;
    }

    public static string NormalizarCodigo(string? codigo)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return "";
        var m = System.Text.RegularExpressions.Regex.Match(codigo.Trim().ToLowerInvariant(), @"^0*(\d{1,2})([a-z]?)$");
        if (!m.Success) return codigo.Trim().ToLowerInvariant();
        return $"{int.Parse(m.Groups[1].Value)}{m.Groups[2].Value}";
    }

    public static bool EsMaquinaVirtualProceso(string? nombre) =>
        VirtualNames.Contains((nombre ?? "").Trim());

    public static string? ProcesoGanttDesdeMaquina(Maquina maquina)
    {
        var nombre = maquina.Nombre?.Trim() ?? "";
        if (EsMaquinaVirtualProceso(nombre)) return nombre;
        var cod = CodigoPerlaDesdeNombre(nombre);
        if (cod == null) return null;
        var norm = NormalizarCodigo(cod);
        foreach (var kv in ProcesoCodigosPerla)
        {
            if (kv.Value.Any(c => NormalizarCodigo(c) == norm))
                return kv.Key;
        }
        return null;
    }

    public static Maquina? FindMaquinaVirtual(string procesoNombre, IReadOnlyList<Maquina> maquinas)
    {
        var key = NormalizarNombre(procesoNombre);
        if (key.Length == 0) return null;
        return maquinas.FirstOrDefault(m =>
            EsMaquinaVirtualProceso(m.Nombre)
            && NormalizarNombre(m.Nombre) == key);
    }

    public static List<Maquina> MaquinasFisicasProceso(string? procesoNombre, IReadOnlyList<Maquina> maquinas)
    {
        if (string.IsNullOrWhiteSpace(procesoNombre)) return new List<Maquina>();
        if (!ProcesoCodigosPerla.TryGetValue(procesoNombre.Trim(), out var codes) || codes.Length == 0)
            return new List<Maquina>();
        var wanted = new HashSet<string>(codes.Select(NormalizarCodigo));
        return maquinas
            .Where(m => m.Activo && !EsMaquinaVirtualProceso(m.Nombre))
            .Where(m =>
            {
                var cod = CodigoPerlaDesdeNombre(m.Nombre);
                return cod != null && wanted.Contains(NormalizarCodigo(cod));
            })
            .ToList();
    }

    /// <summary>IDs de máquinas cuyo roster aplica al consultar cobertura (física + virtual del proceso).</summary>
    public static HashSet<int> RosterMaquinaIdsRelacionados(int maquinaId, IReadOnlyList<Maquina> maquinas)
    {
        var ids = new HashSet<int> { maquinaId };
        var maquina = maquinas.FirstOrDefault(m => m.Id == maquinaId);
        if (maquina == null) return ids;

        var proceso = ProcesoGanttDesdeMaquina(maquina);
        if (proceso == null) return ids;

        var virtualM = FindMaquinaVirtual(proceso, maquinas);
        if (virtualM != null) ids.Add(virtualM.Id);

        if (EsMaquinaVirtualProceso(maquina.Nombre))
        {
            foreach (var fisica in MaquinasFisicasProceso(proceso, maquinas))
                ids.Add(fisica.Id);
        }

        return ids;
    }

    /// <summary>Máquinas donde activar turnos según una asignación de roster.</summary>
    public static HashSet<int> TurnosMaquinaIdsDesdeAsignacion(int maquinaId, IReadOnlyList<Maquina> maquinas)
    {
        var ids = new HashSet<int> { maquinaId };
        var maquina = maquinas.FirstOrDefault(m => m.Id == maquinaId);
        if (maquina == null) return ids;

        var proceso = ProcesoGanttDesdeMaquina(maquina);
        if (proceso == null) return ids;

        if (EsMaquinaVirtualProceso(maquina.Nombre))
        {
            foreach (var fisica in MaquinasFisicasProceso(proceso, maquinas))
                ids.Add(fisica.Id);
        }

        return ids;
    }

    /// <summary>Mejor horario del catálogo según solapamiento con HoraInicio/HoraFin.</summary>
    public static int ResolverHorarioIdPorRango(
        TimeSpan? horaInicio,
        TimeSpan? horaFin,
        int horarioIdFallback,
        IReadOnlyList<Horario> horarios)
    {
        if (!horaInicio.HasValue || !horaFin.HasValue || horaFin <= horaInicio)
            return horarioIdFallback;

        var ini = (int)horaInicio.Value.TotalMinutes;
        var fin = (int)horaFin.Value.TotalMinutes;
        int? bestId = null;
        var bestOverlap = -1;

        foreach (var h in horarios)
        {
            var hIni = (int)h.InicioSemana.TotalMinutes;
            var hFin = (int)h.FinSemana.TotalMinutes;
            if (hFin <= hIni) continue;
            var overlap = Math.Min(fin, hFin) - Math.Max(ini, hIni);
            if (overlap > bestOverlap)
            {
                bestOverlap = overlap;
                bestId = h.Id;
            }
        }

        return bestId ?? horarioIdFallback;
    }
}
