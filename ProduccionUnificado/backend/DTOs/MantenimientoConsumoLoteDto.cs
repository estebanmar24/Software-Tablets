namespace TiempoProcesos.API.DTOs;

public class MantenimientoConsumoLineaDto
{
    public int ProductoId { get; set; }
    public decimal Cantidad { get; set; }
}

public class MantenimientoConsumoLoteDto
{
    public DateTime Fecha { get; set; }
    public int? MaquinaId { get; set; }
    public int? HojaVidaId { get; set; }
    public int? MantenimientoHojaVidaId { get; set; }
    public string? TipoMantenimiento { get; set; }
    public int? BitacoraId { get; set; }
    public string? Responsable { get; set; }
    public string? Nota { get; set; }
    public List<MantenimientoConsumoLineaDto> Lineas { get; set; } = [];
}
