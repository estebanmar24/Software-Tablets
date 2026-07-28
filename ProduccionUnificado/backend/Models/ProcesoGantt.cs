namespace TiempoProcesos.API.Models;

/// <summary>Catálogo de procesos productivos del Gantt (orden configurable).</summary>
public class ProcesoGantt
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
}
