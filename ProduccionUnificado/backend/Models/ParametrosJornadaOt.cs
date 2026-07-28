using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

/// <summary>
/// Jornada ordinaria configurable para cálculo de horas extras / recargos.
/// Puede haber varias filas (bloques/turnos) por día de la semana en la misma vigencia.
/// DiaSemana: 0=Domingo … 6=Sábado (igual que DateTime.DayOfWeek).
/// </summary>
[Table("ParametrosJornadaOt")]
public class ParametrosJornadaOt
{
    public int Id { get; set; }
    public DateTime VigenteDesde { get; set; }
    public int DiaSemana { get; set; }
    public TimeSpan? HoraInicio { get; set; }
    public TimeSpan? HoraFin { get; set; }
    public bool DescuentaComida { get; set; }
    public int MinutosComida { get; set; }
    public bool Activo { get; set; } = true;
}
