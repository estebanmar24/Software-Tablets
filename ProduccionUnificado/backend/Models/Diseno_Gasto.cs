using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Diseno_Gasto
{
    [Key]
    public int Id { get; set; }

    public int? ProveedorId { get; set; }
    public bool EsPendiente { get; set; } = false;

    public bool EsSolicitudCredito { get; set; } = false;

    [Required]
    public int RubroId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [MaxLength(100)]
    public string NumeroFactura { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Precio { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    [MaxLength(20)]
    public string? TipoTrabajo { get; set; } // "Nuevo" o "Repetido"

    [MaxLength(50)]
    public string? OrdenProduccion { get; set; }

    [MaxLength(500)]
    public string? FacturaPdfUrl { get; set; }

    [ForeignKey("ProveedorId")]
    public virtual Diseno_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Diseno_Rubro? Rubro { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaModificacion { get; set; }

    public int? CreadoPorId { get; set; }
    [ForeignKey("CreadoPorId")]
    public virtual AdminUsuario? CreadoPor { get; set; }
}
