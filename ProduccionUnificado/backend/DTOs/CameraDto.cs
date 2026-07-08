namespace TiempoProcesos.API.DTOs;

public class CameraDto
{
    public string Id { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public int HttpPort { get; set; }
    public int Channel { get; set; }
}

public class CameraSnapshotResult
{
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public string ContentType { get; set; } = "image/jpeg";
}
