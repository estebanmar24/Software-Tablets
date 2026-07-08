using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>Texto y campos extraídos de Ficha técnica u OP en Adjuntos/.</summary>
[Table("Adjunto_DocumentoExtraccion")]
public class AdjuntoDocumentoExtraccion
{
    [Key]
    public int Id { get; set; }

    /// <summary>Número de OP (solo dígitos), ej. 7679.</summary>
    [Required, MaxLength(32)]
    public string Numero { get; set; } = string.Empty;

    /// <summary>Ficha | OP</summary>
    [Required, MaxLength(16)]
    public string Tipo { get; set; } = string.Empty;

    [Required, MaxLength(260)]
    public string ArchivoNombre { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? RutaRelativa { get; set; }

    /// <summary>PdfText | Ocr | PdfText+Ocr</summary>
    [Required, MaxLength(32)]
    public string Metodo { get; set; } = "PdfText";

    public string TextoCompleto { get; set; } = string.Empty;

    /// <summary>JSON con campos estructurados (cliente, medidas, fechas, etc.).</summary>
    public string DatosJson { get; set; } = "{}";

    [MaxLength(64)]
    public string? HashArchivo { get; set; }

    public DateTime FechaExtraccion { get; set; } = DateTime.UtcNow;

    public string? ErrorExtraccion { get; set; }
}
