namespace TiempoProcesos.API.Models;

/// <summary>Meta monetaria de facturación para un mes calendario del planeador.</summary>
public class MetaFacturacionMes
{
    public int Id { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public decimal Meta { get; set; }
    public DateTime FechaModificacion { get; set; } = DateTime.Now;
}
