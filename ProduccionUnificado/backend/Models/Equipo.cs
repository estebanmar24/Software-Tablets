using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Modelo para gestión de equipos de cómputo
/// </summary>
public class Equipo
{
    public int Id { get; set; }
    
    // Identificación
    [Required]
    [MaxLength(50)]
    public string Nombre { get; set; } = string.Empty; // Ej: PC-001
    
    public DateTime? FechaInspeccion { get; set; }
    
    // Datos del Cliente/Usuario
    [MaxLength(100)]
    public string? Area { get; set; } // Departamento: Calidad, IT, Contabilidad, etc.
    
    [MaxLength(100)]
    public string? UsuarioAsignado { get; set; }
    
    [MaxLength(100)]
    public string? CorreoUsuario { get; set; }
    
    [MaxLength(100)]
    public string? ContrasenaEquipo { get; set; } // Contraseña del equipo
    
    [MaxLength(200)]
    public string? Ubicacion { get; set; } // Piso 1, Oficina 101
    
    // Estado del equipo
    [Required]
    [MaxLength(50)]
    public string Estado { get; set; } = "Disponible"; // Disponible, Asignado, EnMantenimiento
    
    // ============ DESCRIPCIÓN DEL HARDWARE - PC ============
    [MaxLength(50)]
    public string? PcMarca { get; set; }
    
    [MaxLength(100)]
    public string? PcModelo { get; set; }
    
    [MaxLength(100)]
    public string? PcSerie { get; set; }
    
    [MaxLength(50)]
    public string? PcInventario { get; set; }
    
    [MaxLength(100)]
    public string? PcCondicionesFisicas { get; set; }
    
    public bool PcEnciende { get; set; } = true;
    
    public bool PcTieneDiscoFlexible { get; set; } = false;
    
    public bool PcTieneCdDvd { get; set; } = false;
    
    public bool PcBotonesCompletos { get; set; } = true;
    
    [MaxLength(100)]
    public string? Procesador { get; set; }
    
    [MaxLength(50)]
    public string? MemoriaRam { get; set; } // Ej: "8 gigas"
    
    [MaxLength(50)]
    public string? DiscoDuro { get; set; } // Ej: "512 gigas"
    
    // ============ MONITOR ============
    [MaxLength(50)]
    public string? MonitorMarca { get; set; }
    
    [MaxLength(100)]
    public string? MonitorModelo { get; set; }
    
    [MaxLength(100)]
    public string? MonitorSerie { get; set; }
    
    [MaxLength(100)]
    public string? MonitorCondicionesFisicas { get; set; }
    
    public bool MonitorEnciende { get; set; } = true;
    
    public bool MonitorColoresCorrectos { get; set; } = true;
    
    public bool MonitorBotonesCompletos { get; set; } = true;
    
    // ============ TECLADO ============
    [MaxLength(50)]
    public string? TecladoMarca { get; set; }
    
    [MaxLength(100)]
    public string? TecladoModelo { get; set; }
    
    [MaxLength(100)]
    public string? TecladoSerie { get; set; }
    
    [MaxLength(100)]
    public string? TecladoCondicionesFisicas { get; set; }
    
    public bool TecladoFuncionaCorrectamente { get; set; } = true;
    
    public bool TecladoBotonesCompletos { get; set; } = true;
    
    public bool TecladoSeReemplazo { get; set; } = false;
    
    // ============ MOUSE ============
    [MaxLength(50)]
    public string? MouseMarca { get; set; }
    
    [MaxLength(100)]
    public string? MouseModelo { get; set; }
    
    [MaxLength(100)]
    public string? MouseSerie { get; set; }
    
    [MaxLength(100)]
    public string? MouseCondicionesFisicas { get; set; }
    
    public bool MouseFuncionaCorrectamente { get; set; } = true;
    
    public bool MouseBotonesCompletos { get; set; } = true;
    
    // ============ OTROS DISPOSITIVOS (Impresora, Escáner) ============
    [MaxLength(50)]
    public string? ImpresoraMarca { get; set; }
    
    [MaxLength(100)]
    public string? ImpresoraModelo { get; set; }
    
    [MaxLength(100)]
    public string? ImpresoraSerie { get; set; }
    
    [MaxLength(50)]
    public string? EscanerMarca { get; set; }
    
    [MaxLength(100)]
    public string? EscanerModelo { get; set; }
    
    [MaxLength(100)]
    public string? EscanerSerie { get; set; }
    
    [MaxLength(500)]
    public string? OtrosDispositivos { get; set; } // JSON o texto libre
    
    // ============ SOFTWARE ============
    [MaxLength(100)]
    public string? SistemaOperativo { get; set; } // Windows 10, Windows 11
    
    [MaxLength(100)]
    public string? VersionOffice { get; set; } // Office 2021, 365
    
    [MaxLength(500)]
    public string? OtroSoftware { get; set; } // Otros programas instalados
    
    // ============ FECHAS DE MANTENIMIENTO ============
    public DateTime? UltimoMantenimiento { get; set; }
    
    public DateTime? ProximoMantenimiento { get; set; }
    
    [MaxLength(1000)]
    public string? MantenimientoRequerido { get; set; } // Descripción del trabajo que se debe realizar

    [MaxLength(20)]
    public string? Prioridad { get; set; } // Alta, Media, Baja
    
    [MaxLength(1000)]
    public string? Observaciones { get; set; } // Notas adicionales sobre el equipo
    
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    
    public DateTime? FechaActualizacion { get; set; }
    
    // Navigation
    public List<HistorialMantenimiento> Mantenimientos { get; set; } = new();
}
