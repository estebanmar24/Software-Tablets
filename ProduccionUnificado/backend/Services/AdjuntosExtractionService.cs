using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;
using Docnet.Core;
using Docnet.Core.Models;
using Tesseract;

namespace TiempoProcesos.API.Services;

public class AdjuntosExtractionService
{
    private const int MinCharsParaConsiderarTextoPdf = 80;
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AdjuntosExtractionService> _logger;

    public AdjuntosExtractionService(
        AppDbContext db,
        IWebHostEnvironment env,
        ILogger<AdjuntosExtractionService> logger)
    {
        _db = db;
        _env = env;
        _logger = logger;
    }

    public async Task<AdjuntoExtraccionDocumentoDto> ExtraerArchivoAsync(
        string numero,
        string tipoExtraccion,
        string fullPath,
        CancellationToken ct = default)
    {
        await EnsureExtraccionTableAsync(ct);
        var digits = new string((numero ?? "").Where(char.IsDigit).ToArray());
        return await ObtenerDocumentoAsync(digits, tipoExtraccion, fullPath, forzar: true, ct);
    }

    public async Task<AdjuntoExtraccionOpDto> ObtenerOExtraerAsync(string numero, bool forzar = false, CancellationToken ct = default)
    {
        await EnsureExtraccionTableAsync(ct);

        var digits = new string((numero ?? "").Where(char.IsDigit).ToArray());
        if (string.IsNullOrEmpty(digits))
            return new AdjuntoExtraccionOpDto { Numero = "" };

        var fichaPath = AdjuntosOpStorage.FindFile(_env, "fichas", "F", digits);
        var opPath = AdjuntosOpStorage.FindFile(_env, "op", "OP", digits);
        var ltPath = AdjuntosOpStorage.FindFile(_env, "linea_troquel", "LT", digits);

        AdjuntoExtraccionDocumentoDto? fichaDto = null;
        AdjuntoExtraccionDocumentoDto? opDto = null;
        AdjuntoExtraccionDocumentoDto? ltDto = null;

        if (fichaPath != null)
            fichaDto = await ObtenerDocumentoSeguroAsync(digits, "Ficha", fichaPath, forzar, ct);
        if (opPath != null)
            opDto = await ObtenerDocumentoSeguroAsync(digits, "OP", opPath, forzar, ct);
        if (ltPath != null)
            ltDto = await ObtenerDocumentoSeguroAsync(digits, "LineaTroquel", ltPath, forzar, ct);

        return new AdjuntoExtraccionOpDto
        {
            Numero = digits,
            Ficha = fichaDto,
            Op = opDto,
            LineaTroquel = ltDto
        };
    }

    public async Task<AdjuntoBibliotecaListaDto> ListarBibliotecaAsync(string? filtro, CancellationToken ct = default)
    {
        await EnsureExtraccionTableAsync(ct);

        var enDisco = AdjuntosOpStorage.ListarNumerosEnDisco(_env);
        List<AdjuntoDocumentoExtraccion> cache = new();
        try
        {
            cache = await _db.AdjuntoDocumentoExtracciones.AsNoTracking().ToListAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Biblioteca: sin caché BD");
        }

        var filtroDigits = string.IsNullOrWhiteSpace(filtro)
            ? null
            : new string(filtro.Where(char.IsDigit).ToArray());

        var numeros = new HashSet<string>(enDisco.Keys, StringComparer.OrdinalIgnoreCase);
        foreach (var e in cache)
            if (!string.IsNullOrEmpty(e.Numero))
                numeros.Add(e.Numero);

        var items = new List<AdjuntoBibliotecaItemDto>();
        foreach (var numero in numeros.OrderByDescending(n => int.TryParse(n, out var v) ? v : 0))
        {
            if (!string.IsNullOrEmpty(filtroDigits) && !numero.Contains(filtroDigits, StringComparison.Ordinal))
                continue;

            enDisco.TryGetValue(numero, out var disco);
            var fichaPath = AdjuntosOpStorage.FindFile(_env, "fichas", "F", numero);
            var opPath = AdjuntosOpStorage.FindFile(_env, "op", "OP", numero);
            var ltPath = AdjuntosOpStorage.FindFile(_env, "linea_troquel", "LT", numero);

            items.Add(new AdjuntoBibliotecaItemDto
            {
                Numero = numero,
                TieneFicha = fichaPath != null,
                TieneOp = opPath != null,
                TieneLineaTroquel = ltPath != null,
                FichaModificado = disco?.FichaMod,
                OpModificado = disco?.OpMod,
                LineaTroquelModificado = disco?.LineaTroquelMod,
                Ficha = ConstruirResumen("Ficha", fichaPath, cache.Where(x => x.Numero == numero && x.Tipo == "Ficha")),
                Op = ConstruirResumen("OP", opPath, cache.Where(x => x.Numero == numero && x.Tipo == "OP")),
                LineaTroquel = ConstruirResumen("LineaTroquel", ltPath, cache.Where(x => x.Numero == numero && x.Tipo == "LineaTroquel")),
            });
        }

        return new AdjuntoBibliotecaListaDto { Total = items.Count, Items = items };
    }

