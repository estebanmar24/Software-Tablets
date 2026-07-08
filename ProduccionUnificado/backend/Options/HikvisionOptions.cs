namespace TiempoProcesos.API.Options;

public class HikvisionCameraOptions
{
    public string Id { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string Ip { get; set; } = string.Empty;
    public int HttpPort { get; set; }
    public int Channel { get; set; } = 101;
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public class HikvisionOptions
{
    public const string SectionName = "Hikvision";

    public int HttpPort { get; set; } = 8080;
    public string DefaultUser { get; set; } = "admin";
    public string DefaultPassword { get; set; } = string.Empty;
    public List<HikvisionCameraOptions> Cameras { get; set; } = new();
}
