using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Gasto_AutorizacionSolicitudes")]
public class GastoAutorizacionSolicitud
{
    public int Id { get; set; }

    /// <summary>produccion | planeacion | sst | gh | diseno | mantenimiento</summary>
    [Required, MaxLength(30)]
    public string Modulo { get; set; } = string.Empty;

    public int? RubroId { get; set; }

    [MaxLength(200)]
    public string? RubroNombre { get; set; }

    public int? ProveedorId { get; set; }

    [MaxLength(200)]
    public string? ProveedorNombre { get; set; }

    public DateTime FechaAproximada { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Cantidad { get; set; }

    [Required]
    public string Razon { get; set; } = string.Empty;

    public bool EsSolicitudCredito { get; set; }
    public bool EsEfectivo { get; set; }

    /// <summary>Pendiente | Autorizada | NoAutorizada</summary>
    [Required, MaxLength(20)]
    public string EstadoAutorizacion { get; set; } = "Pendiente";

    public int? SolicitadoPorId { get; set; }

    [MaxLength(200)]
    public string? SolicitadoPorNombre { get; set; }

    public int? AutorizadoPorId { get; set; }

    [MaxLength(200)]
    public string? AutorizadoPorNombre { get; set; }

    public DateTime FechaSolicitud { get; set; } = DateTime.UtcNow;

    public DateTime? FechaResolucion { get; set; }

    public string? MotivoRechazo { get; set; }

    /// <summary>Id del gasto en la tabla del módulo, tras registro completo.</summary>
    public int? GastoId { get; set; }

    public int Anio { get; set; }
    public int Mes { get; set; }

    public ICollection<GastoAutorizacionComentario> Comentarios { get; set; } = new List<GastoAutorizacionComentario>();
}

[Table("Gasto_AutorizacionComentarios")]
public class GastoAutorizacionComentario
{
    public int Id { get; set; }

    public int SolicitudId { get; set; }

    public int? ParentId { get; set; }

    [Required]
    public string Texto { get; set; } = string.Empty;

    public int? UsuarioId { get; set; }

    [MaxLength(200)]
    public string? UsuarioNombre { get; set; }

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public GastoAutorizacionSolicitud Solicitud { get; set; } = null!;

    public GastoAutorizacionComentario? Parent { get; set; }

    public ICollection<GastoAutorizacionComentario> Respuestas { get; set; } = new List<GastoAutorizacionComentario>();
}
