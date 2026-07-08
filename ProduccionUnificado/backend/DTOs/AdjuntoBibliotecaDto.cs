namespace TiempoProcesos.API.DTOs;

public class AdjuntoExtraccionResumenDto
{
    public string Tipo { get; set; } = string.Empty;
    public string ArchivoNombre { get; set; } = string.Empty;
    public string? Url { get; set; }
    public string Metodo { get; set; } = string.Empty;
    public DateTime? FechaExtraccion { get; set; }
    public string? Error { get; set; }
    public Dictionary<string, string> Campos { get; set; } = new();
    public int TextoLongitud { get; set; }
}

public class AdjuntoBibliotecaItemDto
{
    public string Numero { get; set; } = string.Empty;
    public bool TieneFicha { get; set; }
    public bool TieneOp { get; set; }
    public bool TieneLineaTroquel { get; set; }
    public DateTime? FichaModificado { get; set; }
    public DateTime? OpModificado { get; set; }
    public DateTime? LineaTroquelModificado { get; set; }
    public AdjuntoExtraccionResumenDto? Ficha { get; set; }
    public AdjuntoExtraccionResumenDto? Op { get; set; }
    public AdjuntoExtraccionResumenDto? LineaTroquel { get; set; }
}

public class AdjuntoBibliotecaListaDto
{
    public int Total { get; set; }
    public List<AdjuntoBibliotecaItemDto> Items { get; set; } = new();
}
