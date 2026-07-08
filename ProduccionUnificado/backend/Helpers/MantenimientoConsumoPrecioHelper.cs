using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

public static class MantenimientoConsumoPrecioHelper
{
    /// <summary>Precio unitario promedio ponderado por entradas de gasto activas.</summary>
    public static async Task<Dictionary<int, decimal>> ObtenerPreciosUnitariosAsync(
        AppDbContext context,
        IEnumerable<int> productoIds)
    {
        var ids = productoIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<int, decimal>();

        var gastos = await context.Mantenimiento_Gastos
            .Where(g => g.Activo
                        && g.ProductoId.HasValue
                        && ids.Contains(g.ProductoId.Value)
                        && g.Cantidad.HasValue
                        && g.Cantidad.Value > 0)
            .GroupBy(g => g.ProductoId!.Value)
            .Select(g => new
            {
                ProductoId = g.Key,
                TotalPrecio = g.Sum(x => x.Precio),
                TotalCantidad = g.Sum(x => x.Cantidad!.Value)
            })
            .ToListAsync();

        return gastos.ToDictionary(
            g => g.ProductoId,
            g => g.TotalCantidad > 0 ? Math.Round(g.TotalPrecio / g.TotalCantidad, 2) : 0m);
    }

    /// <summary>Clasifica el producto para las columnas del PDF de orden de trabajo.</summary>
    public static string ClasificarRecurso(Mantenimiento_Producto? producto)
    {
        var tipo = (producto?.TipoProducto ?? "").Trim().ToLowerInvariant();
        var rubro = (producto?.Rubro?.Nombre ?? "").Trim().ToLowerInvariant();

        if (tipo.Contains("equipo") || rubro.Contains("equipo"))
            return "equipos";

        if (rubro.Contains("repuesto") || rubro.Contains("mantenimiento") || rubro.Contains("rodamiento")
            || tipo.Contains("repuesto"))
            return "repuestos";

        return "materiales";
    }

    public static string FormatearLineaRecurso(string codigo, string nombre, decimal cantidad, string? medida)
    {
        var med = string.IsNullOrWhiteSpace(medida) ? "Und" : medida.Trim();
        var cantTxt = cantidad % 1 == 0 ? ((int)cantidad).ToString() : cantidad.ToString("0.##");
        return $"{codigo} {nombre} ({cantTxt} {med})";
    }
}
