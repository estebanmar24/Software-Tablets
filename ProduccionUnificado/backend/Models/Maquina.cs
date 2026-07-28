using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Maquina
{
    public int Id { get; set; }
    
    public string Nombre { get; set; } = string.Empty;
    
    // Cloud uses usage INT for this? Script said: MetaRendimiento INT NOT NULL
    public int MetaRendimiento { get; set; }
    
    [Column(TypeName = "decimal(5, 4)")]
    public decimal MetaDesperdicio { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ValorPorTiro { get; set; }
    
    public int TirosReferencia { get; set; }
    
    public int SemaforoMin { get; set; }
    public int SemaforoNormal { get; set; }
    public int SemaforoMax { get; set; }
    
    // Nuevas columnas
    [Column(TypeName = "decimal(5, 2)")]
    public decimal Importancia { get; set; } = 0;
    public int Meta100Porciento { get; set; } = 0;
    
    [Column("Activa")]
    public bool Activo { get; set; } = true;

    // Tarifa por hora (entero, miles)
    public int Tarifa { get; set; } = 0;

    /// <summary>Horas de alistamiento por defecto al programar (editable).</summary>
    [Column(TypeName = "decimal(8, 2)")]
    public decimal HorasAlistamiento { get; set; } = 1.0m;

    /// <summary>Horas de lavada por defecto al programar (editable).</summary>
    [Column(TypeName = "decimal(8, 2)")]
    public decimal HorasLavada { get; set; } = 0.5m;

    /// <summary>Operativa | Dañada | Mantenimiento</summary>
    [Column(TypeName = "character varying(32)")]
    public string EstadoOperativo { get; set; } = "Operativa";
}
