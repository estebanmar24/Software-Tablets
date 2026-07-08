using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("CalidadNC_TiposReclamacion")]
public class CalidadNC_TipoReclamacionOpcion
{
    public int Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;
}
