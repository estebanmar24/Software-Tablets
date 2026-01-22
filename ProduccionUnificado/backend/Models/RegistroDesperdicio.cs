using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Registro de desperdicio diario
/// </summary>
public class RegistroDesperdicio
{
    public int Id { get; set; }
    
    public int MaquinaId { get; set; }
    [ForeignKey("MaquinaId")]
    public Maquina? Maquina { get; set; }
    
    public int UsuarioId { get; set; }
    [ForeignKey("UsuarioId")]
    public Usuario? Usuario { get; set; }
    
    public DateTime Fecha { get; set; }
    public string? OrdenProduccion { get; set; }
    
    public int CodigoDesperdicioId { get; set; }
    [ForeignKey("CodigoDesperdicioId")]
    public CodigoDesperdicio? CodigoDesperdicio { get; set; }
    
    public decimal Cantidad { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.Now;
}