    public async Task<(int ArchivosEliminados, int RegistrosEliminados, List<string> Errores)> EliminarOpAsync(
        string numero,
        CancellationToken ct = default)
    {
        var digits = new string((numero ?? "").Where(char.IsDigit).ToArray());
        if (string.IsNullOrEmpty(digits))
            return (0, 0, new List<string> { "Número de OP inválido." });

        var (archivos, erroresArchivo) = AdjuntosOpStorage.EliminarArchivosOp(_env, digits);
        var registros = 0;

        try
        {
            var rows = await _db.AdjuntoDocumentoExtracciones
                .Where(x => x.Numero == digits)
                .ToListAsync(ct);
            if (rows.Count > 0)
            {
                _db.AdjuntoDocumentoExtracciones.RemoveRange(rows);
                await _db.SaveChangesAsync(ct);
                registros = rows.Count;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudieron borrar registros de extracción OP {Numero}", digits);
            erroresArchivo.Add($"BD: {ex.Message}");
        }

        return (archivos, registros, erroresArchivo);
    }

    private AdjuntoExtraccionResumenDto? ConstruirResumen(
        string tipo,
        string? fullPath,
        IEnumerable<AdjuntoDocumentoExtraccion> registros)
    {
        if (fullPath == null && !registros.Any())
            return null;

        var reg = registros
            .OrderByDescending(r => r.FechaExtraccion)
            .FirstOrDefault();

        var campos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (reg != null)
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(reg.DatosJson);
                if (parsed != null) campos = parsed;
            }
            catch { /* ignore */ }
        }

