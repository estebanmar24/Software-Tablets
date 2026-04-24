namespace TiempoProcesos.API.DTOs;

public class CronogramaToggleDto
{
    public int HojaVidaId { get; set; }
    public int ActividadId { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public int Dia { get; set; }
    public int? Estado { get; set; }
}
