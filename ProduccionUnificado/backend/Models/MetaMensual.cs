using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class MetaMensual
{
    public int Id { get; set; }
    
    public int MaquinaId { get; set; }
    public Maquina Maquina { get; set; } = null!;
    
    public int Mes { get; set; }   // 1-12
    public int Anio { get; set; }  // e.g. 2026
    
    public int Meta100Porciento { get; set; }
    public int MetaRendimiento { get; set; }
    
    [Column(TypeName = "decimal(5, 2)")]
    public decimal Importancia { get; set; }
    
    public int TirosReferencia { get; set; }
    
    [Column(TypeName = "decimal(10, 2)")]
    public decimal ValorPorTiro { get; set; }
    
    public int Tarifa { get; set; }
}
