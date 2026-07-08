using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

public static class ProveedorRubroHelper
{
    public static bool ProveedorTieneRubro(int? rubroIdLegacy, IEnumerable<int> rubroIds, int rubroId)
    {
        if (rubroIdLegacy == rubroId) return true;
        return rubroIds.Contains(rubroId);
    }

    public static async Task SyncProduccionAsync(AppDbContext ctx, int proveedorId, List<int> rubroIds)
    {
        var existing = await ctx.Produccion_ProveedorRubros.Where(x => x.ProveedorId == proveedorId).ToListAsync();
        ApplySync(ctx, existing, rubroIds, rid => new Produccion_ProveedorRubro { ProveedorId = proveedorId, RubroId = rid }, l => l.RubroId);
        var p = await ctx.Produccion_Proveedores.FindAsync(proveedorId);
        if (p != null) p.RubroId = rubroIds.FirstOrDefault();
    }

    public static async Task SyncTalleresAsync(AppDbContext ctx, int proveedorId, List<int> rubroIds)
    {
        var existing = await ctx.Talleres_ProveedorRubros.Where(x => x.ProveedorId == proveedorId).ToListAsync();
        ApplySync(ctx, existing, rubroIds, rid => new Talleres_ProveedorRubro { ProveedorId = proveedorId, RubroId = rid }, l => l.RubroId);
        var p = await ctx.Talleres_Proveedores.FindAsync(proveedorId);
        if (p != null) p.RubroId = rubroIds.FirstOrDefault();
    }

    public static async Task SyncPlaneacionAsync(AppDbContext ctx, int proveedorId, List<int> rubroIds)
    {
        var existing = await ctx.Planeacion_ProveedorRubros.Where(x => x.ProveedorId == proveedorId).ToListAsync();
        ApplySync(ctx, existing, rubroIds, rid => new Planeacion_ProveedorRubro { ProveedorId = proveedorId, RubroId = rid }, l => l.RubroId);
        var p = await ctx.Planeacion_Proveedores.FindAsync(proveedorId);
        if (p != null && rubroIds.Count > 0) p.RubroId = rubroIds[0];
    }

    public static async Task SyncDisenoAsync(AppDbContext ctx, int proveedorId, List<int> rubroIds)
    {
        var existing = await ctx.Diseno_ProveedorRubros.Where(x => x.ProveedorId == proveedorId).ToListAsync();
        ApplySync(ctx, existing, rubroIds, rid => new Diseno_ProveedorRubro { ProveedorId = proveedorId, RubroId = rid }, l => l.RubroId);
        var p = await ctx.Diseno_Proveedores.FindAsync(proveedorId);
        if (p != null && rubroIds.Count > 0) p.RubroId = rubroIds[0];
    }

    public static async Task SyncMantenimientoAsync(AppDbContext ctx, int proveedorId, List<int> rubroIds)
    {
        var existing = await ctx.Mantenimiento_ProveedorRubros.Where(x => x.ProveedorId == proveedorId).ToListAsync();
        ApplySync(ctx, existing, rubroIds, rid => new Mantenimiento_ProveedorRubro { ProveedorId = proveedorId, RubroId = rid }, l => l.RubroId);
        var p = await ctx.Mantenimiento_Proveedores.FindAsync(proveedorId);
        if (p != null) p.RubroId = rubroIds.FirstOrDefault();
    }

    private static void ApplySync<TLink>(
        AppDbContext ctx,
        List<TLink> existing,
        List<int> rubroIds,
        Func<int, TLink> createLink,
        Func<TLink, int> getRubroId) where TLink : class
    {
        var target = rubroIds.ToHashSet();
        foreach (var link in existing.Where(l => !target.Contains(getRubroId(l))))
            ctx.Remove(link);

        var existingIds = existing.Select(getRubroId).ToHashSet();
        foreach (var rid in rubroIds.Where(id => !existingIds.Contains(id)))
            ctx.Add(createLink(rid));
    }

