using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Resolución de la meta base (tiros referencia a 100% en una jornada tipo 8h) para rendimiento mensual.
/// </summary>
public static class MetaResolver
{
    /// <summary>
    /// Catálogo de máquina primero; snapshot solo si la máquina no trae meta.
    /// Si existen ambas Meta100Porciento y MetaRendimiento, se usa MetaRendimiento (meta operativa / columna de captura);
    /// Meta100Porciento queda como referencia de techo pero el semáforo y la grilla histórica comparan contra la meta de rendimiento.
    /// </summary>
    public static int ResolverMeta100PorcientoBase(Maquina? maq, MetaMensual? snapshot, int fallbackIfMissing = 0)
    {
        if (maq != null && (maq.Meta100Porciento > 0 || maq.MetaRendimiento > 0))
        {
            if (maq.Meta100Porciento > 0 && maq.MetaRendimiento > 0)
                return maq.MetaRendimiento;
            return maq.Meta100Porciento > 0 ? maq.Meta100Porciento : maq.MetaRendimiento;
        }
        if (snapshot != null)
        {
            var s100 = snapshot.Meta100Porciento ?? 0;
            var sr = snapshot.MetaRendimiento ?? 0;
            if (s100 > 0 && sr > 0)
                return sr;
            if (s100 > 0) return s100;
            if (sr > 0) return sr;
        }
        return fallbackIfMissing;
    }

    /// <summary>
    /// Meta de tiros por jornada 8 h para objetivo tiros al 100% y umbral 75% bonificación: prioriza Meta100Porciento;
    /// si no está definido, MetaRendimiento. No aplica la regla "ambas → Rendimiento" del semáforo (evita 75% aplicado dos veces).
    /// </summary>
    public static int ResolverMetaBaseTirosObjetivo100(Maquina? maq, MetaMensual? snapshot, int fallbackIfMissing = 0)
    {
        if (maq != null)
        {
            if (maq.Meta100Porciento > 0) return maq.Meta100Porciento;
            if (maq.MetaRendimiento > 0) return maq.MetaRendimiento;
        }
        if (snapshot != null)
        {
            if (snapshot.Meta100Porciento.HasValue && snapshot.Meta100Porciento.Value > 0)
                return snapshot.Meta100Porciento.Value;
            if (snapshot.MetaRendimiento.HasValue && snapshot.MetaRendimiento.Value > 0)
                return snapshot.MetaRendimiento.Value;
        }
        return fallbackIfMissing;
    }
}
