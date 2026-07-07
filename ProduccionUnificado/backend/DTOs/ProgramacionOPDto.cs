namespace TiempoProcesos.API.DTOs;

public class TiempoAuxiliarDto
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Horas { get; set; }
}

public class ProgramacionProcesoInputDto
{
    public string Proceso { get; set; } = string.Empty;
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public List<TiempoAuxiliarDto> TiemposAuxiliares { get; set; } = new();
}

public class CrearProgramacionOPDto
{
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    public string? Color { get; set; }
    public List<ProgramacionProcesoInputDto> Procesos { get; set; } = new();
}

public class ProgramacionProcesoProgresoDto
{
    public int Id { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public List<TiempoAuxiliarDto> TiemposAuxiliares { get; set; } = new();
    public string Estado { get; set; } = "pendiente";
    public decimal CantidadProducida { get; set; }
    public int PorcentajeTiempo { get; set; }
}

public class ProgramacionOPDetalleDto
{
    public int Id { get; set; }
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    public string? Color { get; set; }
    public DateTime FechaCreacion { get; set; }
    public List<ProgramacionProcesoProgresoDto> Procesos { get; set; } = new();
    public int ProgresoGeneral { get; set; }
}
