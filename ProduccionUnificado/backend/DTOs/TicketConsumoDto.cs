namespace TiempoProcesos.API.DTOs;

public class TicketConsumoDto
{
    public int Id { get; set; }
    public int Consecutivo { get; set; }
    public DateTime Fecha { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string EstadoMaquina { get; set; } = string.Empty;
    public string Turno { get; set; } = string.Empty;
    public string RegistradoPor { get; set; } = string.Empty;
    public string Etiqueta { get; set; } = string.Empty;
}
