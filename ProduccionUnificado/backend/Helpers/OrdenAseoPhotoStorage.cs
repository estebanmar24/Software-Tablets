namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Fotos de Orden y Aseo fuera de wwwroot para que no se pierdan al publicar el frontend/backend.
/// </summary>
public static class OrdenAseoPhotoStorage
{
    public static string GetPersistentDir(IWebHostEnvironment env)
    {
        var dir = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "data", "uploads", "ordenaseo"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    public static IEnumerable<string> GetLegacyDirs(IWebHostEnvironment env)
    {
        yield return Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "ordenaseo");
        yield return Path.Combine(env.ContentRootPath, "publish", "wwwroot", "uploads", "ordenaseo");
        yield return Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "wwwroot", "uploads", "ordenaseo"));

        if (!string.IsNullOrEmpty(env.WebRootPath))
            yield return Path.Combine(env.WebRootPath, "uploads", "ordenaseo");
    }

    public static void MigrateLegacyFiles(IWebHostEnvironment env)
    {
        var dest = GetPersistentDir(env);
        var migrated = 0;

        foreach (var legacyDir in GetLegacyDirs(env).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!Directory.Exists(legacyDir))
                continue;

            if (string.Equals(Path.GetFullPath(legacyDir), dest, StringComparison.OrdinalIgnoreCase))
                continue;

            foreach (var file in Directory.GetFiles(legacyDir, "*.jpg"))
            {
                var name = Path.GetFileName(file);
                var target = Path.Combine(dest, name);
                if (System.IO.File.Exists(target))
                    continue;

                try
                {
                    System.IO.File.Copy(file, target);
                    migrated++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[OrdenAseo] No se pudo migrar {name}: {ex.Message}");
                }
            }
        }

        if (migrated > 0)
            Console.WriteLine($"[OrdenAseo] Migradas {migrated} fotos a {dest}");
    }

    public static string? ResolvePhotoPath(IWebHostEnvironment env, string fileName)
    {
        var safeName = Path.GetFileName(fileName);
        if (string.IsNullOrEmpty(safeName))
            return null;

        var candidates = new List<string> { Path.Combine(GetPersistentDir(env), safeName) };
        foreach (var dir in GetLegacyDirs(env))
            candidates.Add(Path.Combine(dir, safeName));

        foreach (var path in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (System.IO.File.Exists(path))
                return path;
        }

        return null;
    }

    public static void MirrorToLegacyDirs(IWebHostEnvironment env, string fileName, string sourcePath)
    {
        foreach (var dir in GetLegacyDirs(env))
        {
            try
            {
                if (!Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                var target = Path.Combine(dir, fileName);
                if (string.Equals(Path.GetFullPath(sourcePath), Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase))
                    continue;

                System.IO.File.Copy(sourcePath, target, overwrite: true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrdenAseo] No se pudo copiar {fileName} a {dir}: {ex.Message}");
            }
        }
    }

    /// <summary>Solo nombres que existen en disco (evita 404 en el cliente).</summary>
    public static string? FilterExistingFileNames(IWebHostEnvironment env, string? filenames)
    {
        if (string.IsNullOrWhiteSpace(filenames))
            return null;

        var existing = filenames
            .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(f => ResolvePhotoPath(env, f) != null)
            .ToList();

        return existing.Count > 0 ? string.Join("|", existing) : null;
    }
}
