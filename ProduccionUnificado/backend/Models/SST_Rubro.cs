using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Rubro (Category) for SST expenses.
/// Examples: "Medicina Preventiva", "Seguridad Industrial", "Capacitación-Asesorías-Auditorías"
/// </summary>
public class SST_Rubro
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation property - One Rubro has many TiposServicio
    public virtual ICollection<SST_TipoServicio> TiposServicio { get; set; } = new List<SST_TipoServicio>();
}
