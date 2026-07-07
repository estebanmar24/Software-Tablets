namespace TiempoProcesos.API.Models;

public class ProgramacionOP
{
    public int Id { get; set; }
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public OrdenProduccion? OrdenProduccion { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    public string? Color { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.Now;

    public List<ProgramacionOPProceso> Procesos { get; set; } = new();
}

public class ProgramacionOPProceso
{
    public int Id { get; set; }
    public int ProgramacionOPId { get; set; }
    public ProgramacionOP? ProgramacionOP { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public string? TiemposAuxiliaresJson { get; set; }
}
