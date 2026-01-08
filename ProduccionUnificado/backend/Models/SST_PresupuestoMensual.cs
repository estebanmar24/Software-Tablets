using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Monthly budget allocation per TipoServicio.
/// This is managed by the Admin in the "Presupuesto" screen.
/// </summary>
public class SST_PresupuestoMensual
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int TipoServicioId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Presupuesto { get; set; }

    // Navigation property
    [ForeignKey("TipoServicioId")]
    public virtual SST_TipoServicio? TipoServicio { get; set; }
}
