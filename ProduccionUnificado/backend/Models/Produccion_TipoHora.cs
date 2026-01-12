using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Produccion_TiposHora")]
public class Produccion_TipoHora
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty; // e.g. "Extra Diurna"
    public decimal Porcentaje { get; set; } // e.g. 25
    public decimal Factor { get; set; } // e.g. 1.25
    public bool Activo { get; set; } = true;
}
