using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Tipo de Servicio (Activity Type) for Gestión Humana.
/// Each TipoServicio belongs to one Rubro.
/// Examples: "Desperdicio", "Aire", "Plomeria", "Uniforme"
/// </summary>
public class GH_TipoServicio
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>
    /// Monthly budget for this service type
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal PresupuestoMensual { get; set; } = 0;

    public bool Activo { get; set; } = true;

    // Navigation properties
    [ForeignKey("RubroId")]
    public virtual GH_Rubro? Rubro { get; set; }

    public virtual ICollection<GH_Proveedor> Proveedores { get; set; } = new List<GH_Proveedor>();
}
