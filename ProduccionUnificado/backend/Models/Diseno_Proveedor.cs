using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Diseno_Proveedor
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "El NIT o Cédula es obligatorio")]
    [MaxLength(50)]
    public string NitCedula { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Telefono { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioCotizado { get; set; }

    [Required]
    public int RubroId { get; set; }

    [ForeignKey("RubroId")]
    public virtual Diseno_Rubro? Rubro { get; set; }

    public bool Activo { get; set; } = true;

    public virtual ICollection<Diseno_Gasto> Gastos { get; set; } = new List<Diseno_Gasto>();
}
