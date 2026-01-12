using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Rubro (Category) for Talleres y Despachos expenses.
/// Examples: "Transporte hacia talleres", "Transporte al aeropuerto", "Acompañamiento"
/// </summary>
public class Talleres_Rubro
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation property
    public virtual ICollection<Talleres_Gasto> Gastos { get; set; } = new List<Talleres_Gasto>();
    public virtual ICollection<Talleres_PresupuestoMensual> Presupuestos { get; set; } = new List<Talleres_PresupuestoMensual>();
}
