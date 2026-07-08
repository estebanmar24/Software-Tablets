using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Sincroniza el stock de Mantenimiento_Productos con movimientos en Mantenimiento_Gastos (producto + cantidad).
/// </summary>
public static class MantenimientoInventarioHelper
{
    public static bool TieneMovimientoInventario(Mantenimiento_Gasto? gasto) =>
        gasto != null
        && gasto.Activo
        && gasto.ProductoId.HasValue
        && gasto.Cantidad.HasValue
        && gasto.Cantidad.Value != 0;

    public static async Task AplicarMovimientoNuevoAsync(AppDbContext context, Mantenimiento_Gasto gasto)
    {
        if (!TieneMovimientoInventario(gasto)) return;
        await SumarStockAsync(context, gasto.ProductoId!.Value, gasto.Cantidad!.Value);
    }

    public static async Task RevertirMovimientoAsync(AppDbContext context, Mantenimiento_Gasto gasto)
    {
        if (!TieneMovimientoInventario(gasto)) return;
        await SumarStockAsync(context, gasto.ProductoId!.Value, -gasto.Cantidad!.Value);
    }

    /// <summary>
    /// Al editar un gasto: revierte el movimiento anterior y aplica el nuevo.
    /// </summary>
    public static async Task SincronizarEdicionAsync(
        AppDbContext context,
        Mantenimiento_Gasto anterior,
        Mantenimiento_Gasto actualizado)
    {
        if (TieneMovimientoInventario(anterior))
            await SumarStockAsync(context, anterior.ProductoId!.Value, -anterior.Cantidad!.Value);

        if (TieneMovimientoInventario(actualizado))
            await SumarStockAsync(context, actualizado.ProductoId!.Value, actualizado.Cantidad!.Value);
    }

    private static async Task SumarStockAsync(AppDbContext context, int productoId, decimal delta)
    {
        if (delta == 0) return;

        var producto = await context.Mantenimiento_Productos
            .FirstOrDefaultAsync(p => p.Id == productoId && p.Activo);

        if (producto == null) return;

        producto.Stock += delta;
        if (producto.Stock < 0)
            producto.Stock = 0;
    }

    public static int CalcularMaxStockVisual(decimal stock, int puntoReorden, int maxStock)
    {
        var minimo = Math.Max(1, Math.Max(puntoReorden * 2, (int)Math.Ceiling(stock)));
        return maxStock > 0 ? Math.Max(maxStock, minimo) : minimo;
    }

    public static bool TieneMovimientoConsumo(Mantenimiento_Consumo? consumo) =>
        consumo != null && consumo.Activo && consumo.Cantidad > 0;

    public static async Task AplicarConsumoNuevoAsync(AppDbContext context, Mantenimiento_Consumo consumo)
    {
        if (!TieneMovimientoConsumo(consumo)) return;
        await SumarStockAsync(context, consumo.ProductoId, -consumo.Cantidad);
    }

    public static async Task RevertirConsumoAsync(AppDbContext context, Mantenimiento_Consumo consumo)
    {
        if (!TieneMovimientoConsumo(consumo)) return;
        await SumarStockAsync(context, consumo.ProductoId, consumo.Cantidad);
    }

    public static decimal DeltaAjuste(Mantenimiento_AjusteInventario a) =>
        !a.Activo ? 0m : a.Tipo == "ENTRADA" ? a.Cantidad : -a.Cantidad;

    public static async Task AplicarAjusteNuevoAsync(AppDbContext context, Mantenimiento_AjusteInventario ajuste)
    {
        if (!ajuste.Activo || ajuste.Cantidad <= 0) return;
        await SumarStockAsync(context, ajuste.ProductoId, DeltaAjuste(ajuste));
    }

    public static async Task SincronizarEdicionConsumoAsync(
        AppDbContext context,
        Mantenimiento_Consumo anterior,
        Mantenimiento_Consumo actualizado)
    {
        if (TieneMovimientoConsumo(anterior))
            await SumarStockAsync(context, anterior.ProductoId, anterior.Cantidad);

        if (TieneMovimientoConsumo(actualizado))
            await SumarStockAsync(context, actualizado.ProductoId, -actualizado.Cantidad);
    }

    /// <summary>
    /// Recalcula stock: entradas por gastos menos salidas por consumos activos.
    /// </summary>
    public static async Task<int> RecalcularStockDesdeGastosAsync(AppDbContext context)
    {
        var productos = await context.Mantenimiento_Productos.Where(p => p.Activo).ToListAsync();
        foreach (var p in productos)
            p.Stock = 0;

        var entradas = await context.Mantenimiento_Gastos
            .Where(g => g.Activo && g.ProductoId != null && g.Cantidad != null && g.Cantidad != 0)
            .GroupBy(g => g.ProductoId!.Value)
            .Select(g => new { ProductoId = g.Key, Total = g.Sum(x => x.Cantidad!.Value) })
            .ToListAsync();

        var salidas = await context.Mantenimiento_Consumos
            .Where(c => c.Activo && c.Cantidad > 0)
            .GroupBy(c => c.ProductoId)
            .Select(g => new { ProductoId = g.Key, Total = g.Sum(x => x.Cantidad) })
            .ToListAsync();

        var ajustes = await context.Mantenimiento_AjustesInventario
            .Where(a => a.Activo && a.Cantidad > 0)
            .GroupBy(a => a.ProductoId)
            .Select(g => new
            {
                ProductoId = g.Key,
                Total = g.Sum(x => x.Tipo == "ENTRADA" ? x.Cantidad : -x.Cantidad)
            })
            .ToListAsync();

        var actualizados = 0;
        var ids = entradas.Select(e => e.ProductoId)
            .Union(salidas.Select(s => s.ProductoId))
            .Union(ajustes.Select(a => a.ProductoId))
            .Distinct();

        foreach (var productoId in ids)
        {
            var producto = productos.FirstOrDefault(p => p.Id == productoId);
            if (producto == null) continue;

            var entrada = entradas.FirstOrDefault(e => e.ProductoId == productoId)?.Total ?? 0;
            var salida = salidas.FirstOrDefault(s => s.ProductoId == productoId)?.Total ?? 0;
            var ajuste = ajustes.FirstOrDefault(a => a.ProductoId == productoId)?.Total ?? 0;
            var neto = entrada - salida + ajuste;
            producto.Stock = neto < 0 ? 0 : neto;
            actualizados++;
        }

        await context.SaveChangesAsync();
        return actualizados;
    }
}
