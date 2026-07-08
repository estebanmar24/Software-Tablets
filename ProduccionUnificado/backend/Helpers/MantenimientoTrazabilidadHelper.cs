using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Helpers;

public static class MantenimientoTrazabilidadHelper
{
    public static bool EsAdministrador(ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true) return false;
        var roles = ObtenerRoles(user);
        return roles.Contains("admin");
    }

    public static (int? Id, string? Nombre) ObtenerUsuario(HttpContext? httpContext)
    {
        var user = httpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
            return (null, null);

        var idClaim = user.FindFirst("Id")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? id = int.TryParse(idClaim, out var parsed) ? parsed : null;
        var nombre = user.FindFirst("NombreMostrar")?.Value
                     ?? user.FindFirst(ClaimTypes.Name)?.Value
                     ?? user.Identity?.Name;
        return (id, nombre);
    }

    public static async Task RegistrarAsync(
        AppDbContext context,
        HttpContext? httpContext,
        string modulo,
        string entidad,
        string accion,
        int? entidadId,
        string descripcion,
        object? detalle = null,
        bool esHistorico = false,
        DateTime? fecha = null)
    {
        try
        {
            var (usuarioId, usuarioNombre) = ObtenerUsuario(httpContext);
            var entry = new Mantenimiento_Trazabilidad
            {
                Modulo = modulo,
                Entidad = entidad,
                Accion = accion,
                EntidadId = entidadId,
                Descripcion = Truncar(descripcion, 500),
                DetalleJson = detalle == null ? null : JsonSerializer.Serialize(detalle),
                UsuarioId = usuarioId,
                UsuarioNombre = usuarioNombre,
                Fecha = fecha ?? DateTime.UtcNow,
                EsHistorico = esHistorico,
            };
            context.Mantenimiento_Trazabilidad.Add(entry);
            await context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TRAZABILIDAD] Error al registrar: {ex.Message}");
        }
    }

    public static async Task BackfillSiVacioAsync(AppDbContext context)
    {
        try
        {
            if (await context.Mantenimiento_Trazabilidad.AnyAsync())
            {
                Console.WriteLine("[TRAZABILIDAD] Ya hay registros; se omite backfill.");
                return;
            }

            Console.WriteLine("[TRAZABILIDAD] Iniciando backfill histórico...");
            var registros = new List<Mantenimiento_Trazabilidad>();

            var hojas = await context.HojasVidaMaquinas.AsNoTracking().ToListAsync();
            foreach (var h in hojas)
            {
                registros.Add(CrearHistorico("Maquinaria", "HojaVida", h.Activo ? "Crear" : "Eliminar", h.Id,
                    h.Activo
                        ? $"Hoja de vida creada: {h.Nombre}"
                        : $"Hoja de vida eliminada: {h.Nombre}",
                    h.FechaRegistro, new { h.Nombre, h.NumeroInventario, h.Marca }));
            }

            var mantenimientos = await context.MantenimientosHojaVida.AsNoTracking()
                .Include(m => m.HojaVida)
                .ToListAsync();
            foreach (var m in mantenimientos)
            {
                var maq = m.HojaVida?.Nombre ?? $"ID {m.HojaVidaId}";
                registros.Add(CrearHistorico("Maquinaria", "Mantenimiento", "Crear", m.Id,
                    $"Mantenimiento {m.TipoMantenimiento} en {maq} (#{m.Consecutivo})",
                    m.FechaRegistro, new { m.TipoMantenimiento, m.HojaVidaId, m.Consecutivo, m.EjecutadoPor }));
            }

            var bitacoras = await context.BitacorasMaquinas.AsNoTracking()
                .Include(b => b.HojaVida)
                .ToListAsync();
            foreach (var b in bitacoras)
            {
                var maq = b.HojaVida?.Nombre ?? $"ID {b.HojaVidaId}";
                registros.Add(CrearHistorico("Maquinaria", "Ticket", "Crear", b.Id,
                    $"Ticket #{b.Consecutivo} en {maq}: {Truncar(b.Descripcion, 120)}",
                    b.FechaRegistro, new { b.Consecutivo, b.RegistradoPor, b.EstadoMaquina }));
            }

            var gastos = await context.Mantenimiento_Gastos.AsNoTracking()
                .Include(g => g.Rubro)
                .Include(g => g.Proveedor)
                .Include(g => g.Producto)
                .Include(g => g.CreadoPor)
                .ToListAsync();
            foreach (var g in gastos)
            {
                var desc = g.Producto != null
                    ? $"Gasto producto {g.Producto.Nombre} · ${g.Precio:N0}"
                    : $"Gasto {g.Rubro?.Nombre ?? "rubro"} · ${g.Precio:N0}";
                if (!string.IsNullOrWhiteSpace(g.Proveedor?.Nombre))
                    desc += $" · {g.Proveedor.Nombre}";

                registros.Add(CrearHistorico("Gastos", "Gasto", g.Activo ? "Crear" : "Eliminar", g.Id, desc,
                    g.Fecha, new { g.RubroId, g.ProveedorId, g.Precio, g.NumeroFactura },
                    g.CreadoPor?.NombreMostrar ?? g.CreadoPor?.Username, g.CreadoPorId));
            }

            var productos = await context.Mantenimiento_Productos.AsNoTracking()
                .Include(p => p.Rubro)
                .Where(p => p.Activo)
                .ToListAsync();
            foreach (var p in productos)
            {
                registros.Add(CrearHistorico("Inventario", "Producto", "Registro histórico", p.Id,
                    $"Producto en catálogo: {p.Nombre} (stock {p.Stock})",
                    DateTime.UtcNow, new { p.RubroId, p.Stock, p.PuntoReorden }));
            }

            var ajustes = await context.Mantenimiento_AjustesInventario.AsNoTracking()
                .Include(a => a.Producto)
                .Where(a => a.Activo)
                .ToListAsync();
            foreach (var a in ajustes)
            {
                registros.Add(CrearHistorico("Inventario", "AjusteInventario", "Ajuste", a.Id,
                    $"{a.Tipo} {a.Cantidad} de {a.Producto?.Nombre ?? "producto"}: {Truncar(a.Razon, 100)}",
                    a.Fecha, new { a.Tipo, a.Cantidad, a.ProductoId }));
            }

            var consumos = await context.Mantenimiento_Consumos.AsNoTracking()
                .Include(c => c.Producto)
                .Include(c => c.HojaVida)
                .ToListAsync();
            foreach (var c in consumos)
            {
                var maq = c.HojaVida?.Nombre;
                registros.Add(CrearHistorico("Consumos", "Consumo", c.Activo ? "Crear" : "Eliminar", c.Id,
                    c.Activo
                        ? $"Consumo {c.Cantidad} {c.Producto?.Nombre ?? "producto"}" +
                          (maq != null ? $" en {maq}" : "")
                        : $"Consumo anulado: {c.Producto?.Nombre ?? "producto"}",
                    c.Fecha, new { c.Cantidad, c.ProductoId, c.HojaVidaId, c.Responsable }));
            }

            context.Mantenimiento_Trazabilidad.AddRange(registros);
            await context.SaveChangesAsync();
            Console.WriteLine($"[TRAZABILIDAD] Backfill completado: {registros.Count} registros.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TRAZABILIDAD] Error en backfill: {ex.Message}");
        }
    }

    private static Mantenimiento_Trazabilidad CrearHistorico(
        string modulo, string entidad, string accion, int? entidadId, string descripcion,
        DateTime fecha, object? detalle = null, string? usuarioNombre = null, int? usuarioId = null)
        => new()
        {
            Modulo = modulo,
            Entidad = entidad,
            Accion = accion,
            EntidadId = entidadId,
            Descripcion = Truncar(descripcion, 500),
            DetalleJson = detalle == null ? null : JsonSerializer.Serialize(detalle),
            UsuarioNombre = usuarioNombre ?? "Sistema (histórico)",
            UsuarioId = usuarioId,
            Fecha = fecha,
            EsHistorico = true,
        };

    private static HashSet<string> ObtenerRoles(ClaimsPrincipal user)
    {
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in user.Claims.Where(c =>
                     c.Type == ClaimTypes.Role || c.Type.Equals("Role", StringComparison.OrdinalIgnoreCase)))
        {
            foreach (var part in (claim.Value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))
                roles.Add(part.Trim().ToLowerInvariant());
        }
        return roles;
    }

    private static string Truncar(string? texto, int max)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        texto = texto.Trim();
        return texto.Length <= max ? texto : texto[..max];
    }
}
