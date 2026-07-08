using System.Security.Cryptography;

namespace TiempoProcesos.API.Helpers;

/// <summary>Lectura/borrado de PDFs aunque estén abiertos en otro proceso (visor, explorador).</summary>
public static class AdjuntoFileAccess
{
    private const FileShare ShareRead = FileShare.ReadWrite | FileShare.Delete;

    public static byte[] ReadAllBytes(string path)
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, ShareRead);
        using var ms = new MemoryStream();
        fs.CopyTo(ms);
        return ms.ToArray();
    }

    public static string ComputeHash(string path)
    {
        var bytes = ReadAllBytes(path);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    /// <summary>Intenta borrar; si está bloqueado, reintenta o renombra a .pendiente_borrado.</summary>
    public static bool TryDelete(string path, out string? error)
    {
        error = null;
        if (!File.Exists(path))
            return true;

        for (var i = 0; i < 5; i++)
        {
            try
            {
                File.Delete(path);
                return true;
            }
            catch (IOException ex)
            {
                error = ex.Message;
                if (i < 4)
                    Thread.Sleep(150 * (i + 1));
            }
            catch (UnauthorizedAccessException ex)
            {
                error = ex.Message;
                if (i < 4)
                    Thread.Sleep(150 * (i + 1));
            }
        }

        try
        {
            var pendiente = path + ".pendiente_borrado";
            if (File.Exists(pendiente))
                File.Delete(pendiente);
            File.Move(path, pendiente, overwrite: true);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }
}
