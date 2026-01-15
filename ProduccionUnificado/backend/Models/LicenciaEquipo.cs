using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Licencias de software asociadas a un equipo
/// </summary>
public class LicenciaEquipo
{
    public int Id { get; set; }
    
    [Required]
    public int EquipoId { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty; // Ej: Windows 11 Pro, Office 365
    
    [MaxLength(200)]
    public string? Clave { get; set; } // Clave o serial de la licencia
    
    public DateTime? FechaInicio { get; set; }
    
    public DateTime? FechaExpiracion { get; set; }
    
    [MaxLength(500)]
    public string? Observaciones { get; set; }
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public Equipo? Equipo { get; set; }
}
