using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Proveedor (Supplier) for Talleres y Despachos.
/// NIT/Cédula is required for all providers.
/// </summary>
public class Talleres_Proveedor
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    /// <summary>
    /// NIT o Cédula - Obligatorio para todos los proveedores
    /// </summary>
    [Required(ErrorMessage = "El NIT o Cédula es obligatorio")]
    [MaxLength(50)]
    public string NitCedula { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Telefono { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation property
    public virtual ICollection<Talleres_Gasto> Gastos { get; set; } = new List<Talleres_Gasto>();
}
