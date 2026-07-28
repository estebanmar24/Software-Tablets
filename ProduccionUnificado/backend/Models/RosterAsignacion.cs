using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>Asignación de persona a máquina/turno en un día concreto (roster semanal).</summary>
public class RosterAsignacion
{
    public int Id { get; set; }
    public int Anio { get; set; }
    /// <summary>Número de semana ISO (1–53).</summary>
    public int SemanaIso { get; set; }
    [Column(TypeName = "date")]
    public DateTime FechaDia { get; set; }
    public int MaquinaId { get; set; }
    public Maquina? Maquina { get; set; }
    public int HorarioId { get; set; }
    public Horario? Horario { get; set; }
    public int UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    /// <summary>false = operario; true = auxiliar.</summary>
    public bool EsAuxiliar { get; set; }
    /// <summary>Horario concreto del día (si null, usa el catálogo Horario).</summary>
    public TimeSpan? HoraInicio { get; set; }
    public TimeSpan? HoraFin { get; set; }
    /// <summary>Día de descanso planeado (celda DESCANSO).</summary>
    public bool EsDescanso { get; set; }
    /// <summary>Descuenta minutos de comida al calcular horas (horario personalizado).</summary>
    public bool DescuentaComida { get; set; }
    public int MinutosComida { get; set; }
}
