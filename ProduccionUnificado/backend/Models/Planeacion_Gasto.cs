using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Gasto (Expense) record for Planeación.
/// Factura (invoice number) is required for all expenses.
/// </summary>
public class Planeacion_Gasto
{
    [Key]
    public int Id { get; set; }
    [Required]
    public int RubroId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    /// <summary>
    /// Número de factura - Obligatorio para todos los gastos
    /// </summary>
    [Required(AllowEmptyStrings = true, ErrorMessage = "El número de factura es obligatorio")]
    [MaxLength(100)]
    public string NumeroFactura { get; set; } = string.Empty;

    /// <summary>
    /// Número de Orden de Producción (OP) - Required only for specific Rubros (e.g. Insumos)
    /// </summary>
    [MaxLength(50)]
    public string? NumeroOP { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Precio { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    /// <summary>
    /// ID del proveedor asociado - Opcional para gastos pendientes
    /// </summary>
    [ForeignKey("Proveedor")]
    public int? ProveedorId { get; set; }

    /// <summary>
    /// URL to the uploaded invoice PDF file
    /// </summary>
    [MaxLength(500)]
    public string? FacturaPdfUrl { get; set; }

    /// <summary>
    /// Indicates if the expense was registered without an invoice and price (pending legalization)
    /// </summary>
    public bool EsPendiente { get; set; } = false;

    // Navigation properties
    [ForeignKey("ProveedorId")]
    public virtual Planeacion_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Planeacion_Rubro? Rubro { get; set; }

    // History tracking
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaModificacion { get; set; }

    // Creator Tracking
    public int? CreadoPorId { get; set; }
    [ForeignKey("CreadoPorId")]
    public virtual AdminUsuario? CreadoPor { get; set; }
}