        return new AdjuntoExtraccionResumenDto
        {
            Tipo = tipo,
            ArchivoNombre = reg?.ArchivoNombre ?? (fullPath != null ? Path.GetFileName(fullPath) : ""),
            Url = AdjuntosOpStorage.ToPublicUrl(_env, fullPath),
            Metodo = reg?.Metodo ?? "—",
            FechaExtraccion = reg?.FechaExtraccion,
            Error = reg?.ErrorExtraccion,
            Campos = campos,
            TextoLongitud = reg?.TextoCompleto?.Length ?? 0,
        };
    }

    private async Task EnsureExtraccionTableAsync(CancellationToken ct)
    {
        try
        {
            var exists = await _db.Database
                .SqlQueryRaw<int>("""
                    SELECT COUNT(*)::int FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'Adjunto_DocumentoExtraccion'
                    """)
                .FirstOrDefaultAsync(ct);

            if (exists == 0)
            {
                StartupSchemaPatches.ApplyAdjuntoDocumentoExtraccionTable(_db);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo verificar tabla Adjunto_DocumentoExtraccion");
            StartupSchemaPatches.ApplyAdjuntoDocumentoExtraccionTable(_db);
        }
    }

    private async Task<AdjuntoExtraccionDocumentoDto> ObtenerDocumentoSeguroAsync(
        string numero,
        string tipo,
        string fullPath,
        bool forzar,
        CancellationToken ct)
    {
        try
        {
            return await ObtenerDocumentoAsync(numero, tipo, fullPath, forzar, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Extracción fallida {Tipo} OP {Numero}", tipo, numero);
            return new AdjuntoExtraccionDocumentoDto
            {
                Tipo = tipo,
                ArchivoNombre = Path.GetFileName(fullPath),
                Metodo = "Error",
                Error = ex.Message,
                Campos = new Dictionary<string, string>(),
            };
        }
    }

    private async Task<AdjuntoExtraccionDocumentoDto> ObtenerDocumentoAsync(
        string numero,
        string tipo,
        string fullPath,
        bool forzar,
        CancellationToken ct)
    {
        var nombre = Path.GetFileName(fullPath);
        string hash;
        try
        {
            hash = AdjuntoFileAccess.ComputeHash(fullPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Hash omitido para {Path}", fullPath);
            hash = "";
        }
        var rel = AdjuntosOpStorage.ToPublicUrl(_env, fullPath);

        AdjuntoDocumentoExtraccion? cached = null;
        try
        {
            cached = await _db.AdjuntoDocumentoExtracciones
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Numero == numero && x.Tipo == tipo && x.ArchivoNombre == nombre,
                    ct);

            if (!forzar && cached != null && cached.HashArchivo == hash && string.IsNullOrEmpty(cached.ErrorExtraccion))
                return MapToDto(cached);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lectura caché extracción omitida (tabla no disponible aún)");
        }

        var (texto, metodo, error) = await ExtraerTextoArchivoAsync(fullPath, tipo, ct);
        var campos = AdjuntosDocumentParser.ParseCampos(texto, tipo, numero);
        var json = AdjuntosDocumentParser.ToJson(campos);

        var entity = cached ?? new AdjuntoDocumentoExtraccion
        {
            Numero = numero,
            Tipo = tipo,
            ArchivoNombre = nombre,
            RutaRelativa = rel,
        };

        entity.HashArchivo = hash;
        entity.RutaRelativa = rel;
        entity.Metodo = metodo;
        entity.TextoCompleto = texto;
        entity.DatosJson = json;
        entity.FechaExtraccion = DateTime.UtcNow;
        entity.ErrorExtraccion = error;

        try
        {
            var tracked = await _db.AdjuntoDocumentoExtracciones
                .FirstOrDefaultAsync(
                    x => x.Numero == numero && x.Tipo == tipo && x.ArchivoNombre == nombre,
                    ct);

            if (tracked == null)
            {
                _db.AdjuntoDocumentoExtracciones.Add(entity);
            }
            else
            {
                tracked.HashArchivo = hash;
                tracked.RutaRelativa = rel;
                tracked.Metodo = metodo;
                tracked.TextoCompleto = texto;
                tracked.DatosJson = json;
                tracked.FechaExtraccion = DateTime.UtcNow;
                tracked.ErrorExtraccion = error;
                entity = tracked;
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo guardar extracción en BD; se devuelve resultado en memoria");
        }

        return MapToDto(entity);
    }

    private async Task<(string Texto, string Metodo, string? Error)> ExtraerTextoArchivoAsync(
        string fullPath,
        string tipoExtraccion,
        CancellationToken ct)
    {
        await Task.Yield();
        try
        {
            var pdfText = ExtraerTextoPdf(fullPath);
            var usarOcr = pdfText.Length < MinCharsParaConsiderarTextoPdf;
            if (!usarOcr && tipoExtraccion.Equals("Ficha", StringComparison.OrdinalIgnoreCase))
                usarOcr = AdjuntosDocumentParser.FichaNecesitaOcr(pdfText);

            if (!usarOcr && pdfText.Length >= MinCharsParaConsiderarTextoPdf)
                return (pdfText, "PdfText", null);

            var ocrText = await ExtraerTextoOcrAsync(fullPath, ct);
            if (!string.IsNullOrWhiteSpace(ocrText))
            {
                var merged = string.IsNullOrWhiteSpace(pdfText)
                    ? ocrText
                    : pdfText + "\n\n--- OCR ---\n\n" + ocrText;
                return (merged.Trim(), string.IsNullOrWhiteSpace(pdfText) ? "Ocr" : "PdfText+Ocr", null);
            }

            if (pdfText.Length > 0)
                return (pdfText, "PdfText", "Documento con poco texto; OCR no disponible o sin resultados.");

            return ("", "Ninguno", "No se extrajo texto. Instale datos OCR (tessdata/spa) o verifique que el PDF sea legible.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extrayendo {Path}", fullPath);
            return ("", "Error", ex.Message);
        }
    }

    private static string ExtraerTextoPdf(string fullPath)
    {
        var bytes = AdjuntoFileAccess.ReadAllBytes(fullPath);
        var sb = new StringBuilder();
        using var ms = new MemoryStream(bytes);
        using var doc = PdfDocument.Open(ms);
        foreach (var page in doc.GetPages())
            sb.AppendLine(ContentOrderTextExtractor.GetText(page));
        return NormalizarTexto(sb.ToString());
    }

    private async Task<string> ExtraerTextoOcrAsync(string fullPath, CancellationToken ct)
    {
        var tessPath = ResolverTessdataPath();
        if (tessPath == null)
        {
            _logger.LogWarning("OCR omitido: no se encontró carpeta tessdata con spa.traineddata");
            return "";
        }

        var bytes = await Task.Run(() => AdjuntoFileAccess.ReadAllBytes(fullPath), ct);
        var sb = new StringBuilder();

        using var docReader = DocLib.Instance.GetDocReader(bytes, new PageDimensions(1654, 2339));
        using var engine = new TesseractEngine(tessPath, "spa+eng", EngineMode.Default);

        var pageCount = docReader.GetPageCount();
        for (var i = 0; i < pageCount; i++)
        {
            ct.ThrowIfCancellationRequested();
            using var pageReader = docReader.GetPageReader(i);
            var raw = pageReader.GetImage();
            var w = pageReader.GetPageWidth();
            var h = pageReader.GetPageHeight();
            if (raw == null || raw.Length == 0 || w <= 0 || h <= 0) continue;

            using var pix = BgraToPix(raw, w, h);
            using var page = engine.Process(pix);
            sb.AppendLine(page.GetText());
        }

        return NormalizarTexto(sb.ToString());
    }

    private string? ResolverTessdataPath()
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "tessdata"),
            Path.Combine(AppContext.BaseDirectory, "tessdata"),
            Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "tessdata")),
        };

        foreach (var dir in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(Path.Combine(dir, "spa.traineddata")))
                return dir;
        }

        return null;
    }

    private static Pix BgraToPix(byte[] raw, int width, int height)
    {
        using var bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, width, height);
        var bd = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try
        {
            Marshal.Copy(raw, 0, bd.Scan0, Math.Min(raw.Length, bd.Stride * height));
        }
        finally
        {
            bmp.UnlockBits(bd);
        }

        using var ms = new MemoryStream();
        bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
        return Pix.LoadFromMemory(ms.ToArray());
    }

    private static string NormalizarTexto(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";
        text = text.Replace("\r", "");
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    private static AdjuntoExtraccionDocumentoDto MapToDto(AdjuntoDocumentoExtraccion e)
    {
        var campos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, string>>(e.DatosJson);
            if (parsed != null)
                campos = parsed;
        }
        catch { /* ignore */ }

        return new AdjuntoExtraccionDocumentoDto
        {
            Tipo = e.Tipo,
            ArchivoNombre = e.ArchivoNombre,
            Url = string.IsNullOrWhiteSpace(e.RutaRelativa) ? null : e.RutaRelativa,
            Metodo = e.Metodo,
            TextoCompleto = e.TextoCompleto,
            Campos = campos,
            FechaExtraccion = e.FechaExtraccion,
            Error = e.ErrorExtraccion
        };
    }
}
