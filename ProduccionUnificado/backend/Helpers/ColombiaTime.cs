namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Hora oficial de planta (Colombia, UTC-5, sin horario de verano).
/// Evita desfases al mezclar DateTime.UtcNow con pantallas en hora local.
/// </summary>
public static class ColombiaTime
{
    private static readonly TimeZoneInfo Zona = ResolveZona();

    private static TimeZoneInfo ResolveZona()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows() ? "SA Pacific Standard Time" : "America/Bogota");
        }
        catch
        {
            return TimeZoneInfo.CreateCustomTimeZone(
                "Colombia",
                TimeSpan.FromHours(-5),
                "Colombia",
                "Colombia");
        }
    }

    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona);

    public static DateTime Today => Now.Date;

    /// <summary>
    /// Convierte una fecha recibida del cliente (a menudo ISO UTC) a la fecha calendario de Colombia.
    /// </summary>
    public static DateTime ToLocalDate(DateTime value)
    {
        DateTime local;
        if (value.Kind == DateTimeKind.Utc)
            local = TimeZoneInfo.ConvertTimeFromUtc(value, Zona);
        else if (value.Kind == DateTimeKind.Local)
            local = TimeZoneInfo.ConvertTime(value, Zona);
        else
        {
            // Unspecified: asumir UTC si trae hora != medianoche (típico de toISOString),
            // o ya es fecha local de negocio si es solo fecha.
            if (value.TimeOfDay == TimeSpan.Zero)
                return value.Date;

            local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(value, DateTimeKind.Utc), Zona);
        }

        return local.Date;
    }
}
