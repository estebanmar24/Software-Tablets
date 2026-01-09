using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Cotización (Quotation) for SST.
/// Allows comparing prices before making a purchase.
/// </summary>
public class SST_Cotizacion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProveedorId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal PrecioCotizado { get; set; }

    [Required]
    public DateTime FechaCotizacion { get; set; }

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation property
    [ForeignKey("ProveedorId")]
    public virtual SST_Proveedor? Proveedor { get; set; }
}
