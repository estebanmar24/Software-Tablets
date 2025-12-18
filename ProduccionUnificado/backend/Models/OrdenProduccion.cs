namespace TiempoProcesos.API.Models;

public class OrdenProduccion
{
    public int Id { get; set; }
    public string Numero { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string Estado { get; set; } = "Pendiente"; // Pendiente, EnProceso, Completada
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
}
