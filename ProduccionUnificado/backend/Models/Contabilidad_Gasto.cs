using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models;

/// <summary>Gastos registrados directamente por el área de Contabilidad (consolidado y Excel).</summary>
[Table("Contabilidad_Gastos")]
public class Contabilidad_Gasto
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    [JsonPropertyName("rubro")]
    public string Rubro { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [JsonPropertyName("proveedor")]
    public string Proveedor { get; set; } = string.Empty;

    [MaxLength(100)]
    [JsonPropertyName("numeroFactura")]
    public string? NumeroFactura { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    [JsonPropertyName("precio")]
    public decimal Precio { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioBase { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioIva { get; set; }

    [Required]
    [JsonPropertyName("fecha")]
    public DateTime Fecha { get; set; }

    [MaxLength(2000)]
    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; set; }

    [MaxLength(500)]
    [JsonPropertyName("facturaPdfUrl")]
    public string? FacturaPdfUrl { get; set; }

    [JsonPropertyName("esPendiente")]
    public bool EsPendiente { get; set; }

    [JsonPropertyName("esSolicitudCredito")]
    public bool EsSolicitudCredito { get; set; }

    [JsonPropertyName("esEfectivo")]
    public bool EsEfectivo { get; set; }

    [MaxLength(50)]
    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "Montado";

    [JsonPropertyName("anio")]
    public int Anio { get; set; }

    [JsonPropertyName("mes")]
    public int Mes { get; set; }

    [JsonPropertyName("creadoPorId")]
    public int? CreadoPorId { get; set; }

    [ForeignKey("CreadoPorId")]
    [JsonIgnore]
    public virtual AdminUsuario? CreadoPor { get; set; }

    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("fechaModificacion")]
    public DateTime? FechaModificacion { get; set; }
}
