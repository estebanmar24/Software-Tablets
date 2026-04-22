using System;

namespace TiempoProcesos.API.DTOs;

public class CrearEncuestaCalidadTallerDto
{
    public int TallerId { get; set; }
    public string? NombreTallerNuevo { get; set; }
    public string HoraLlegada { get; set; } = string.Empty;
    public string HoraSalida { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string NumeroRemision { get; set; } = string.Empty;
    public decimal CantidadProducir { get; set; }
    public decimal CantidadEvaluada { get; set; }
    public string EstadoProceso { get; set; } = string.Empty;
    public bool TieneMuestra { get; set; }
    public string? TipoProducto { get; set; }
    public bool ConoceFormaEmpaque { get; set; }
    public bool TieneRemision { get; set; }
    public bool TieneInsumosCompletos { get; set; }
    public bool VariacionTono { get; set; }
    public bool QuebradoArrugado { get; set; }
    public bool EsquinaDefectuosa { get; set; }
    public bool PresenciaPestanas { get; set; }
    public bool DesgasteImpresion { get; set; }
    public bool Manchas { get; set; }
    public bool ReservaPega { get; set; }
    public bool GrafadoRoto { get; set; }
    public bool NovedadBPM { get; set; }
    public bool UsaCofia { get; set; }
    public bool InsumosPendientes { get; set; }
    public string? TipoInsumosPendientes { get; set; }
    public string? Observaciones { get; set; }

    // Photos (Base64)
    public string? FotoVariacionTonoBase64 { get; set; }
    public string? FotoQuebradoArrugadoBase64 { get; set; }
    public string? FotoEsquinaDefectuosaBase64 { get; set; }
    public string? FotoPresenciaPestanasBase64 { get; set; }
    public string? FotoDesgasteImpresionBase64 { get; set; }
    public string? FotoManchasBase64 { get; set; }
    public string? FotoReservaPegaBase64 { get; set; }
    public string? FotoGrafadoRotoBase64 { get; set; }
    public string? FotoNovedadBPMBase64 { get; set; }
    public string? FotoUsaCofiaBase64 { get; set; }
    public string? FotoInsumosPendientesBase64 { get; set; }
}

public class EncuestaCalidadTallerResumenDto
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    public string TallerNombre { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string EstadoProceso { get; set; } = string.Empty;
    public string Inspector { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
}

public class EncuestaCalidadTallerDetalleDto
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    public string TallerNombre { get; set; } = string.Empty;
    public string HoraLlegada { get; set; } = string.Empty;
    public string HoraSalida { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string NumeroRemision { get; set; } = string.Empty;
    public decimal CantidadProducir { get; set; }
    public decimal CantidadEvaluada { get; set; }
    public string EstadoProceso { get; set; } = string.Empty;
    public bool TieneMuestra { get; set; }
    public string? TipoProducto { get; set; }
    public bool ConoceFormaEmpaque { get; set; }
    public bool TieneRemision { get; set; }
    public bool TieneInsumosCompletos { get; set; }
    public bool VariacionTono { get; set; }
    public bool QuebradoArrugado { get; set; }
    public bool EsquinaDefectuosa { get; set; }
    public bool PresenciaPestanas { get; set; }
    public bool DesgasteImpresion { get; set; }
    public bool Manchas { get; set; }
    public bool ReservaPega { get; set; }
    public bool GrafadoRoto { get; set; }
    public bool NovedadBPM { get; set; }
    public bool UsaCofia { get; set; }
    public bool InsumosPendientes { get; set; }
    public string? TipoInsumosPendientes { get; set; }
    public string? Observaciones { get; set; }
    
    // Photo Paths
    public string? FotoVariacionTono { get; set; }
    public string? FotoQuebradoArrugado { get; set; }
    public string? FotoEsquinaDefectuosa { get; set; }
    public string? FotoPresenciaPestanas { get; set; }
    public string? FotoDesgasteImpresion { get; set; }
    public string? FotoManchas { get; set; }
    public string? FotoReservaPega { get; set; }
    public string? FotoGrafadoRoto { get; set; }
    public string? FotoNovedadBPM { get; set; }
    public string? FotoUsaCofia { get; set; }
    public string? FotoInsumosPendientes { get; set; }
    public string Inspector { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
}
