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
    public int Importancia { get; set; } = 1;
    public int Meta100Porciento { get; set; } = 0;
    
    [Column("Activa")]
    public bool Activo { get; set; } = true;
}
