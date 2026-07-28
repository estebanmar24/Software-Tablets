using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

/// <summary>
/// Crea el gasto en el módulo correspondiente cuando una solicitud es autorizada,
/// para que aparezca en Contabilidad → Movimientos (Estado Montado).
/// </summary>
public static class GastoAutorizacionMaterializacionHelper
{
    public static async Task<int?> MaterializarGastoAsync(AppDbContext context, GastoAutorizacionSolicitud sol)
    {
        if (sol.GastoId.HasValue && sol.GastoId.Value > 0)
            return sol.GastoId;

        if (sol.EstadoAutorizacion != GastoAutorizacionHelper.EstadoAutorizada)
            return null;

        if (!sol.RubroId.HasValue || sol.RubroId.Value <= 0)
            throw new InvalidOperationException($"La solicitud #{sol.Id} no tiene rubro válido para crear el movimiento.");

        var fecha = sol.FechaAproximada.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(sol.FechaAproximada.Date, DateTimeKind.Utc)
            : sol.FechaAproximada;
        var precio = Math.Round(sol.Cantidad, 2);
        var nota = string.IsNullOrWhiteSpace(sol.Razon) ? null : sol.Razon.Trim();
        var modulo = sol.Modulo.Trim().ToLowerInvariant();

        int? gastoId = modulo switch
        {
            "produccion" => await MaterializarProduccionAsync(context, sol, fecha, precio, nota),
            "talleres" => await MaterializarTalleresAsync(context, sol, fecha, precio, nota),
            "mantenimiento" => await MaterializarMantenimientoAsync(context, sol, fecha, precio, nota),
            "planeacion" => await MaterializarPlaneacionAsync(context, sol, fecha, precio, nota),
            "diseno" => await MaterializarDisenoAsync(context, sol, fecha, precio, nota),
            "gh" => await MaterializarGhAsync(context, sol, fecha, precio, nota),
            "sst" => await MaterializarSstAsync(context, sol, fecha, precio, nota),
            _ => throw new InvalidOperationException($"Módulo no soportado para materializar gasto: {sol.Modulo}"),
        };

        return gastoId;
    }

    private static async Task<int?> MaterializarProduccionAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var gasto = new Produccion_Gasto
        {
            RubroId = sol.RubroId!.Value,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            Fecha = fecha,
            Nota = nota,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.Produccion_Gastos.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarTalleresAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var gasto = new Talleres_Gasto
        {
            RubroId = sol.RubroId!.Value,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            Fecha = fecha,
            Observaciones = nota,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.Talleres_Gastos.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarMantenimientoAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var gasto = new Mantenimiento_Gasto
        {
            RubroId = sol.RubroId!.Value,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            Fecha = fecha,
            Nota = nota,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            Activo = true,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.Mantenimiento_Gastos.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarPlaneacionAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var gasto = new Planeacion_Gasto
        {
            RubroId = sol.RubroId!.Value,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            Fecha = fecha,
            Observaciones = nota,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.Planeacion_Gastos.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarDisenoAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var gasto = new Diseno_Gasto
        {
            RubroId = sol.RubroId!.Value,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            Fecha = fecha,
            Observaciones = nota,
            NumeroFactura = string.Empty,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.Diseno_Gastos.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarGhAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var tipoServicioId = await ResolverTipoServicioGhAsync(context, sol.ProveedorId);
        var gasto = new GH_GastoMensual
        {
            RubroId = sol.RubroId!.Value,
            TipoServicioId = tipoServicioId,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            FechaCompra = fecha,
            Nota = nota,
            NumeroFactura = string.Empty,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.GH_GastosMensuales.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int?> MaterializarSstAsync(
        AppDbContext context, GastoAutorizacionSolicitud sol, DateTime fecha, decimal precio, string? nota)
    {
        var tipoServicioId = await ResolverTipoServicioSstAsync(context, sol.ProveedorId);
        var gasto = new SST_GastoMensual
        {
            RubroId = sol.RubroId!.Value,
            TipoServicioId = tipoServicioId,
            ProveedorId = sol.ProveedorId,
            Anio = sol.Anio,
            Mes = sol.Mes,
            Precio = precio,
            PrecioBase = precio,
            PrecioIva = 0,
            FechaCompra = fecha,
            Nota = nota,
            NumeroFactura = string.Empty,
            EsPendiente = true,
            EsSolicitudCredito = sol.EsSolicitudCredito,
            EsEfectivo = sol.EsEfectivo,
            CreadoPorId = sol.SolicitadoPorId,
            FechaCreacion = DateTime.UtcNow,
            Estado = "Montado",
        };
        GastoPeriodoHelper.AplicarAnioMesDesdeFecha(fecha, (a, m) => { gasto.Anio = a; gasto.Mes = m; });
        context.SST_GastosMensuales.Add(gasto);
        await context.SaveChangesAsync();
        return gasto.Id;
    }

    private static async Task<int> ResolverTipoServicioGhAsync(AppDbContext context, int? proveedorId)
    {
        if (proveedorId.HasValue)
        {
            var prov = await context.GH_Proveedores.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == proveedorId.Value);
            if (prov?.TipoServicioId > 0)
                return prov.TipoServicioId;
        }

        var tipo = await context.GH_TiposServicio.AsNoTracking()
            .Where(t => t.Activo)
            .OrderBy(t => t.Id)
            .Select(t => t.Id)
            .FirstOrDefaultAsync();
        if (tipo <= 0)
            throw new InvalidOperationException("No hay tipos de servicio configurados en Gestión Humana.");
        return tipo;
    }

    private static async Task<int> ResolverTipoServicioSstAsync(AppDbContext context, int? proveedorId)
    {
        if (proveedorId.HasValue)
        {
            var prov = await context.SST_Proveedores.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == proveedorId.Value);
            if (prov?.TipoServicioId > 0)
                return prov.TipoServicioId;
        }

        var tipo = await context.SST_TiposServicio.AsNoTracking()
            .Where(t => t.Activo)
            .OrderBy(t => t.Id)
            .Select(t => t.Id)
            .FirstOrDefaultAsync();
        if (tipo <= 0)
            throw new InvalidOperationException("No hay tipos de servicio configurados en SST.");
        return tipo;
    }
}
