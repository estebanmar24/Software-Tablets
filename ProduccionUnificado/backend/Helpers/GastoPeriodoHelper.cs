namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Alinea Anio/Mes con la fecha del gasto (componentes de calendario, sin desfase por zona horaria).
/// </summary>
public static class GastoPeriodoHelper
{
    public static void SincronizarAnioMesDesdeFecha(DateTime fecha, out int anio, out int mes)
    {
        // No convertir a zona local: "2026-06-01" en UTC ya trae Month=6; convertir a Colombia lo dejaba en mayo.
        var cal = fecha.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc)
            : fecha;

        anio = cal.Year;
        mes = cal.Month;
        if (mes < 1) mes = 1;
        if (mes > 12) mes = 12;
    }

    public static void AplicarAnioMesDesdeFecha(DateTime fecha, Action<int, int> setter)
    {
        SincronizarAnioMesDesdeFecha(fecha, out var anio, out var mes);
        setter(anio, mes);
    }
}
