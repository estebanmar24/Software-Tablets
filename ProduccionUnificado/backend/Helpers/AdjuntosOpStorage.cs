namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Fichas (F{número}) y OP (OP{número}) en la carpeta Adjuntos del repositorio.
/// Estructura esperada: Adjuntos/fichas/F123.pdf, Adjuntos/op/OP123.pdf, Adjuntos/linea_troquel/LT123.pdf
/// </summary>
public sealed class AdjuntoOpIndices
{
    public bool Ficha { get; set; }
    public bool Op { get; set; }
    public bool LineaTroquel { get; set; }
    public DateTime? FichaMod { get; set; }
    public DateTime? OpMod { get; set; }
    public DateTime? LineaTroquelMod { get; set; }
}

public static class AdjuntosOpStorage
{
    private static readonly string[] AllowedExtensions =
        { ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".doc", ".docx", ".xls", ".xlsx" };

    public static string GetAdjuntosRoot(IWebHostEnvironment env)
    {
        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "Adjuntos")),
            Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "..", "Adjuntos")),
            Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "Adjuntos")),
            Path.Combine(env.ContentRootPath, "Adjuntos"),
        };

        foreach (var dir in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (Directory.Exists(dir))
                return dir;
        }

        var created = candidates[0];
        Directory.CreateDirectory(created);
        Directory.CreateDirectory(Path.Combine(created, "fichas"));
        Directory.CreateDirectory(Path.Combine(created, "op"));
        Directory.CreateDirectory(Path.Combine(created, "linea_troquel"));
        return created;
    }

    public static string? FindFile(IWebHostEnvironment env, string subfolder, string prefix, string digits)
    {
        if (string.IsNullOrWhiteSpace(digits))
            return null;

        var root = GetAdjuntosRoot(env);
        var dir = Path.Combine(root, subfolder);
        if (!Directory.Exists(dir))
            return null;

        var variants = new HashSet<string>(StringComparer.Ordinal) { digits.Trim() };
        var trimmed = digits.Trim().TrimStart('0');
        if (!string.IsNullOrEmpty(trimmed))
            variants.Add(trimmed);

        foreach (var d in variants)
        {
            var baseName = $"{prefix}{d}";
            foreach (var ext in AllowedExtensions)
            {
                var exact = Path.Combine(dir, baseName + ext);
                if (File.Exists(exact))
                    return exact;
            }

            foreach (var file in Directory.EnumerateFiles(dir))
            {
                var name = Path.GetFileNameWithoutExtension(file);
                if (name.Equals(baseName, StringComparison.OrdinalIgnoreCase))
                    return file;
            }
        }

        return null;
    }

    /// <summary>Guarda el PDF como F{n} o OP{n} en fichas/ u op/.</summary>
    public static string SavePdfFile(IWebHostEnvironment env, string subfolder, string prefix, string digits, Stream content)
    {
        var root = GetAdjuntosRoot(env);
        var dir = Path.Combine(root, subfolder);
        Directory.CreateDirectory(dir);

        var fileName = $"{prefix}{digits}.pdf";
        var fullPath = Path.Combine(dir, fileName);

        foreach (var old in Directory.EnumerateFiles(dir))
        {
            var name = Path.GetFileNameWithoutExtension(old);
            if (name.Equals($"{prefix}{digits}", StringComparison.OrdinalIgnoreCase))
            {
                try { File.Delete(old); } catch { /* ignore */ }
            }
        }

        using (var fs = File.Create(fullPath))
            content.CopyTo(fs);

        return fullPath;
    }

    public static (string Subfolder, string Prefix, string TipoExtraccion) MapTipoDocumento(string tipo)
    {
        var t = (tipo ?? "").Trim().ToLowerInvariant();
        return t switch
        {
            "ficha" or "f" or "ficha_tecnica" or "fichatecnica" => ("fichas", "F", "Ficha"),
            "op" or "orden" or "orden_produccion" => ("op", "OP", "OP"),
            "linea_troquel" or "linea-de-troquel" or "lineadetroquel" or "troquel" or "lt" =>
                ("linea_troquel", "LT", "LineaTroquel"),
            _ => throw new ArgumentException("Tipo debe ser 'ficha', 'op' o 'linea_troquel'."),
        };
    }

    /// <summary>Índice de OPs con archivos F{n}, OP{n} o LT{n} en disco.</summary>
    public static Dictionary<string, AdjuntoOpIndices> ListarNumerosEnDisco(IWebHostEnvironment env)
    {
        var map = new Dictionary<string, AdjuntoOpIndices>(StringComparer.OrdinalIgnoreCase);

        void Registrar(string subfolder, string prefix, Action<AdjuntoOpIndices, DateTime> marcar)
        {
            var dir = Path.Combine(GetAdjuntosRoot(env), subfolder);
            if (!Directory.Exists(dir)) return;

            foreach (var file in Directory.EnumerateFiles(dir))
            {
                var fileName = Path.GetFileName(file);
                if (fileName.Contains(".pendiente_borrado", StringComparison.OrdinalIgnoreCase))
                    continue;
                var name = Path.GetFileNameWithoutExtension(file);
                if (string.IsNullOrEmpty(name) || !name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    continue;

                var digits = new string(name.AsSpan(prefix.Length).ToArray().Where(char.IsDigit).ToArray());
                if (string.IsNullOrEmpty(digits)) continue;

                var mod = File.GetLastWriteTimeUtc(file);
                if (!map.TryGetValue(digits, out var cur))
                    cur = new AdjuntoOpIndices();

                marcar(cur, mod);
                map[digits] = cur;
            }
        }

        Registrar("fichas", "F", (c, m) => { c.Ficha = true; c.FichaMod = m; });
        Registrar("op", "OP", (c, m) => { c.Op = true; c.OpMod = m; });
        Registrar("linea_troquel", "LT", (c, m) => { c.LineaTroquel = true; c.LineaTroquelMod = m; });
        return map;
    }

    /// <summary>Elimina F{n} y OP{n} del disco (todas las extensiones conocidas).</summary>
    public static (int ArchivosEliminados, List<string> Errores) EliminarArchivosOp(
        IWebHostEnvironment env,
        string digits)
    {
        var eliminados = 0;
        var errores = new List<string>();
        if (string.IsNullOrWhiteSpace(digits))
            return (0, errores);

        void EliminarEnCarpeta(string subfolder, string prefix)
        {
            var dir = Path.Combine(GetAdjuntosRoot(env), subfolder);
            if (!Directory.Exists(dir)) return;

            var variants = new HashSet<string>(StringComparer.Ordinal) { digits.Trim() };
            var trimmed = digits.Trim().TrimStart('0');
            if (!string.IsNullOrEmpty(trimmed))
                variants.Add(trimmed);

            foreach (var d in variants)
            {
                var baseName = $"{prefix}{d}";
                foreach (var file in Directory.EnumerateFiles(dir))
                {
                    var name = Path.GetFileNameWithoutExtension(file);
                    if (name.EndsWith(".pendiente_borrado", StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (!name.Equals(baseName, StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (AdjuntoFileAccess.TryDelete(file, out var err))
                        eliminados++;
                    else if (!string.IsNullOrEmpty(err))
                        errores.Add($"{Path.GetFileName(file)}: {err}");
                }
            }
        }

        EliminarEnCarpeta("fichas", "F");
        EliminarEnCarpeta("op", "OP");
        EliminarEnCarpeta("linea_troquel", "LT");
        return (eliminados, errores);
    }

    public static string? ToPublicUrl(IWebHostEnvironment env, string? fullPath)
    {
        if (string.IsNullOrEmpty(fullPath) || !File.Exists(fullPath))
            return null;

        var root = Path.GetFullPath(GetAdjuntosRoot(env));
        var full = Path.GetFullPath(fullPath);
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            return null;

        var relative = full[root.Length..].Replace('\\', '/').TrimStart('/');
        return $"/adjuntos/{relative}";
    }
}
