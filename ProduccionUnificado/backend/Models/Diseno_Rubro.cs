using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

public class Diseno_Rubro
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation properties
    public virtual ICollection<Diseno_Gasto> Gastos { get; set; } = new List<Diseno_Gasto>();
    public virtual ICollection<Diseno_Proveedor> Proveedores { get; set; } = new List<Diseno_Proveedor>();
}
