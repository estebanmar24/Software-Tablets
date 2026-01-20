namespace TiempoProcesos.API.Models;

/// <summary>
/// DTO para recibir datos de producción diaria desde el frontend (CaptureGridScreen)
/// </summary>
public class ProduccionDiariaDto
{
    public string Fecha { get; set; } = string.Empty;
    public int UsuarioId { get; set; }
    public int MaquinaId { get; set; }
    public string? HoraInicio { get; set; }
    public string? HoraFin { get; set; }
    public decimal HorasOperativas { get; set; }
    public decimal RendimientoFinal { get; set; }
    public int Cambios { get; set; }
    public decimal TiempoPuestaPunto { get; set; }
    public decimal TirosDiarios { get; set; }
    public decimal TotalHorasProductivas { get; set; }
    public decimal PromedioHoraProductiva { get; set; }
    public decimal ValorTiroSnapshot { get; set; }
    public decimal ValorAPagar { get; set; }
    public decimal HorasMantenimiento { get; set; }
    public decimal HorasDescanso { get; set; }
    public decimal HorasOtrosAux { get; set; }
    public decimal TiempoFaltaTrabajo { get; set; }
    public decimal TiempoReparacion { get; set; }
    public decimal TiempoOtroMuerto { get; set; }
    public string? ReferenciaOP { get; set; }
    public string? Novedades { get; set; }
    public decimal Desperdicio { get; set; }
    public int DiaLaborado { get; set; } = 1;
}
