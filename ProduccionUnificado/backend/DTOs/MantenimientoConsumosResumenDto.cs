namespace TiempoProcesos.API.DTOs;

public class MantenimientoConsumoDetalleDto
{
    public int Id { get; set; }
    public int ProductoId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string ProductoNombre { get; set; } = string.Empty;
    public string? TipoProducto { get; set; }
    public string? RubroNombre { get; set; }
    /// <summary>equipos | materiales | repuestos</summary>
    public string CategoriaRecurso { get; set; } = "materiales";
    public decimal Cantidad { get; set; }
    public string? Medida { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

public class MantenimientoConsumosResumenDto
{
    public int MantenimientoHojaVidaId { get; set; }
    public int? MantenimientoConsecutivo { get; set; }
    public List<MantenimientoConsumoDetalleDto> Items { get; set; } = [];
    public decimal ValorTotal { get; set; }
    public string EquiposTexto { get; set; } = string.Empty;
    public string MaterialesTexto { get; set; } = string.Empty;
    public string RepuestosTexto { get; set; } = string.Empty;
}
