namespace TiempoProcesos.API.DTOs;

public class EncuestaOrdenAseoDto
{
    public int? Id { get; set; }
    public string ProcesoAuditado { get; set; } = string.Empty;
    public string NombreAuditado { get; set; } = string.Empty;
    public string Planta { get; set; } = string.Empty;
    
    // Pregunta 1
    public bool ImplementosAseo { get; set; }
    public string? FotoImplementosAseoBase64 { get; set; }
    
    // Pregunta 2
    public bool HerramientasLugar { get; set; }
    public string? FotoHerramientasLugarBase64 { get; set; }
    
    // Pregunta 3
    public bool TarrosRotulados { get; set; }
    public string? FotoTarrosRotuladosBase64 { get; set; }
    
    // Pregunta 4
    public bool AreaDespejada { get; set; }
    public string? FotoAreaDespejadaBase64 { get; set; }
    
    // Pregunta 5
    public bool RutasEvacuacion { get; set; }
    public string? FotoRutasEvacuacionBase64 { get; set; }
    
    // Pregunta 6
    public bool MesasTrabajo { get; set; }
    public string? FotoMesasTrabajoBase64 { get; set; }
    
    public string? Observaciones { get; set; }
    public string? CreadoPor { get; set; }
}
