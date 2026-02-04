namespace TiempoProcesos.API.Models;

public class EncuestaOrdenAseo
{
    public int Id { get; set; }
    
    // Campos principales
    public string ProcesoAuditado { get; set; } = string.Empty;
    public string NombreAuditado { get; set; } = string.Empty;
    public string Planta { get; set; } = string.Empty; // "PLANTA 1" o "PLANTA 2"
    
    // Pregunta 1: ¿Los implementos de aseo se encuentran en su respectivo soporte y bien ubicados?
    public bool ImplementosAseo { get; set; }
    public string? FotoImplementosAseo { get; set; }
    
    // Pregunta 2: ¿Las herramientas en el lugar de trabajo están acomodadas, limpias y se encuentran en su sitio?
    public bool HerramientasLugar { get; set; }
    public string? FotoHerramientasLugar { get; set; }
    
    // Pregunta 3: ¿Existen tarros debidamente rotulados y bien etiquetados?
    public bool TarrosRotulados { get; set; }
    public string? FotoTarrosRotulados { get; set; }
    
    // Pregunta 4: ¿El área de trabajo se encuentra despejada con los materiales debidamente identificados y en su lugar?
    public bool AreaDespejada { get; set; }
    public string? FotoAreaDespejada { get; set; }
    
    // Pregunta 5: ¿Las rutas de evacuación están despejadas?
    public bool RutasEvacuacion { get; set; }
    public string? FotoRutasEvacuacion { get; set; }
    
    // Pregunta 6: ¿Las mesas de trabajo están limpias, sin elementos no permitidos?
    public bool MesasTrabajo { get; set; }
    public string? FotoMesasTrabajo { get; set; }
    
    // Campos adicionales
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public string? CreadoPor { get; set; }
}
