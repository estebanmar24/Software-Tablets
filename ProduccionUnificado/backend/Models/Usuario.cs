using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    [Column("Estado")]
    public bool Activo { get; set; } = true;
    public DateTime? FechaCreacion { get; set; }
}
