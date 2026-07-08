using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Actividad de la "Evaluación por Área": cada usuario de área registra lo que debe cumplir
/// y la marca como cumplida o no cumplida (con motivo). El admin las consolida en un reporte.
/// </summary>
[Table("EvaluacionArea_Actividades")]
public class EvaluacionArea_Actividad
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    [JsonPropertyName("area")]
    public string Area { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(2000)]
    [JsonPropertyName("descripcion")]
    public string? Descripcion { get; set; }

    /// <summary>'pendiente' | 'cumplida' | 'no_cumplida'</summary>
    [Required]
    [MaxLength(20)]
    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "pendiente";

    [MaxLength(2000)]
    [JsonPropertyName("razonNoCumplimiento")]
    public string? RazonNoCumplimiento { get; set; }

    [JsonPropertyName("anio")]
    public int Anio { get; set; }

    [JsonPropertyName("mes")]
    public int Mes { get; set; }

    [JsonPropertyName("creadoPorId")]
    public int? CreadoPorId { get; set; }

    [MaxLength(200)]
    [JsonPropertyName("creadoPorNombre")]
    public string? CreadoPorNombre { get; set; }

    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("fechaModificacion")]
    public DateTime? FechaModificacion { get; set; }

    [JsonPropertyName("fechaCumplimiento")]
    public DateTime? FechaCumplimiento { get; set; }
}
