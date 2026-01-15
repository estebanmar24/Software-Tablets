using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Produccion_Proveedores")]
public class Produccion_Proveedor
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Nit { get; set; } = string.Empty;
    public string Telefono { get; set; } = string.Empty;
    public int? RubroId { get; set; }
    public Produccion_Rubro? Rubro { get; set; }
    public decimal? PrecioCotizado { get; set; }
    public bool Activo { get; set; } = true;
}
