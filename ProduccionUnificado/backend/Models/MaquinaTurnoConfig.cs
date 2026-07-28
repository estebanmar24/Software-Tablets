using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>Turnos habilitados por máquina (1 o N; el doble turno varía por máquina).</summary>
public class MaquinaTurnoConfig
{
    public int Id { get; set; }
    public int MaquinaId { get; set; }
    public Maquina? Maquina { get; set; }
    public int HorarioId { get; set; }
    public Horario? Horario { get; set; }
    public bool Activo { get; set; } = true;
    public bool RequiereOperario { get; set; } = true;
    public int AuxiliaresRequeridos { get; set; } = 0;
}
