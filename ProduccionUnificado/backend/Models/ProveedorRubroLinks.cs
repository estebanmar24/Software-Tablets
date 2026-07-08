using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Produccion_ProveedorRubros")]
public class Produccion_ProveedorRubro
{
    public int ProveedorId { get; set; }
    public int RubroId { get; set; }
    public Produccion_Proveedor? Proveedor { get; set; }
    public Produccion_Rubro? Rubro { get; set; }
}

[Table("Talleres_ProveedorRubros")]
public class Talleres_ProveedorRubro
{
    public int ProveedorId { get; set; }
    public int RubroId { get; set; }
    public Talleres_Proveedor? Proveedor { get; set; }
    public Talleres_Rubro? Rubro { get; set; }
}

[Table("Planeacion_ProveedorRubros")]
public class Planeacion_ProveedorRubro
{
    public int ProveedorId { get; set; }
    public int RubroId { get; set; }
    public Planeacion_Proveedor? Proveedor { get; set; }
    public Planeacion_Rubro? Rubro { get; set; }
}

[Table("Diseno_ProveedorRubros")]
public class Diseno_ProveedorRubro
{
    public int ProveedorId { get; set; }
    public int RubroId { get; set; }
    public Diseno_Proveedor? Proveedor { get; set; }
    public Diseno_Rubro? Rubro { get; set; }
}

[Table("Mantenimiento_ProveedorRubros")]
public class Mantenimiento_ProveedorRubro
{
    public int ProveedorId { get; set; }
    public int RubroId { get; set; }
    public Mantenimiento_Proveedor? Proveedor { get; set; }
    public Mantenimiento_Rubro? Rubro { get; set; }
}
