namespace TiempoProcesos.API.DTOs;

public class MantenimientoConsumoWriteDto
{
    public int ProductoId { get; set; }
    public decimal Cantidad { get; set; }
    public DateTime Fecha { get; set; }
    public int? MaquinaId { get; set; }
    public int? HojaVidaId { get; set; }
    public string? TipoMantenimiento { get; set; }
    /// <summary>Mantenimiento registrado en Maquinaria al que se cargan los materiales.</summary>
    public int? MantenimientoHojaVidaId { get; set; }
    public int? BitacoraId { get; set; }
    public List<int>? ActividadIds { get; set; }
    public string? Responsable { get; set; }
    public string? Nota { get; set; }
}
