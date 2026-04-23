using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class HojaVidaMaquina
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Nombre { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string? NumeroInventario { get; set; }
    
    [MaxLength(100)]
    public string? Marca { get; set; }
    
    [MaxLength(100)]
    public string? Serie { get; set; }
    
    [MaxLength(100)]
    public string? Modelo { get; set; }
    
    [MaxLength(50)]
    public string? Color { get; set; }
    
    public DateTime? FechaCompra { get; set; }
    
    [MaxLength(100)]
    public string? VidaUtil { get; set; }
    
    // Foto principal (opcional, para compatibilidad)
    [MaxLength(500)]
    public string? FotoUrl { get; set; }
    
    public string? EppsYRiesgos { get; set; }
    
    public string? Senalizacion { get; set; }
    
    public string? RiesgosAsociados { get; set; }
    
    public bool Activo { get; set; } = true;
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Campos del encabezado del formato
    public string CodigoFormato { get; set; } = "FO-GM-001";
    public string VersionFormato { get; set; } = "0";

    // Nuevos campos informativos
    [MaxLength(100)]
    public string? Proceso { get; set; }
    [MaxLength(100)]
    public string? Ubicacion { get; set; }

    // Ficha Técnica (Opcionales)
    [MaxLength(50)]
    public string? Voltaje { get; set; }
    [MaxLength(50)]
    public string? Corriente { get; set; }
    [MaxLength(50)]
    public string? Potencia { get; set; }
    [MaxLength(100)]
    public string? Dimensiones { get; set; }
    [MaxLength(50)]
    public string? Peso { get; set; }
    public string? OtroTecnico { get; set; }

    // Navegación
    public List<MantenimientoHojaVida> Mantenimientos { get; set; } = new();
    public List<HojaVidaFoto> Fotos { get; set; } = new();
}

public class HojaVidaFoto
{
    public int Id { get; set; }
    public int HojaVidaId { get; set; }
    
    [MaxLength(500)]
    public string Url { get; set; } = string.Empty;
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    [ForeignKey("HojaVidaId")]
    public HojaVidaMaquina? HojaVida { get; set; }
}

public class MantenimientoHojaVida
{
    public int Id { get; set; }
    public int HojaVidaId { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string TipoMantenimiento { get; set; } = string.Empty; // Correctivo, Preventivo, Limpieza, Ajuste, Calibración
    
    public DateTime Fecha { get; set; }
    
    [MaxLength(100)]
    public string? EjecutadoPor { get; set; }
    
    public string? Observacion { get; set; }
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    // Navegación
    public List<MantenimientoFoto> Fotos { get; set; } = new();

    [ForeignKey("HojaVidaId")]
    public HojaVidaMaquina? HojaVida { get; set; }
}

public class MantenimientoFoto
{
    public int Id { get; set; }
    public int MantenimientoId { get; set; }
    
    [MaxLength(500)]
    public string Url { get; set; } = string.Empty;
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    [ForeignKey("MantenimientoId")]
    public MantenimientoHojaVida? Mantenimiento { get; set; }
}

public class BitacoraMaquina
{
    public int Id { get; set; }
    public int HojaVidaId { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    
    [MaxLength(50)]
    public string Turno { get; set; } = string.Empty;
    
    [Required]
    public string Descripcion { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string EstadoMaquina { get; set; } = "Operativa";
    
    [MaxLength(100)]
    public string RegistradoPor { get; set; } = string.Empty;
    
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    [ForeignKey("HojaVidaId")]
    public HojaVidaMaquina? HojaVida { get; set; }
}
