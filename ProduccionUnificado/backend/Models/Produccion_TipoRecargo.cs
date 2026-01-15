using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Produccion_TiposRecargo")]
public class Produccion_TipoRecargo
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty; // e.g. "Recargo Nocturno"
    public decimal Porcentaje { get; set; } // e.g. 35
    public decimal Factor { get; set; } // e.g. 0.35 or 1.35 depending on how it's used
    public bool Activo { get; set; } = true;
}
