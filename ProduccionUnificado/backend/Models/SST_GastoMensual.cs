using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Monthly expense record for SST.
/// This is entered by SST personnel in the "Presupuestos SST" screen.
/// </summary>
public class SST_GastoMensual
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    public int TipoServicioId { get; set; }

    /// <summary>
    /// ID del proveedor asociado - Opcional para gastos pendientes
    /// </summary>
    [ForeignKey("Proveedor")]
    public int? ProveedorId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [Required(AllowEmptyStrings = true)]
    [MaxLength(100)]
    public string NumeroFactura { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Precio { get; set; }

    [Required]
    public DateTime FechaCompra { get; set; }

    [MaxLength(500)]
    public string? Nota { get; set; }

    /// <summary>
    /// Indicates if the expense was registered without an invoice and price (pending legalization)
    /// </summary>
    public bool EsPendiente { get; set; } = false;

    /// <summary>
    /// Base64 encoded PDF file or URL to stored file
    /// </summary>
    public string? ArchivoFactura { get; set; }

    /// <summary>
    /// Original filename of the uploaded PDF
    /// </summary>
    [MaxLength(255)]
    public string? ArchivoFacturaNombre { get; set; }

    // Navigation properties
    [ForeignKey("RubroId")]
    public virtual SST_Rubro? Rubro { get; set; }

    [ForeignKey("TipoServicioId")]
    public virtual SST_TipoServicio? TipoServicio { get; set; }

    [ForeignKey("ProveedorId")]
    public virtual SST_Proveedor? Proveedor { get; set; }
    
    // History tracking
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaModificacion { get; set; }

    // Creator Tracking
    public int? CreadoPorId { get; set; }
    [ForeignKey("CreadoPorId")]
    public virtual AdminUsuario? CreadoPor { get; set; }
}
