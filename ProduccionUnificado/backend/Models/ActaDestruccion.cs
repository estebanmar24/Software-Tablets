namespace TiempoProcesos.API.Models;

public class ActaDestruccion
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
    public string Estado { get; set; } = string.Empty; // Terminado o Parcial
    public string? ArchivoPdfPath { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.Now;

    // Relación con múltiples procesos
    public List<ActaDestruccionProceso> Procesos { get; set; } = new();
}
