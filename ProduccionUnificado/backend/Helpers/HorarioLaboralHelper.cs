namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Helper para validar horarios laborales y festivos colombianos.
/// Horarios:
/// - Lunes a Viernes: 7:00 AM a 4:00 PM (8 horas)
/// - Sábado: 8:00 AM a 12:00 PM (4 horas)
/// - Domingo: No laboral (no bonificable)
/// - Festivos: No bonificables
/// </summary>
public static class HorarioLaboralHelper
{
    // Horarios Lunes a Viernes
    private static readonly TimeSpan InicioSemana = new TimeSpan(7, 0, 0);  // 7:00 AM
    private static readonly TimeSpan FinSemana = new TimeSpan(16, 0, 0);    // 4:00 PM

    // Horarios Sábado
    private static readonly TimeSpan InicioSabado = new TimeSpan(8, 0, 0);  // 8:00 AM
    private static readonly TimeSpan FinSabado = new TimeSpan(12, 0, 0);    // 12:00 PM

    /// <summary>
    /// Valida si una hora está dentro del horario laboral bonificable para el día dado.
    /// Domingos y festivos retornan false.
    /// </summary>
    public static bool EsDentroHorarioLaboral(DateTime fecha, TimeSpan hora)
    {
        // Domingo o Festivo - No bonificable
        if (fecha.DayOfWeek == DayOfWeek.Sunday || EsFestivoColombia(fecha))
            return false;

        // Sábado - 8:00 AM a 12:00 PM
        if (fecha.DayOfWeek == DayOfWeek.Saturday)
        {
            return hora >= InicioSabado && hora <= FinSabado;
        }

        // Lunes a Viernes - 7:00 AM a 4:00 PM
        return hora >= InicioSemana && hora <= FinSemana;
    }

    /// <summary>
    /// Valida si un registro completo (inicio a fin) está dentro del horario laboral bonificable.
    /// </summary>
    public static bool EsRegistroBonificable(DateTime fecha, TimeSpan horaInicio, TimeSpan horaFin)
    {
        return EsDentroHorarioLaboral(fecha, horaInicio) && EsDentroHorarioLaboral(fecha, horaFin);
    }

    /// <summary>
    /// Obtiene el horario laboral para un día específico.
    /// </summary>
    public static (TimeSpan Inicio, TimeSpan Fin, bool EsDiaLaboral) ObtenerHorarioLaboral(DateTime fecha)
    {
        // Domingo o Festivo
        if (fecha.DayOfWeek == DayOfWeek.Sunday || EsFestivoColombia(fecha))
            return (TimeSpan.Zero, TimeSpan.Zero, false);

        if (fecha.DayOfWeek == DayOfWeek.Saturday)
            return (InicioSabado, FinSabado, true);

        return (InicioSemana, FinSemana, true);
    }

    /// <summary>
    /// Obtiene el total de horas laborales bonificables para un día específico.
    /// </summary>
    public static decimal ObtenerHorasLaboralesDia(DateTime fecha)
    {
        if (fecha.DayOfWeek == DayOfWeek.Sunday || EsFestivoColombia(fecha))
            return 0;

        if (fecha.DayOfWeek == DayOfWeek.Saturday)
            return 4;

        return 8;
    }

    #region Festivos Colombia

    /// <summary>
    /// Verifica si una fecha es festivo en Colombia.
    /// Incluye festivos fijos, festivos móviles (Ley Emiliani) y festivos basados en Pascua.
    /// </summary>
    public static bool EsFestivoColombia(DateTime fecha)
    {
        var festivos = ObtenerFestivosColombia(fecha.Year);
        return festivos.Contains(fecha.Date);
    }

    /// <summary>
    /// Obtiene todos los festivos de Colombia para un año dado.
    /// </summary>
    public static List<DateTime> ObtenerFestivosColombia(int año)
    {
        var festivos = new List<DateTime>();

        // Festivos fijos
        festivos.Add(new DateTime(año, 1, 1));   // Año Nuevo
        festivos.Add(new DateTime(año, 5, 1));   // Día del Trabajo
        festivos.Add(new DateTime(año, 7, 20));  // Grito de Independencia
        festivos.Add(new DateTime(año, 8, 7));   // Batalla de Boyacá
        festivos.Add(new DateTime(año, 12, 8));  // Inmaculada Concepción
        festivos.Add(new DateTime(año, 12, 25)); // Navidad

        // Calcular Pascua (algoritmo de Gauss)
        DateTime pascua = CalcularPascua(año);

        // Festivos basados en Pascua
        festivos.Add(pascua.AddDays(-3));  // Jueves Santo
        festivos.Add(pascua.AddDays(-2));  // Viernes Santo
        festivos.Add(pascua.AddDays(39));  // Ascensión del Señor (trasladado al lunes)
        festivos.Add(pascua.AddDays(60));  // Corpus Christi (trasladado al lunes)
        festivos.Add(pascua.AddDays(68));  // Sagrado Corazón (trasladado al lunes)

        // Aplicar Ley Emiliani a los festivos basados en Pascua que lo requieren
        // Ascensión (39 días después de Pascua) - Se traslada al lunes siguiente
        festivos[festivos.Count - 3] = TrasladarALunes(pascua.AddDays(39));
        // Corpus Christi (60 días después de Pascua) - Se traslada al lunes siguiente
        festivos[festivos.Count - 2] = TrasladarALunes(pascua.AddDays(60));
        // Sagrado Corazón (68 días después de Pascua) - Se traslada al lunes siguiente
        festivos[festivos.Count - 1] = TrasladarALunes(pascua.AddDays(68));

        // Festivos con Ley Emiliani (se trasladan al lunes siguiente si no caen en lunes)
        festivos.Add(TrasladarALunes(new DateTime(año, 1, 6)));   // Reyes Magos
        festivos.Add(TrasladarALunes(new DateTime(año, 3, 19)));  // San José
        festivos.Add(TrasladarALunes(new DateTime(año, 6, 29)));  // San Pedro y San Pablo
        festivos.Add(TrasladarALunes(new DateTime(año, 8, 15)));  // Asunción de la Virgen
        festivos.Add(TrasladarALunes(new DateTime(año, 10, 12))); // Día de la Raza
        festivos.Add(TrasladarALunes(new DateTime(año, 11, 1)));  // Todos los Santos
        festivos.Add(TrasladarALunes(new DateTime(año, 11, 11))); // Independencia de Cartagena

        return festivos.Distinct().OrderBy(f => f).ToList();
    }

    /// <summary>
    /// Calcula la fecha de Pascua usando el algoritmo de Gauss/Anónimo.
    /// </summary>
    private static DateTime CalcularPascua(int año)
    {
        int a = año % 19;
        int b = año / 100;
        int c = año % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mes = (h + l - 7 * m + 114) / 31;
        int dia = ((h + l - 7 * m + 114) % 31) + 1;

        return new DateTime(año, mes, dia);
    }

    /// <summary>
    /// Traslada una fecha al lunes siguiente si no es lunes (Ley Emiliani).
    /// </summary>
    private static DateTime TrasladarALunes(DateTime fecha)
    {
        if (fecha.DayOfWeek == DayOfWeek.Monday)
            return fecha;

        int diasHastaLunes = ((int)DayOfWeek.Monday - (int)fecha.DayOfWeek + 7) % 7;
        if (diasHastaLunes == 0)
            diasHastaLunes = 7;

        return fecha.AddDays(diasHastaLunes);
    }

    #endregion
}
