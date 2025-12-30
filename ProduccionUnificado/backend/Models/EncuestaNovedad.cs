namespace TiempoProcesos.API.Models;

public class EncuestaNovedad
{
    public int Id { get; set; }
    public int EncuestaId { get; set; }
    public string TipoNovedad { get; set; } = string.Empty;
    public string? FotoPath { get; set; }
    public string? Descripcion { get; set; }
    public int CantidadDefectuosa { get; set; } = 0;
    
    // Navigation property
    public EncuestaCalidad? Encuesta { get; set; }
}
