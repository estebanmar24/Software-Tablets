using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Produccion_Producto
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Referencia { get; set; }

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    [Required]
    public int RubroId { get; set; }

    [MaxLength(20)]
    public string? Medida { get; set; }

    public bool Activo { get; set; } = true;

    [ForeignKey("RubroId")]
    public virtual Produccion_Rubro? Rubro { get; set; }
}
