using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Item de un checklist de auditoría (CT-PAT o ILS). Funciona como una
/// "tarea" asignable a uno o varios usuarios, con estado completada /
/// no completada / pendiente y fecha-hora de cierre.
/// </summary>
[Table("Audit_Checklist_Items")]
public class Audit_Checklist
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>Código de tipo: 'CTPAT', 'ILS' o personalizado 'C{id}'.</summary>
    [Required]
    [MaxLength(50)]
    [JsonPropertyName("tipo")]
    public string Tipo { get; set; } = "CTPAT";

    /// <summary>ID numérico de referencia asignado manualmente (ej. número de ítem del checklist).</summary>
    [JsonPropertyName("numeroActividad")]
    public int? NumeroActividad { get; set; }

    [Required]
    [MaxLength(500)]
    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [MaxLength(4000)]
    [JsonPropertyName("descripcion")]
    public string? Descripcion { get; set; }

    /// <summary>'pendiente' | 'completada' | 'no_completada'</summary>
    [Required]
    [MaxLength(20)]
    [JsonPropertyName("estado")]
    public string Estado { get; set; } = "pendiente";

    [MaxLength(2000)]
    [JsonPropertyName("razonNoCompletada")]
    public string? RazonNoCompletada { get; set; }

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

    /// <summary>Fecha/hora en la que el responsable marcó completada o no completada.</summary>
    [JsonPropertyName("fechaCierre")]
    public DateTime? FechaCierre { get; set; }

    [MaxLength(200)]
    [JsonPropertyName("cerradaPorNombre")]
    public string? CerradaPorNombre { get; set; }

    /// <summary>Responsables asignados (relación N:M con AdminUsuarios).</summary>
    [JsonPropertyName("responsables")]
    public List<Audit_ChecklistResponsable> Responsables { get; set; } = new();
}

/// <summary>Asignación de responsable a un item de checklist (relación N:M).</summary>
[Table("Audit_Checklist_Responsables")]
public class Audit_ChecklistResponsable
{
    [Key]
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [Required]
    [JsonPropertyName("checklistId")]
    public int ChecklistId { get; set; }

    [ForeignKey(nameof(ChecklistId))]
    [JsonIgnore]
    public Audit_Checklist? Checklist { get; set; }

    [JsonPropertyName("usuarioId")]
    public int? UsuarioId { get; set; }

    [MaxLength(200)]
    [JsonPropertyName("usuarioNombre")]
    public string? UsuarioNombre { get; set; }

    [MaxLength(200)]
    [JsonPropertyName("usuarioEmail")]
    public string? UsuarioEmail { get; set; }

    [JsonPropertyName("notificadoEn")]
    public DateTime? NotificadoEn { get; set; }
}
