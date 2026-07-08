namespace TiempoProcesos.API.DTOs;

public class MantenimientoProductoPutDto
{
    public int Id { get; set; }
    public string? Nombre { get; set; }
    public int? RubroId { get; set; }
    public string? Referencia { get; set; }
    public string? Descripcion { get; set; }
    public string? Medida { get; set; }
    public string? TipoProducto { get; set; }
    public int? PuntoReorden { get; set; }
    public int? MaxStock { get; set; }
    public bool? Activo { get; set; }
}
