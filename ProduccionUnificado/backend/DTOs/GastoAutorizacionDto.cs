namespace TiempoProcesos.API.DTOs;

public class GastoAutorizacionSolicitudDto
{
    public string Id { get; set; } = string.Empty;
    public string Modulo { get; set; } = string.Empty;
    public string? RubroId { get; set; }
    public string? RubroNombre { get; set; }
    public string? ProveedorId { get; set; }
    public string? ProveedorNombre { get; set; }
    public string FechaAproximada { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public string Razon { get; set; } = string.Empty;
    public bool EsSolicitudCredito { get; set; }
    public bool EsEfectivo { get; set; }
    public string EstadoAutorizacion { get; set; } = "Pendiente";
    public string? SolicitadoPorNombre { get; set; }
    public string? SolicitadoPorId { get; set; }
    public string? AutorizadoPorNombre { get; set; }
    public string FechaSolicitud { get; set; } = string.Empty;
    public string? FechaResolucion { get; set; }
    public string? MotivoRechazo { get; set; }
    public string? GastoId { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public bool PuedeRegistrarGasto { get; set; }
    public bool PuedeAutorizar { get; set; }
    public bool PuedeEditar { get; set; }
    public bool PuedeEliminar { get; set; }
    public int TotalComentarios { get; set; }
}

public class GastoAutorizacionWriteDto
{
    public string Modulo { get; set; } = string.Empty;
    public string? RubroId { get; set; }
    public string? RubroNombre { get; set; }
    public string? ProveedorId { get; set; }
    public string? ProveedorNombre { get; set; }
    public string? FechaAproximada { get; set; }
    public decimal? Cantidad { get; set; }
    public string? Razon { get; set; }
    public bool? EsSolicitudCredito { get; set; }
    public bool? EsEfectivo { get; set; }
    public int? Anio { get; set; }
    public int? Mes { get; set; }
}

public class GastoAutorizacionRechazoDto
{
    public string? MotivoRechazo { get; set; }
}

public class GastoAutorizacionComentarioDto
{
    public string Id { get; set; } = string.Empty;
    public string Texto { get; set; } = string.Empty;
    public string? UsuarioNombre { get; set; }
    public string Fecha { get; set; } = string.Empty;
    public string? Hora { get; set; }
    public List<GastoAutorizacionComentarioDto> Respuestas { get; set; } = new();
}

public class GastoAutorizacionComentarioWriteDto
{
    public string Texto { get; set; } = string.Empty;
    public string? ParentId { get; set; }
}
