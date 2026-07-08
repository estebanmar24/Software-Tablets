namespace TiempoProcesos.API.Models;

public class ProduccionDiariaDetalleDto
{
    public int? Id { get; set; }
    public long ProduccionDiariaId { get; set; }
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public int ActividadId { get; set; }
    public int Tiros { get; set; }
    public string? ReferenciaOP { get; set; }
    public string? Observaciones { get; set; }
    public string? SubCodigoActividad { get; set; }
    public string? SubCodigoDetalle { get; set; }
}
