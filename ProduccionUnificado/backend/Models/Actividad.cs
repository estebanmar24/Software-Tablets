namespace TiempoProcesos.API.Models;

public class Actividad
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public bool EsProductiva { get; set; }
    public int Orden { get; set; }
    public string? Observaciones { get; set; }
}
