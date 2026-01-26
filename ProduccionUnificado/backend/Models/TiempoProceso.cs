namespace TiempoProcesos.API.Models;

public class TiempoProceso
{
    public long Id { get; set; }
    public DateTime Fecha { get; set; }
    public DateTime HoraInicio { get; set; }  // Match DB DATETIME2
    public DateTime HoraFin { get; set; }     // Match DB DATETIME2
    public long Duracion { get; set; }         // Match DB BIGINT (seconds or ticks)
    
    public int UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    
    public int MaquinaId { get; set; }
    public Maquina? Maquina { get; set; }
    
    public int? OrdenProduccionId { get; set; }
    public OrdenProduccion? OrdenProduccion { get; set; }
    
    public int ActividadId { get; set; }
    public Actividad? Actividad { get; set; }
    
    public int Tiros { get; set; }
    public int Desperdicio { get; set; }
    public string? Observaciones { get; set; }
    
    // Horario/Turno del operario
    public int? HorarioId { get; set; }
    public Horario? Horario { get; set; }
}
