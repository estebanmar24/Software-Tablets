using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Cotización (Quote) for Planeación.
/// </summary>
public class Planeacion_Cotizacion
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
    public DateTime FechaCotizacion { get; set; }

    [MaxLength(1000)]
    public string? Descripcion { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation properties
    [ForeignKey("ProveedorId")]
    public virtual Planeacion_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Planeacion_Rubro? Rubro { get; set; }
}
