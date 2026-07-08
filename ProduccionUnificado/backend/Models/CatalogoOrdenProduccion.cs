using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Catálogo de OP importado (Excel) o manual — planificado vs producción real.
/// Separado de Adjunto_DocumentoExtraccion (archivos OCR).
/// </summary>
[Table("Catalogo_OrdenProduccion")]
public class CatalogoOrdenProduccion
{
    [Key]
    public int Id { get; set; }

    /// <summary>Número de OP solo dígitos, ej. 7680.</summary>
    [Required, MaxLength(32)]
    public string Numero { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Cliente { get; set; }

    [MaxLength(500)]
    public string? Referencia { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CantidadPlanificada { get; set; }

    public int Mes { get; set; }
    public int Anio { get; set; }

    /// <summary>Excel | Manual | OCR</summary>
    [MaxLength(20)]
    public string Fuente { get; set; } = "Excel";

    public DateTime FechaActualizacion { get; set; } = DateTime.UtcNow;
}
