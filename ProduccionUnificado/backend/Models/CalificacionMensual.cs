using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Almacena la calificación mensual de la planta para comparativas históricas
/// </summary>
public class CalificacionMensual
{
    public int Id { get; set; }
    
    [Required]
    public int Mes { get; set; }
    
    [Required]
    public int Anio { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal CalificacionTotal { get; set; }
    
    public DateTime FechaCalculo { get; set; } = DateTime.UtcNow;
    
    [MaxLength(500)]
    public string? Notas { get; set; }
    
    // Desglose por máquina (JSON serializado para simplicidad)
    public string? DesgloseMaquinas { get; set; }
}
