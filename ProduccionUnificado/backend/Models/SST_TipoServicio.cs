using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Tipo de Servicio (Service Type/Activity) for SST.
/// Each TipoServicio belongs to one Rubro.
/// Examples: "Control de plagas", "Elementos de Protección Personal (EPP)", "Certificación de bomberos"
/// </summary>
public class SST_TipoServicio
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    [MaxLength(300)]
    public string Nombre { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    // Navigation property - Many-to-One with Rubro
    [ForeignKey("RubroId")]
    public virtual SST_Rubro? Rubro { get; set; }

    // Navigation property - One TipoServicio has many Proveedores
    public virtual ICollection<SST_Proveedor> Proveedores { get; set; } = new List<SST_Proveedor>();

    // Navigation property - One TipoServicio has many PresupuestosMensuales
    public virtual ICollection<SST_PresupuestoMensual> PresupuestosMensuales { get; set; } = new List<SST_PresupuestoMensual>();
}
