namespace TiempoProcesos.API.DTOs;

public class CrearEncuestaCalidadProduccionDto
{
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public string? Material { get; set; }
    public string? Cabida { get; set; }
    public decimal CantidadAProducir { get; set; }
    public string? Cliente { get; set; }
    public decimal CantidadRecuperada { get; set; }
    public decimal CantidadParaDespacho { get; set; }
    public string? Observaciones { get; set; }
    public List<ProcesoProduccionDto> Procesos { get; set; } = new();
}

public class ProcesoProduccionDto
{
    public string Proceso { get; set; } = string.Empty;
    public decimal CantidadProducida { get; set; }
    public string? Observaciones { get; set; }
}

public class EncuestaCalidadProduccionResumenDto
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public string? Material { get; set; }
    public string? Cliente { get; set; }
    public decimal CantidadAProducir { get; set; }
    public decimal CantidadRecuperada { get; set; }
    public decimal CantidadParaDespacho { get; set; }
    public int TotalProcesos { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class EncuestaCalidadProduccionDetalleDto
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string? Referencia { get; set; }
    public string? Material { get; set; }
    public string? Cliente { get; set; }
    public string? Cabida { get; set; }
    public decimal CantidadAProducir { get; set; }
    public decimal CantidadRecuperada { get; set; }
    public decimal CantidadParaDespacho { get; set; }
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; }
    public List<ProcesoProduccionDto> Procesos { get; set; } = new();
}
