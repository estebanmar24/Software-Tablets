using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Excepción de turno por día: incluir un turno solo ese día, o excluir uno del config de la máquina.
/// </summary>
public class RosterTurnoDia
{
    public int Id { get; set; }
    [Column(TypeName = "date")]
    public DateTime FechaDia { get; set; }
    public int MaquinaId { get; set; }
    public Maquina? Maquina { get; set; }
    public int HorarioId { get; set; }
    public Horario? Horario { get; set; }
    /// <summary>true = agregar ese día; false = quitar ese día (aunque esté en config de máquina).</summary>
    public bool Incluir { get; set; }
}
