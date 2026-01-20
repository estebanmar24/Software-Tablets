using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Cotización (Quotation) for Talleres y Despachos.
/// Explicitly links Provider AND Rubro since Talleres Providers are generic.
/// </summary>
public class Talleres_Cotizacion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProveedorId { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal PrecioCotizado { get; set; }

    [Required]
    public DateTime FechaCotizacion { get; set; } = DateTime.Now;

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation properties
    [ForeignKey("ProveedorId")]
    public virtual Talleres_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Talleres_Rubro? Rubro { get; set; }
}
