namespace TiempoProcesos.API.Models;

public class ActaDestruccionProceso
{
    public int Id { get; set; }
    public int ActaDestruccionId { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public string Motivo { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }

    // Navigation property
    public ActaDestruccion? ActaDestruccion { get; set; }
}
