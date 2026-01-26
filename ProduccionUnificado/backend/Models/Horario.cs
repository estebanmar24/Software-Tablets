namespace TiempoProcesos.API.Models;

/// <summary>
/// Modelo para los horarios/turnos de trabajo.
/// El sábado SIEMPRE es 8am-12pm para todos los turnos (horario bonificable).
/// </summary>
public class Horario
{
    public int Id { get; set; }
    public string Codigo { get; set; } = "";  // "1", "2", "3", "4"
    public string Nombre { get; set; } = "";  // "Turno Mañana", etc.
    
    // Horario Lunes a Viernes
    public TimeSpan InicioSemana { get; set; }  // 6:00, 7:00, 8:00, 14:00
    public TimeSpan FinSemana { get; set; }     // 14:00, 16:00, 12:00, 22:00
    
    // Horario Sábado - SIEMPRE 8am-12pm para todos los turnos
    public TimeSpan InicioSabado { get; set; } = new TimeSpan(8, 0, 0);
    public TimeSpan FinSabado { get; set; } = new TimeSpan(12, 0, 0);
    
    public bool Activo { get; set; } = true;
}
