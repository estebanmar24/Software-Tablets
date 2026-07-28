namespace TiempoProcesos.API.DTOs;

public class OpPiezaMaterialDto
{
    public string? Material { get; set; }
    public string? Calibre { get; set; }
    public string? Gramaje { get; set; }
    public string? AnchoRollo { get; set; }
    public string? LargoCorte { get; set; }
    public string? AnchoPliego { get; set; }
    public string? AltoPliego { get; set; }
    public string? Hojas { get; set; }
    public string? Cabidad { get; set; }
    public string? TamanoFinal { get; set; }
}

public class OpPiezaProcesoDto
{
    public string Proceso { get; set; } = string.Empty;
    public string Notas { get; set; } = string.Empty;
    public string Cantidad { get; set; } = string.Empty;
    public string? CodigoOp { get; set; }
}

public class OpPiezaDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public OpPiezaMaterialDto Material { get; set; } = new();
    public List<OpPiezaProcesoDto> Procesos { get; set; } = new();
}
