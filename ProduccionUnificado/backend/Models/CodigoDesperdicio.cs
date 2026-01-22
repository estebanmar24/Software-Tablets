namespace TiempoProcesos.API.Models;

/// <summary>
/// Código de desperdicio configurable
/// </summary>
public class CodigoDesperdicio
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
}
