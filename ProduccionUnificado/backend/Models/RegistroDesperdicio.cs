using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Registro de desperdicio diario
/// </summary>
public class RegistroDesperdicio
{
    public int Id { get; set; }
    
    public int? MaquinaId { get; set; }
    [ForeignKey("MaquinaId")]
    public Maquina? Maquina { get; set; }
    
    public int? UsuarioId { get; set; }
    [ForeignKey("UsuarioId")]
    public Usuario? Usuario { get; set; }
    
    public bool EsTallerExterno { get; set; } = false;
    
    public DateTime Fecha { get; set; }
    public string? OrdenProduccion { get; set; }
    
    public int? CodigoDesperdicioId { get; set; }
    [ForeignKey("CodigoDesperdicioId")]
    public CodigoDesperdicio? CodigoDesperdicio { get; set; }
    
    public decimal Cantidad { get; set; }
    public string? Nota { get; set; }

    /// <summary>Quién registró el desperdicio (ej. nombre admin o "Tablet").</summary>
    [MaxLength(120)]
    public string? RegistradoPor { get; set; }

    public DateTime FechaRegistro { get; set; } = Helpers.ColombiaTime.Now;
}
