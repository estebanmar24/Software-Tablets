using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Planeacion_Personal")]
public class Planeacion_Personal
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string Cedula { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Salario { get; set; } = 0;
    
    public bool Activo { get; set; } = true;
    
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
}
