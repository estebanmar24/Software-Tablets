using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Historial de mantenimientos realizados a un equipo
/// </summary>
public class HistorialMantenimiento
{
    public int Id { get; set; }
    
    [Required]
    public int EquipoId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Tipo { get; set; } = "Preventivo"; // Preventivo, Correctivo
    
    [MaxLength(1000)]
    public string? TrabajoRealizado { get; set; } // Descripción del trabajo
    
    [MaxLength(100)]
    public string? Tecnico { get; set; } // Nombre del técnico que realizó
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal Costo { get; set; } = 0;
    
    public DateTime Fecha { get; set; } = DateTime.UtcNow; // Fecha cuando se realizó el mantenimiento
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow; // Fecha cuando se registró en el sistema
    
    public DateTime? FechaActualizacion { get; set; } // Fecha cuando se editó por última vez
    
    public DateTime? ProximoProgramado { get; set; }
    
    // Observaciones adicionales
    [MaxLength(500)]
    public string? Observaciones { get; set; }
    
    // Navigation
    public Equipo? Equipo { get; set; }
}
