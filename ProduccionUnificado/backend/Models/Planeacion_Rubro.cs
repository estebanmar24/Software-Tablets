using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Rubro (Category) for Planeación expenses.
/// </summary>
public class Planeacion_Rubro
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation properties
    public virtual ICollection<Planeacion_Gasto> Gastos { get; set; } = new List<Planeacion_Gasto>();
    public virtual ICollection<Planeacion_Proveedor> Proveedores { get; set; } = new List<Planeacion_Proveedor>();
}