    public static (int? RubroId, List<int> RubroIds, object? Rubro, List<object> Rubros, string RubroNombres) BuildRubroPayload(
        int? rubroIdLegacy,
        List<int> rubroIds,
        List<(int Id, string Nombre)> rubrosCatalog)
    {
        var ids = rubroIds.Count > 0
            ? rubroIds
            : (rubroIdLegacy.HasValue && rubroIdLegacy > 0 ? new List<int> { rubroIdLegacy.Value } : new List<int>());

        var rubros = rubrosCatalog.Where(r => ids.Contains(r.Id)).ToList();
        var first = rubros.FirstOrDefault();

        return (
            ids.FirstOrDefault() == 0 ? null : ids.FirstOrDefault(),
            ids,
            rubros.Count > 0 ? new { first.Id, first.Nombre } : null,
            rubros.Select(r => (object)new { r.Id, r.Nombre }).ToList(),
            string.Join(", ", rubros.Select(r => r.Nombre))
        );
    }

    public static List<int> GetRubroIdsForProveedor(int proveedorId, int? rubroIdLegacy, IEnumerable<(int ProveedorId, int RubroId)> links)
    {
        var ids = links.Where(l => l.ProveedorId == proveedorId).Select(l => l.RubroId).ToList();
        if (rubroIdLegacy.HasValue && rubroIdLegacy > 0 && !ids.Contains(rubroIdLegacy.Value))
            ids.Insert(0, rubroIdLegacy.Value);
        return ids;
    }

    public static async Task<List<object>> ListProduccionProveedoresAsync(AppDbContext ctx)
    {
        var catalog = await ctx.Produccion_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Produccion_ProveedorRubros.Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        var linkTuples = links.Select(l => (l.ProveedorId, l.RubroId));
        var proveedores = await ctx.Produccion_Proveedores.Where(p => p.Activo).OrderBy(p => p.Nombre).ToListAsync();
        return proveedores.Select(p => MapProduccion(p, catalogTuples, linkTuples)).Cast<object>().ToList();
    }

    public static async Task<object?> GetProduccionProveedorAsync(AppDbContext ctx, int id)
    {
        var p = await ctx.Produccion_Proveedores.FindAsync(id);
        if (p == null) return null;
        var catalog = await ctx.Produccion_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Produccion_ProveedorRubros.Where(l => l.ProveedorId == id).Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        return MapProduccion(p, catalogTuples, links.Select(l => (l.ProveedorId, l.RubroId)));
    }

    private static object MapProduccion(Produccion_Proveedor p, List<(int Id, string Nombre)> catalog, IEnumerable<(int ProveedorId, int RubroId)> links)
    {
        var ids = GetRubroIdsForProveedor(p.Id, p.RubroId, links);
        var (rubroId, rubroIds, rubro, rubros, rubroNombres) = BuildRubroPayload(p.RubroId, ids, catalog);
        return new { p.Id, p.Nombre, p.Nit, p.Telefono, p.PrecioCotizado, p.Activo, rubroId, rubroIds, rubro, rubros, rubroNombre = rubroNombres };
    }

    public static async Task<List<object>> ListTalleresProveedoresAsync(AppDbContext ctx, int? filterRubroId = null)
    {
        var catalog = await ctx.Talleres_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Talleres_ProveedorRubros.Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        var linkTuples = links.Select(l => (l.ProveedorId, l.RubroId)).ToList();
        var proveedores = await ctx.Talleres_Proveedores.Where(p => p.Activo).OrderBy(p => p.Nombre).ToListAsync();
        var mapped = proveedores.Select(p => MapTalleres(p, catalogTuples, linkTuples)).ToList();
        if (filterRubroId.HasValue)
            mapped = mapped.Where(m => ProveedorMatchesFilter(m, filterRubroId.Value)).ToList();
        return mapped.Cast<object>().ToList();
    }

    private static object MapTalleres(Talleres_Proveedor p, List<(int Id, string Nombre)> catalog, List<(int ProveedorId, int RubroId)> links)
    {
        var ids = GetRubroIdsForProveedor(p.Id, p.RubroId, links);
        var (rubroId, rubroIds, rubro, rubros, rubroNombres) = BuildRubroPayload(p.RubroId, ids, catalog);
        return new { p.Id, p.Nombre, p.NitCedula, p.Telefono, p.PrecioCotizado, p.Activo, rubroId, rubroIds, rubro, rubros, rubroNombre = rubroNombres };
    }

    public static async Task<List<object>> ListPlaneacionProveedoresAsync(AppDbContext ctx, int? filterRubroId = null)
    {
        var catalog = await ctx.Planeacion_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Planeacion_ProveedorRubros.Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        var linkTuples = links.Select(l => (l.ProveedorId, l.RubroId)).ToList();
        var proveedores = await ctx.Planeacion_Proveedores.Where(p => p.Activo).OrderBy(p => p.Nombre).ToListAsync();
        var mapped = proveedores.Select(p => MapPlaneacion(p, catalogTuples, linkTuples)).ToList();
        if (filterRubroId.HasValue)
            mapped = mapped.Where(m => ProveedorMatchesFilter(m, filterRubroId.Value)).ToList();
        return mapped.Cast<object>().ToList();
    }

