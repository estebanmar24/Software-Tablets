using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

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
    /// Número de factura - Obligatorio para todos los gastos (excepto personal)
    /// </summary>
    [MaxLength(100)]
    public string? NumeroFactura { get; set; }

    /// <summary>
    /// Número de Orden de Producción (OP) - Required only for specific Rubros (e.g. Insumos)
    /// </summary>
    [MaxLength(50)]
    public string? NumeroOP { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Precio { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioBase { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioIva { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    /// <summary>
    /// ID del proveedor asociado - Opcional para gastos de personal o pendientes
    /// </summary>
    [ForeignKey("Proveedor")]
    public int? ProveedorId { get; set; }

    /// <summary>
    /// ID del personal asociado - Para horas extras y recargos
    /// </summary>
    [ForeignKey("Personal")]
    public int? PersonalId { get; set; }

    /// <summary>
    /// ID del tipo de hora extra
    /// </summary>
    [ForeignKey("TipoHora")]
    public int? TipoHoraId { get; set; }

    /// <summary>
    /// ID del tipo de recargo
    /// </summary>
    [ForeignKey("TipoRecargo")]
    public int? TipoRecargoId { get; set; }

    /// <summary>
    /// Cantidad de horas o recargos
    /// </summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? CantidadHoras { get; set; }

    /// <summary>
    /// URL to the uploaded invoice PDF file
    /// </summary>
    [MaxLength(500)]
    public string? FacturaPdfUrl { get; set; }

    /// <summary>
    /// Indicates if the expense was registered without an invoice and price (pending legalization)
    /// </summary>
    [JsonPropertyName("esPendiente")]
    public bool EsPendiente { get; set; } = false;

    [JsonPropertyName("esSolicitudCredito")]
    public bool EsSolicitudCredito { get; set; } = false;

    [JsonPropertyName("esEfectivo")]
    public bool EsEfectivo { get; set; } = false;

    // Navigation properties
    [ForeignKey("ProveedorId")]
    public virtual Planeacion_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Planeacion_Rubro? Rubro { get; set; }

    [ForeignKey("PersonalId")]
    public virtual Planeacion_Personal? Personal { get; set; }

    [ForeignKey("TipoHoraId")]
    public virtual Produccion_TipoHora? TipoHora { get; set; }

    [ForeignKey("TipoRecargoId")]
    public virtual Produccion_TipoRecargo? TipoRecargo { get; set; }

    // History tracking
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaModificacion { get; set; }

    // Creator Tracking
    public int? CreadoPorId { get; set; }
    [ForeignKey("CreadoPorId")]
    public virtual AdminUsuario? CreadoPor { get; set; }

    [MaxLength(50)]
    public string Estado { get; set; } = "Montado";
}
