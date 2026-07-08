using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Definición de un checklist de auditoría personalizado (pestaña dinámica
/// además de CT-PAT e ILS). El código generado es C{id} (ej. C5).
/// </summary>
[Table("Audit_Checklist_Tipos")]
public class Audit_ChecklistTipo
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    [JsonPropertyName("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [JsonPropertyName("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(2000)]
    [JsonPropertyName("descripcion")]
    public string? Descripcion { get; set; }

    [JsonPropertyName("anio")]
    public int Anio { get; set; }

    [MaxLength(200)]
    [JsonPropertyName("creadoPorNombre")]
    public string? CreadoPorNombre { get; set; }

    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}
