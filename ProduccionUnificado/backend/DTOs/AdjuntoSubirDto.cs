namespace TiempoProcesos.API.DTOs;

public class AdjuntoSubirResponseDto
{
    public string Numero { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string ArchivoNombre { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public AdjuntoExtraccionDocumentoDto? Extraccion { get; set; }
}
