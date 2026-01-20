using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Monthly budget allocation per Rubro for Talleres y Despachos.
/// </summary>
public class Talleres_PresupuestoMensual
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Presupuesto { get; set; }

    // Navigation property
    [ForeignKey("RubroId")]
    public virtual Talleres_Rubro? Rubro { get; set; }
}
