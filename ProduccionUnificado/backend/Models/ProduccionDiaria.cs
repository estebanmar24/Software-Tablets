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
    // Formula: (Cambios × Maquina.TirosReferencia) + TirosDiarios
    public int TirosConEquivalencia => (Cambios * (Maquina?.TirosReferencia ?? 0)) + TirosDiarios;
    
    // Cálculos Productivos
    [Column(TypeName = "decimal(10, 2)")]
    public decimal TotalHorasProductivas { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal PromedioHoraProductiva { get; set; }
    
    // Económicos
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ValorTiroSnapshot { get; set; }
    
    [Column(TypeName = "decimal(18, 2)")]
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
    
    // Campos para validación de horario laboral (bonificación)
    /// <summary>
    /// Indica si el registro fue realizado dentro del horario laboral normal.
    /// L-V: 7am-4pm, Sábado: 8am-12pm
    /// </summary>
    public bool EsHorarioLaboral { get; set; } = true;
    
    /// <summary>
    /// Tiros que cuentan para bonificación (solo los realizados dentro del horario laboral).
    /// </summary>
    public int TirosBonificables { get; set; }
    
    /// <summary>
    /// Desperdicio dentro del horario laboral bonificable.
    /// </summary>
    [Column(TypeName = "decimal(10, 2)")]
    public decimal DesperdicioBonificable { get; set; }
    
    /// <summary>
    /// Valor a pagar calculado solo con tiros bonificables.
    /// </summary>
    [Column(TypeName = "decimal(18, 2)")]
    public decimal ValorAPagarBonificable { get; set; }
    
    // Horario/Turno del operario
    public int? HorarioId { get; set; }
    public Horario? Horario { get; set; }
}
