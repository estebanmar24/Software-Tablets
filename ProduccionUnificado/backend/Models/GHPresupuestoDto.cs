namespace TiempoProcesos.API.Models;

/// <summary>
/// DTO for bulk presupuesto update in GH module.
/// </summary>
public class GHPresupuestoDto
{
    public int TipoServicioId { get; set; }
    public int Anio { get; set; }
    public int Mes { get; set; }
    public decimal Presupuesto { get; set; }
}
