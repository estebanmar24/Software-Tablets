namespace TiempoProcesos.API.Models;

/// <summary>
/// Detailed time entries for a daily production record
/// Each row represents a specific time interval with an activity
/// </summary>
public class ProduccionDiariaDetalle
{
    public int Id { get; set; }
    
    // Parent daily record
    public long ProduccionDiariaId { get; set; }
    public ProduccionDiaria? ProduccionDiaria { get; set; }
    
    // Time interval
    public TimeSpan HoraInicio { get; set; }
    public TimeSpan HoraFin { get; set; }
    
    // Activity
    public int ActividadId { get; set; }
    public Actividad? Actividad { get; set; }
    
    // Production data (0 if not production activity)
    public int Tiros { get; set; }
    
    // OP Reference
    public string? ReferenciaOP { get; set; }
    
    // Notes
    public string? Observaciones { get; set; }
    
    // Calculated property - duration in minutes
    public int TiempoMinutos => (int)(HoraFin - HoraInicio).TotalMinutes;
}
