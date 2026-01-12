using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Gasto (Expense) record for Talleres y Despachos.
/// Factura (invoice number) is required for all expenses.
/// </summary>
public class Talleres_Gasto
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ProveedorId { get; set; }

    [Required]
    public int RubroId { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    [Range(1, 12)]
    public int Mes { get; set; }

    /// <summary>
    /// Número de factura - Obligatorio para todos los gastos
    /// </summary>
    [Required(ErrorMessage = "El número de factura es obligatorio")]
    [MaxLength(100)]
    public string NumeroFactura { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Precio { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    [MaxLength(500)]
    public string? Observaciones { get; set; }

    // Navigation properties
    [ForeignKey("ProveedorId")]
    public virtual Talleres_Proveedor? Proveedor { get; set; }

    [ForeignKey("RubroId")]
    public virtual Talleres_Rubro? Rubro { get; set; }
}
