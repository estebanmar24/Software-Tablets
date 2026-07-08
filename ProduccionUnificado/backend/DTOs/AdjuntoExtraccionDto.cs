namespace TiempoProcesos.API.DTOs;

public class AdjuntoExtraccionDocumentoDto
{
    public string Tipo { get; set; } = string.Empty;
    public string ArchivoNombre { get; set; } = string.Empty;
    /// <summary>Ruta pública, ej. /adjuntos/op/OP7712.pdf</summary>
    public string? Url { get; set; }
    public string Metodo { get; set; } = string.Empty;
    public string TextoCompleto { get; set; } = string.Empty;
    public Dictionary<string, string> Campos { get; set; } = new();
    public DateTime? FechaExtraccion { get; set; }
    public string? Error { get; set; }
}

public class AdjuntoExtraccionOpDto
{
    public string Numero { get; set; } = string.Empty;
    public AdjuntoExtraccionDocumentoDto? Ficha { get; set; }
    public AdjuntoExtraccionDocumentoDto? Op { get; set; }
    public AdjuntoExtraccionDocumentoDto? LineaTroquel { get; set; }
}
