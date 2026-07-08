namespace TiempoProcesos.API.Models;

public class ConsolidadoNC
{
    public int Id { get; set; }
    
    // FK to Encuesta Producción
    public int EncuestaProduccionId { get; set; }
    public EncuestaCalidadProduccion? EncuestaProduccion { get; set; }
    
    // Auto-populated from Encuesta
    public DateTime Fecha { get; set; }
    public string OrdenProduccion { get; set; } = string.Empty;
    public string? Cliente { get; set; }
    public string? Referencia { get; set; }
    public decimal CantidadTotal { get; set; }  // From CantidadAProducir
    public string? DescripcionNovedad { get; set; }  // From Observaciones
    
    // Manual fields
    /// <summary>Alcance interno / externo (antes se usaba TipoReclamacion para INTERNO/EXTERNO).</summary>
    public string? Alcance { get; set; }
    /// <summary>Queja, reclamo, devolución, otro (catálogo dinámico).</summary>
    public string? TipoReclamacion { get; set; }
    public decimal CantidadNC { get; set; } = 0;
    public string? Item { get; set; }
    public string? TipoDefecto { get; set; }
    public string? Responsable { get; set; }
    public string? AreaInvolucrada { get; set; }
    public string? Cargo { get; set; }
    public decimal ValorNC { get; set; } = 0;  // COP $
    public string? Producto { get; set; }
    public string? SalidaNC { get; set; }
    public string? Controles { get; set; }
    
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
}
