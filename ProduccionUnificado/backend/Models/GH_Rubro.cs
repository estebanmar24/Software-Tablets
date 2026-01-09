using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Rubro (Category) for Gestión Humana expenses.
/// Examples: "Compradores de Desperdicio", "Servicios Publicos", "Mantenimiento"
/// </summary>
public class GH_Rubro
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation property - One Rubro has many TiposServicio
    public virtual ICollection<GH_TipoServicio> TiposServicio { get; set; } = new List<GH_TipoServicio>();
}
