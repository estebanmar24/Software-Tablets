namespace TiempoProcesos.API.DTOs;

/// <summary>Mantenimiento registrado en Maquinaria al que se cargan materiales.</summary>
public class MantenimientoConsumoRefDto
{
    public int Id { get; set; }
    public int Consecutivo { get; set; }
    public int? TicketId { get; set; }
    public int? TicketConsecutivo { get; set; }
    public DateTime Fecha { get; set; }
    public string TipoMantenimiento { get; set; } = string.Empty;
    public string? Observacion { get; set; }
    public string? EjecutadoPor { get; set; }
    public string Etiqueta { get; set; } = string.Empty;
}
