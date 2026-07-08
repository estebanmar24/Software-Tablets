using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Produccion_Gastos")]
public class Produccion_Gasto
{
    public int Id { get; set; }

    public int RubroId { get; set; }
    [ForeignKey("RubroId")]
    public Produccion_Rubro? Rubro { get; set; }

    public int? ProveedorId { get; set; }
    [ForeignKey("ProveedorId")]
    public Produccion_Proveedor? Proveedor { get; set; }

    // Admin who created the record
    public int? CreadoPorId { get; set; }
    [ForeignKey("CreadoPorId")]
    public AdminUsuario? CreadoPor { get; set; }

    public int? UsuarioId { get; set; } // For Overtime (Operario)
    [ForeignKey("UsuarioId")]
    public TiempoProcesos.API.Models.Usuario? Usuario { get; set; }

    public int? MaquinaId { get; set; } // For Maintenance
    [ForeignKey("MaquinaId")]
    public Maquina? Maquina { get; set; }

    public int? TipoHoraId { get; set; } // For Overtime Rate
    [ForeignKey("TipoHoraId")]
    public Produccion_TipoHora? TipoHora { get; set; }

    public int? TipoRecargoId { get; set; } // For Surcharge Rate
    [ForeignKey("TipoRecargoId")]
    public Produccion_TipoRecargo? TipoRecargo { get; set; }

    public int Anio { get; set; }
    public int Mes { get; set; }
    public decimal Precio { get; set; }
    /// <summary>Base sin IVA (gastos normales). Null = legado antes del desglose.</summary>
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioBase { get; set; }
    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioIva { get; set; }
    public DateTime Fecha { get; set; }
    public string? Nota { get; set; }
    
    // Optional: store hours for history
    public decimal? CantidadHoras { get; set; }

    /// <summary>Horario capturado (HH:mm) para horas extras / recargos.</summary>
    public string? HoraInicio { get; set; }
    public string? HoraFin { get; set; }
    
    // OP Number for Horas Extras and Recargos
    public string? NumeroOP { get; set; }

    // Invoice fields (required for non-Horas Extras rubros)
    public string? NumeroFactura { get; set; }
    public string? FacturaPdfUrl { get; set; }
    
    // Status
    public bool EsPendiente { get; set; }
    public bool EsSolicitudCredito { get; set; } = false;
    /// <summary>Pago en efectivo (mutuamente excluyente con solicitud de crédito para gastos normales).</summary>
    public bool EsEfectivo { get; set; } = false;
    
    // History tracking
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaModificacion { get; set; }

    [MaxLength(50)]
    public string Estado { get; set; } = "Montado";
}
