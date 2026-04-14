using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Gasto (Expense) record for Talleres y Despachos.
/// </summary>
[Table("Talleres_Gastos")]
public class Talleres_Gasto
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("proveedorId")]
    public int? ProveedorId { get; set; }

    [Required]
    [JsonPropertyName("rubroId")]
    public int RubroId { get; set; }

    [Required]
    [JsonPropertyName("anio")]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    [JsonPropertyName("mes")]
    public int Mes { get; set; }

    /// <summary>
    /// Número de factura - Obligatorio para gastos legalizados
    /// </summary>
    [MaxLength(100)]
    [JsonPropertyName("numeroFactura")]
    public string? NumeroFactura { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    [JsonPropertyName("precio")]
    public decimal Precio { get; set; }

    [Required]
    [JsonPropertyName("fecha")]
    public DateTime Fecha { get; set; }

    [MaxLength(500)]
    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; set; }

    /// <summary>
    /// URL to the uploaded invoice PDF file
    /// </summary>
    [MaxLength(500)]
    [JsonPropertyName("facturaPdfUrl")]
    public string? FacturaPdfUrl { get; set; }

    // Navigation properties
    [ForeignKey("ProveedorId")]
    [JsonIgnore]
    public virtual Talleres_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    [JsonIgnore]
    public virtual Talleres_Rubro? Rubro { get; set; }

    // Columns for Overtime/Recargos
    [JsonPropertyName("personalId")]
    public int? PersonalId { get; set; }

    [JsonPropertyName("tipoHoraId")]
    public int? TipoHoraId { get; set; }

    [JsonPropertyName("tipoRecargoId")]
    public int? TipoRecargoId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    [JsonPropertyName("cantidadHoras")]
    public decimal? CantidadHoras { get; set; }

    [JsonPropertyName("numeroOP")]
    public string? NumeroOP { get; set; }

    [JsonPropertyName("esPendiente")]
    public bool EsPendiente { get; set; } = false;

    [JsonPropertyName("esSolicitudCredito")]
    public bool EsSolicitudCredito { get; set; } = false;

    [ForeignKey("PersonalId")]
    [JsonIgnore]
    public virtual Talleres_Personal? Personal { get; set; }

    [ForeignKey("TipoHoraId")]
    [JsonIgnore]
    public virtual Produccion_TipoHora? TipoHora { get; set; }

    [ForeignKey("TipoRecargoId")]
    [JsonIgnore]
    public virtual Produccion_TipoRecargo? TipoRecargo { get; set; }
    
    // History tracking
    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("fechaModificacion")]
    public DateTime? FechaModificacion { get; set; }

    // Creator Tracking
    [JsonPropertyName("creadoPorId")]
    public int? CreadoPorId { get; set; }

    [ForeignKey("CreadoPorId")]
    [JsonIgnore]
    public virtual AdminUsuario? CreadoPor { get; set; }
}
