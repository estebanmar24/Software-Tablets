using System.Net;
using Microsoft.Extensions.Options;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Options;

namespace TiempoProcesos.API.Services;

public class HikvisionCameraService
{
    private readonly HikvisionOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<HikvisionCameraService> _logger;

    public HikvisionCameraService(
        IOptions<HikvisionOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<HikvisionCameraService> logger)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public IReadOnlyList<CameraDto> ListarCameras()
    {
        return _options.Cameras
            .Where(c => !string.IsNullOrWhiteSpace(c.Id) && !string.IsNullOrWhiteSpace(c.Ip))
            .Select(c => new CameraDto
            {
                Id = c.Id.Trim(),
                Area = c.Area.Trim(),
                Ip = c.Ip.Trim(),
                HttpPort = c.HttpPort > 0 ? c.HttpPort : _options.HttpPort,
                Channel = c.Channel > 0 ? c.Channel : 101,
            })
            .ToList();
    }

    public HikvisionCameraOptions? ObtenerConfig(string id)
    {
        return _options.Cameras.FirstOrDefault(c =>
            string.Equals(c.Id.Trim(), id.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public async Task<CameraSnapshotResult?> ObtenerSnapshotAsync(string id, CancellationToken ct = default)
    {
        var cam = ObtenerConfig(id);
        if (cam == null) return null;

        var user = string.IsNullOrWhiteSpace(cam.Username) ? _options.DefaultUser : cam.Username.Trim();
        var pass = cam.Password ?? _options.DefaultPassword;
        var port = cam.HttpPort > 0 ? cam.HttpPort : _options.HttpPort;
        var channel = cam.Channel > 0 ? cam.Channel : 101;

        var rutas = new[]
        {
            $"/ISAPI/Streaming/channels/{channel}/picture",
            $"/Streaming/channels/{channel}/picture",
            "/ISAPI/Streaming/channels/1/picture",
            "/Streaming/channels/1/picture",
        };

        foreach (var ruta in rutas.Distinct())
        {
            var url = $"http://{cam.Ip.Trim()}:{port}{ruta}";
            try
            {
                var bytes = await DescargarConDigestAsync(url, user, pass, ct);
                if (bytes != null && bytes.Length > 512)
                    return new CameraSnapshotResult { Data = bytes, ContentType = "image/jpeg" };
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Snapshot falló en {Url}", url);
            }
        }

        _logger.LogWarning("No se pudo obtener snapshot de cámara {CameraId} ({Ip})", cam.Id, cam.Ip);
        return null;
    }

    private async Task<byte[]?> DescargarConDigestAsync(
        string url,
        string user,
        string password,
        CancellationToken ct)
    {
        var handler = new HttpClientHandler
        {
            Credentials = new NetworkCredential(user, password),
            PreAuthenticate = false,
        };

        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(12) };
        using var response = await client.GetAsync(url, ct);
        if (!response.IsSuccessStatusCode) return null;

        var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
        if (contentType.Contains("xml", StringComparison.OrdinalIgnoreCase) ||
            contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return await response.Content.ReadAsByteArrayAsync(ct);
    }
}
