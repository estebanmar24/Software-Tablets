using Microsoft.AspNetCore.Http;

namespace TiempoProcesos.API.DTOs;

public class ActaDestruccionResumenDto
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Producto { get; set; } = string.Empty;
    public decimal CantidadActaDestruccion { get; set; }
    public string ProcesoReporta { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public bool TienePdf { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class ActaDestruccionProcesoDto
{
    public int? Id { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public string Motivo { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
}

public class ActaDestruccionDetalleDto
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Producto { get; set; } = string.Empty;
    public decimal CantidadActaDestruccion { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public string ProcesoReporta { get; set; } = string.Empty;
    public decimal CantidadOP { get; set; }
    public decimal CantidadRealDespachada { get; set; }
    public decimal Faltante { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string? ArchivoPdfUrl { get; set; }
    public DateTime FechaCreacion { get; set; }
    
    // Desglose por procesos
    public List<ActaDestruccionProcesoDto> Procesos { get; set; } = new();
}

public class CrearActaDestruccionDto
{
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Producto { get; set; } = string.Empty;
    public decimal CantidadActaDestruccion { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public string ProcesoReporta { get; set; } = string.Empty;
    public decimal CantidadOP { get; set; }
    public decimal CantidadRealDespachada { get; set; }
    public decimal Faltante { get; set; }
    public string Estado { get; set; } = string.Empty;
    
    // Base64 document optional
    public string? ArchivoPdfBase64 { get; set; }

    // Desglose opcional de procesos
    public List<ActaDestruccionProcesoDto>? Procesos { get; set; }
}
