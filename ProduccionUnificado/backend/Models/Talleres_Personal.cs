using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Talleres_Personal")]
public class Talleres_Personal
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string Nombre { get; set; } = string.Empty;
    
    public string? Cargo { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Salario { get; set; } = 0;
    
    public bool Activo { get; set; } = true;
    public bool Estado { get; set; } = true;
    
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
}
