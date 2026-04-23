using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Modelo para tickets de reporte de errores
/// </summary>
public class Ticket
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Titulo { get; set; } = string.Empty;

    [Required]
    [MaxLength(2000)]
    public string Descripcion { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? PasosReproducir { get; set; }

    [Required]
    [MaxLength(20)]
    public string Prioridad { get; set; } = "Media"; // Baja, Media, Alta

    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "Abierto"; // Abierto, EnProgreso, Resuelto, Cerrado

    [MaxLength(100)]
    public string? ModuloAfectado { get; set; } // Producción, Talleres, Calidad, SST, GH, etc.

    [Required]
    [MaxLength(100)]
    public string ReportadoPor { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Comentarios { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    
    public int Consecutivo { get; set; } // Número secuencial por módulo (ej: Ticket #1, #2...)

    public DateTime? FechaActualizacion { get; set; }

    public DateTime? FechaResolucion { get; set; }

    // Navigation
    public List<TicketImagen> Imagenes { get; set; } = new();
}
