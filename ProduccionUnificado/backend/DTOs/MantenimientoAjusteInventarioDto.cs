namespace TiempoProcesos.API.DTOs;

public class AjusteInventarioRequest
{
    public int ProductoId { get; set; }
    /// <summary>ENTRADA o SALIDA</summary>
    public string Tipo { get; set; } = "";
    public decimal Cantidad { get; set; }
    public string Razon { get; set; } = "";
    public DateTime? Fecha { get; set; }
}
