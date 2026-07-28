using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>Día marcado como festivo en el roster (persistido por fecha).</summary>
public class RosterDiaFestivo
{
    public int Id { get; set; }

    [Column(TypeName = "date")]
    public DateTime FechaDia { get; set; }

    public string? Observacion { get; set; }
}
