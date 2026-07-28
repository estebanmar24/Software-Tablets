using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>Incapacidad, falta, permiso o baja que resta disponibilidad del roster.</summary>
public class PersonalNovedad
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    /// <summary>incapacidad | falta | permiso | baja</summary>
    public string Tipo { get; set; } = "falta";
    [Column(TypeName = "date")]
    public DateTime FechaInicio { get; set; }
    [Column(TypeName = "date")]
    public DateTime FechaFin { get; set; }
    public string? Observacion { get; set; }
    /// <summary>Si true, solo afecta media jornada (mañana o tarde).</summary>
    public bool MedioDia { get; set; }
    /// <summary>manana | tarde | null (jornada completa).</summary>
    [Column(TypeName = "character varying(16)")]
    public string? Jornada { get; set; }
}
