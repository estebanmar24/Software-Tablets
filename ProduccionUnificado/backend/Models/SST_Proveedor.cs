using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Proveedor (Supplier) for SST services.
/// Each Proveedor is linked to one TipoServicio.
/// Examples: "CEMDIL", "Pest cleanning", "Hernando Orozco"
/// </summary>
public class SST_Proveedor
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int TipoServicioId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Nit { get; set; }

    [MaxLength(50)]
    public string? Telefono { get; set; }

    [MaxLength(300)]
    public string? Direccion { get; set; }

    [MaxLength(200)]
    public string? Correo { get; set; }

    public bool Activo { get; set; } = true;

    // Navigation property - Many-to-One with TipoServicio
    [ForeignKey("TipoServicioId")]
    public virtual SST_TipoServicio? TipoServicio { get; set; }
}
