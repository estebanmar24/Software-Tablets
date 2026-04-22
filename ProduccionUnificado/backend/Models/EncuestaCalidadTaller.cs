using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class EncuestaCalidadTaller
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    
    public string HoraLlegada { get; set; } = string.Empty;
    public string HoraSalida { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string NumeroRemision { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal CantidadProducir { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal CantidadEvaluada { get; set; }
    
    public string EstadoProceso { get; set; } = string.Empty;
    
    // Quality questions
    public bool TieneMuestra { get; set; }
    public string? TipoProducto { get; set; }
    public bool ConoceFormaEmpaque { get; set; }
    public bool TieneRemision { get; set; }
    public bool TieneInsumosCompletos { get; set; }
    
    public bool VariacionTono { get; set; }
    public string? FotoVariacionTono { get; set; }

    public bool QuebradoArrugado { get; set; }
    public string? FotoQuebradoArrugado { get; set; }

    public bool EsquinaDefectuosa { get; set; }
    public string? FotoEsquinaDefectuosa { get; set; }

    public bool PresenciaPestanas { get; set; }
    public string? FotoPresenciaPestanas { get; set; }

    public bool DesgasteImpresion { get; set; }
    public string? FotoDesgasteImpresion { get; set; }

    public bool Manchas { get; set; }
    public string? FotoManchas { get; set; }

    public bool ReservaPega { get; set; }
    public string? FotoReservaPega { get; set; }

    public bool GrafadoRoto { get; set; }
    public string? FotoGrafadoRoto { get; set; }
    
    public bool NovedadBPM { get; set; }
    public string? FotoNovedadBPM { get; set; }

    public bool UsaCofia { get; set; }
    public string? FotoUsaCofia { get; set; }

    public bool InsumosPendientes { get; set; }
    public string? TipoInsumosPendientes { get; set; }
    public string? FotoInsumosPendientes { get; set; }
    public string? Observaciones { get; set; }

    public int UsuarioId { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.Now;

    // Navigation properties
    public TallerExterno? Taller { get; set; }
    
    [ForeignKey("UsuarioId")]
    public AdminUsuario? AdminUsuario { get; set; }
}
