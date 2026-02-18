namespace TiempoProcesos.API.Models;

public class EncuestaCalidadProduccion
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public string? Material { get; set; }
    public string? Cabida { get; set; }
    public decimal CantidadAProducir { get; set; }
    public decimal CantidadRecuperada { get; set; }
    public decimal CantidadParaDespacho { get; set; }
    public string? Cliente { get; set; }
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.Now;

    // Navigation
    public List<EncuestaCalidadProduccionProceso> Procesos { get; set; } = new();
}

public class EncuestaCalidadProduccionProceso
{
    public int Id { get; set; }
    public int EncuestaId { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public decimal CantidadProducida { get; set; }
    public string? Observaciones { get; set; }

    // Navigation
    public EncuestaCalidadProduccion? Encuesta { get; set; }
}
