using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Proveedor (Supplier) for Gestión Humana services.
/// Extended with contact information: Telefono, Correo, Direccion, NIT.
/// </summary>
public class GH_Proveedor
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int TipoServicioId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Telefono { get; set; }

    [MaxLength(100)]
    public string? Correo { get; set; }

    [MaxLength(300)]
    public string? Direccion { get; set; }

    [MaxLength(20)]
    public string? NIT { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation properties
    [ForeignKey("TipoServicioId")]
    public virtual GH_TipoServicio? TipoServicio { get; set; }

    public virtual ICollection<GH_Cotizacion> Cotizaciones { get; set; } = new List<GH_Cotizacion>();
}
