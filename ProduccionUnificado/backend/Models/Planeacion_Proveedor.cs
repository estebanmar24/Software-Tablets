using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Proveedor (Supplier) for Planeación.
/// NIT/Cédula is required for all providers.
/// </summary>
public class Planeacion_Proveedor
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>
    /// NIT o Cédula - Obligatorio para todos los proveedores
    /// </summary>
    [Required(ErrorMessage = "El NIT o Cédula es obligatorio")]
    [MaxLength(50)]
    public string NitCedula { get; set; } = string.Empty;

    [Required]
    public int RubroId { get; set; }

    [MaxLength(50)]
    public string? Telefono { get; set; }

    /// <summary>
    /// Precio cotizado por el proveedor
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioCotizado { get; set; }

    [ForeignKey("RubroId")]
    public virtual Planeacion_Rubro? Rubro { get; set; }

    public virtual ICollection<Planeacion_ProveedorRubro> ProveedorRubros { get; set; } = new List<Planeacion_ProveedorRubro>();

    public bool Activo { get; set; } = true;

    // Navigation property
    public virtual ICollection<Planeacion_Gasto> Gastos { get; set; } = new List<Planeacion_Gasto>();
}
