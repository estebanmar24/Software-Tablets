namespace TiempoProcesos.API.Models;

public class EncuestaCalidad
{
    public int Id { get; set; }
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
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
    public string? CreadoPor { get; set; }
    
    // Navigation properties
    public Usuario? Operario { get; set; }
    public Usuario? Auxiliar { get; set; }
    public Maquina? Maquina { get; set; }
    public List<EncuestaNovedad> Novedades { get; set; } = new();
}
