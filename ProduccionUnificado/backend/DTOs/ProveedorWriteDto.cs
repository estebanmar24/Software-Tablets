namespace TiempoProcesos.API.DTOs;

/// <summary>
/// DTO compartido para crear/actualizar proveedores con uno o varios rubros.
/// </summary>
public class ProveedorWriteDto
{
    public int? Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Nit { get; set; }
    public string? NitCedula { get; set; }
    public string? Telefono { get; set; }
    public string? Direccion { get; set; }
    public string? Correo { get; set; }
    public decimal? PrecioCotizado { get; set; }
    public int? RubroId { get; set; }
    public List<int>? RubroIds { get; set; }

    public List<int> ResolveRubroIds()
    {
        if (RubroIds != null && RubroIds.Count > 0)
            return RubroIds.Where(id => id > 0).Distinct().ToList();
        if (RubroId.HasValue && RubroId.Value > 0)
            return new List<int> { RubroId.Value };
        return new List<int>();
    }
}
