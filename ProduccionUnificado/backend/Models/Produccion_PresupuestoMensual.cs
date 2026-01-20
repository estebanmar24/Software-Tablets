using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Monthly budget allocation per Rubro for Production module.
/// Unlike SST/GH which use TipoServicio, Production uses Rubro directly.
/// For "Horas Extras", this is a general budget for all workers.
/// </summary>
public class Produccion_PresupuestoMensual
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
    public virtual Produccion_Rubro? Rubro { get; set; }
}