    public static async Task<List<object>> ListDisenoProveedoresAsync(AppDbContext ctx, int? filterRubroId = null)
    {
        var catalog = await ctx.Diseno_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Diseno_ProveedorRubros.Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        var linkTuples = links.Select(l => (l.ProveedorId, l.RubroId)).ToList();
        var proveedores = await ctx.Diseno_Proveedores.Where(p => p.Activo).OrderBy(p => p.Nombre).ToListAsync();
        var mapped = proveedores.Select(p => MapDiseno(p, catalogTuples, linkTuples)).ToList();
        if (filterRubroId.HasValue)
            mapped = mapped.Where(m => ProveedorMatchesFilter(m, filterRubroId.Value)).ToList();
        return mapped.Cast<object>().ToList();
    }

    public static async Task<List<object>> ListMantenimientoProveedoresAsync(AppDbContext ctx, int? filterRubroId = null)
    {
        var catalog = await ctx.Mantenimiento_Rubros.Where(r => r.Activo).Select(r => new { r.Id, r.Nombre }).ToListAsync();
        var catalogTuples = catalog.Select(r => (r.Id, r.Nombre)).ToList();
        var links = await ctx.Mantenimiento_ProveedorRubros.Select(l => new { l.ProveedorId, l.RubroId }).ToListAsync();
        var linkTuples = links.Select(l => (l.ProveedorId, l.RubroId)).ToList();
        var proveedores = await ctx.Mantenimiento_Proveedores.Where(p => p.Activo).OrderBy(p => p.Nombre).ToListAsync();
        var mapped = proveedores.Select(p => MapMantenimiento(p, catalogTuples, linkTuples)).ToList();
        if (filterRubroId.HasValue)
            mapped = mapped.Where(m => ProveedorMatchesFilter(m, filterRubroId.Value)).ToList();
        return mapped.Cast<object>().ToList();
    }

    private static object MapPlaneacion(Planeacion_Proveedor p, List<(int Id, string Nombre)> catalog, List<(int ProveedorId, int RubroId)> links)
    {
        var ids = GetRubroIdsForProveedor(p.Id, p.RubroId, links);
        var (rubroId, rubroIds, rubro, rubros, rubroNombres) = BuildRubroPayload(p.RubroId, ids, catalog);
        return new { p.Id, p.Nombre, p.NitCedula, p.Telefono, p.PrecioCotizado, p.Activo, rubroId, rubroIds, rubro, rubros, rubroNombre = rubroNombres };
    }

    private static object MapDiseno(Diseno_Proveedor p, List<(int Id, string Nombre)> catalog, List<(int ProveedorId, int RubroId)> links)
    {
        var ids = GetRubroIdsForProveedor(p.Id, p.RubroId, links);
        var (rubroId, rubroIds, rubro, rubros, rubroNombres) = BuildRubroPayload(p.RubroId, ids, catalog);
        return new { p.Id, p.Nombre, p.NitCedula, p.Telefono, p.Activo, rubroId, rubroIds, rubro, rubros, rubroNombre = rubroNombres };
    }

    private static object MapMantenimiento(Mantenimiento_Proveedor p, List<(int Id, string Nombre)> catalog, List<(int ProveedorId, int RubroId)> links)
    {
        var ids = GetRubroIdsForProveedor(p.Id, p.RubroId, links);
        var (rubroId, rubroIds, rubro, rubros, rubroNombres) = BuildRubroPayload(p.RubroId, ids, catalog);
        return new { p.Id, p.Nombre, p.Nit, p.Telefono, p.Direccion, p.Correo, rubroId, rubroIds, rubro, rubros, rubroNombre = rubroNombres };
    }

    private static bool ProveedorMatchesFilter(object mapped, int filterRubroId)
    {
        var type = mapped.GetType();
        var rubroIdProp = type.GetProperty("rubroId")?.GetValue(mapped) as int?;
        var rubroIdsProp = type.GetProperty("rubroIds")?.GetValue(mapped) as List<int> ?? new List<int>();
        return ProveedorTieneRubro(rubroIdProp, rubroIdsProp, filterRubroId);
    }
}
