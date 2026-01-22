namespace TiempoProcesos.API.DTOs;

public class CrearEncuestaCalidadDto
{
    public int OperarioId { get; set; }
    public int? AuxiliarId { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public decimal CantidadProducir { get; set; }
    public int MaquinaId { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public decimal CantidadEvaluada { get; set; }
    public string EstadoProceso { get; set; } = string.Empty;
    public bool TieneFichaTecnica { get; set; }
    public bool CorrectoRegistroFormatos { get; set; }
    public bool AprobacionArranque { get; set; }
    public string? Observacion { get; set; }
    public List<NovedadDto> Novedades { get; set; } = new();
}

public class NovedadDto
{
    public string TipoNovedad { get; set; } = string.Empty;
    public string? FotoBase64 { get; set; }
    public string? FotoUrl { get; set; } // URL de foto existente a preservar
    public string? Descripcion { get; set; }
    public int CantidadDefectuosa { get; set; } = 0;
}

public class EncuestaCalidadResumenDto
{
    public int Id { get; set; }
    public string Operario { get; set; } = string.Empty;
    public string? Auxiliar { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Maquina { get; set; } = string.Empty;
    public string Proceso { get; set; } = string.Empty;
    public string EstadoProceso { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
    public int TotalNovedades { get; set; }
    public int TotalFotos { get; set; }
    public List<string> TiposNovedad { get; set; } = new List<string>();
}

public class EncuestaCalidadDetalleDto
{
    public int Id { get; set; }
    public int OperarioId { get; set; }
    public string Operario { get; set; } = string.Empty;
    public int? AuxiliarId { get; set; }
    public string? Auxiliar { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public decimal CantidadProducir { get; set; }
    public int MaquinaId { get; set; }
    public string Maquina { get; set; } = string.Empty;
    public string Proceso { get; set; } = string.Empty;
    public decimal CantidadEvaluada { get; set; }
    public string EstadoProceso { get; set; } = string.Empty;
    public bool TieneFichaTecnica { get; set; }
    public bool CorrectoRegistroFormatos { get; set; }
    public bool AprobacionArranque { get; set; }
    public string? Observacion { get; set; }
    public DateTime FechaCreacion { get; set; }
    public List<NovedadDetalleDto> Novedades { get; set; } = new();
}

public class NovedadDetalleDto
{
    public int Id { get; set; }
    public string TipoNovedad { get; set; } = string.Empty;
    public string? FotoUrl { get; set; }
    public string? Descripcion { get; set; }
    public int CantidadDefectuosa { get; set; }
}
