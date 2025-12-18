using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class ProduccionDiaria
{
    public long Id { get; set; }
    
    [Column(TypeName = "date")]
    public DateTime Fecha { get; set; }
    
    public int UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    
    public int MaquinaId { get; set; }
    public Maquina? Maquina { get; set; }
    
    // Tiempos
    public TimeSpan? HoraInicio { get; set; }
    public TimeSpan? HoraFin { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal HorasOperativas { get; set; }
    
    // Producción
    [Column(TypeName = "decimal(10, 2)")]
    public decimal RendimientoFinal { get; set; }
    
    public int Cambios { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TiempoPuestaPunto { get; set; }
    
    public int TirosDiarios { get; set; }
    
    // Computed property for equivalence calculation
    public int TirosConEquivalencia => TirosDiarios;
    
    // Cálculos Productivos
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalHorasProductivas { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal PromedioHoraProductiva { get; set; }
    
    // Económicos
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ValorTiroSnapshot { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ValorAPagar { get; set; }
    
    // Auxiliares
    [Column(TypeName = "decimal(10, 2)")]
    public decimal HorasMantenimiento { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal HorasDescanso { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal HorasOtrosAux { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalHorasAuxiliares { get; set; }
    
    // Tiempos Muertos
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TiempoFaltaTrabajo { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TiempoReparacion { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TiempoOtroMuerto { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalTiemposMuertos { get; set; }
    
    // TOTAL GLOBAL
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalHoras { get; set; }
    
    // Extras
    [StringLength(50)]
    public string? ReferenciaOP { get; set; }
    
    public string? Novedades { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal Desperdicio { get; set; }
    
    public int DiaLaborado { get; set; } = 1;
}
