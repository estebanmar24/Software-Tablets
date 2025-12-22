namespace TiempoProcesos.API.Models;

public class RendimientoOperarioMensual
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public int Mes { get; set; }
    public int Anio { get; set; }
    public decimal RendimientoPromedio { get; set; }
    public int TotalTiros { get; set; }
    public int TotalMaquinas { get; set; }
    public DateTime FechaCalculo { get; set; } = DateTime.Now;
    
    // Navigation property
    public Usuario? Usuario { get; set; }
}
