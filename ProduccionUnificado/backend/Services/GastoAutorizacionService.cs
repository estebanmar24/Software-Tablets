using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Services;

public class GastoAutorizacionService
{
    private readonly AppDbContext _context;
    private readonly GastoAutorizacionEmailService _email;

    public GastoAutorizacionService(AppDbContext context, GastoAutorizacionEmailService email)
    {
        _context = context;
        _email = email;
    }

    public static string FormatoFecha(DateTime d) => d.ToString("yyyy-MM-dd");

    private static TimeZoneInfo ColombiaTz()
    {
        foreach (var id in new[] { "America/Bogota", "SA Pacific Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    public static string FormatoHoraColombia(DateTime fecha)
    {
        var utc = fecha.Kind switch
        {
            DateTimeKind.Utc => fecha,
            DateTimeKind.Local => fecha.ToUniversalTime(),
            _ => DateTime.SpecifyKind(fecha, DateTimeKind.Utc),
        };
        return TimeZoneInfo.ConvertTimeFromUtc(utc, ColombiaTz())
            .ToString("HH:mm", CultureInfo.InvariantCulture);
    }

    private static int ContarComentarios(IEnumerable<GastoAutorizacionComentario>? comentarios) =>
        comentarios?.Count() ?? 0;

    private static List<GastoAutorizacionComentarioDto> ConstruirArbolComentarios(
        IEnumerable<GastoAutorizacionComentario>? comentarios)
    {
        var lista = (comentarios ?? Array.Empty<GastoAutorizacionComentario>()).ToList();
        if (lista.Count == 0) return new List<GastoAutorizacionComentarioDto>();

        var porId = lista.ToDictionary(c => c.Id);
        GastoAutorizacionComentarioDto MapNodo(GastoAutorizacionComentario c)
        {
            var hijos = lista
                .Where(x => x.ParentId == c.Id)
                .OrderBy(x => x.FechaRegistro)
                .Select(MapNodo)
                .ToList();
            return new GastoAutorizacionComentarioDto
            {
                Id = c.Id.ToString(),
                Texto = c.Texto,
                UsuarioNombre = c.UsuarioNombre,
                Fecha = FormatoFecha(c.FechaRegistro),
                Hora = FormatoHoraColombia(c.FechaRegistro),
                Respuestas = hijos,
            };
        }

        return lista
            .Where(c => !c.ParentId.HasValue || !porId.ContainsKey(c.ParentId.Value))
            .OrderBy(c => c.FechaRegistro)
            .Select(MapNodo)
            .ToList();
    }

    public GastoAutorizacionSolicitudDto Map(
        GastoAutorizacionSolicitud s,
        int? usuarioActualId,
        string? usuarioActualNombre,
        bool esAutorizador)
    {
        var esSolicitante = GastoAutorizacionHelper.EsSolicitante(s, usuarioActualId, usuarioActualNombre);
        var sinGasto = s.GastoId == null;

        var puedeRegistrar = s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoAutorizada
            && sinGasto
            && esSolicitante;

        var puedeEditar = esSolicitante && sinGasto
            && (s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoPendiente
                || s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoAutorizada);

        var puedeEliminar = esSolicitante || esAutorizador;

        return new GastoAutorizacionSolicitudDto
        {
            Id = s.Id.ToString(),
            Modulo = s.Modulo,
            RubroId = s.RubroId?.ToString(),
            RubroNombre = s.RubroNombre,
            ProveedorId = s.ProveedorId?.ToString(),
            ProveedorNombre = s.ProveedorNombre,
            FechaAproximada = FormatoFecha(s.FechaAproximada),
            Cantidad = s.Cantidad,
            Razon = s.Razon,
            EsSolicitudCredito = s.EsSolicitudCredito,
            EsEfectivo = s.EsEfectivo,
            EstadoAutorizacion = s.EstadoAutorizacion,
            SolicitadoPorId = s.SolicitadoPorId?.ToString(),
            SolicitadoPorNombre = s.SolicitadoPorNombre,
            AutorizadoPorNombre = s.AutorizadoPorNombre,
            FechaSolicitud = FormatoFecha(s.FechaSolicitud),
            FechaResolucion = s.FechaResolucion.HasValue ? FormatoFecha(s.FechaResolucion.Value) : null,
            MotivoRechazo = s.MotivoRechazo,
            GastoId = s.GastoId?.ToString(),
            Anio = s.Anio,
            Mes = s.Mes,
            PuedeRegistrarGasto = puedeRegistrar,
            PuedeAutorizar = esAutorizador && s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoPendiente,
            PuedeEditar = puedeEditar,
            PuedeEliminar = puedeEliminar,
            TotalComentarios = ContarComentarios(s.Comentarios),
        };
    }

    public async Task<List<GastoAutorizacionSolicitudDto>> ListarAsync(
        string modulo,
        int? anio,
        int? mes,
        string? estadoAutorizacion,
        int? usuarioActualId,
        string? usuarioActualNombre,
        bool esAutorizador)
    {
        if (!GastoAutorizacionHelper.ModuloValido(modulo))
            throw new InvalidOperationException("Módulo no válido.");

        var query = _context.GastoAutorizacionSolicitudes
            .AsNoTracking()
            .Include(s => s.Comentarios)
            .Where(s => s.Modulo == modulo.Trim().ToLower());

        if (anio.HasValue) query = query.Where(s => s.Anio == anio.Value);
        if (mes.HasValue) query = query.Where(s => s.Mes == mes.Value);
        if (!string.IsNullOrWhiteSpace(estadoAutorizacion) && estadoAutorizacion != "todos")
            query = query.Where(s => s.EstadoAutorizacion == estadoAutorizacion);

        var list = await query
            .OrderByDescending(s => s.FechaSolicitud)
            .ThenByDescending(s => s.Id)
            .ToListAsync();

        return list.Select(s => Map(s, usuarioActualId, usuarioActualNombre, esAutorizador)).ToList();
    }

    public async Task<List<GastoAutorizacionSolicitudDto>> ListarConsolidadoAsync(
        int? anio,
        int? mes,
        string? modulo,
        string? estadoAutorizacion,
        string? search,
        string? proveedor,
        string? fechaFiltro,
        int? usuarioActualId,
        string? usuarioActualNombre,
        bool esAutorizador,
        bool soloPendientesRevision = false)
    {
        IQueryable<GastoAutorizacionSolicitud> query = _context.GastoAutorizacionSolicitudes
            .AsNoTracking()
            .Include(s => s.Comentarios);

        if (anio.HasValue) query = query.Where(s => s.Anio == anio.Value);
        if (mes.HasValue && mes.Value > 0) query = query.Where(s => s.Mes == mes.Value);

        var moduloKey = GastoAutorizacionHelper.ResolverModuloFiltro(modulo);
        if (!string.IsNullOrEmpty(moduloKey))
            query = query.Where(s => s.Modulo == moduloKey);

        if (soloPendientesRevision)
        {
            query = query.Where(s =>
                s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoPendiente
                || s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoNoAutorizada);
        }
        else if (!string.IsNullOrWhiteSpace(estadoAutorizacion) && estadoAutorizacion != "todos")
        {
            query = query.Where(s => s.EstadoAutorizacion == estadoAutorizacion);
        }

        if (!string.IsNullOrWhiteSpace(proveedor))
        {
            var p = proveedor.Trim();
            query = query.Where(s => s.ProveedorNombre != null && s.ProveedorNombre.Contains(p));
        }

        if (!string.IsNullOrWhiteSpace(fechaFiltro)
            && DateTime.TryParse(fechaFiltro, CultureInfo.InvariantCulture, DateTimeStyles.None, out var fechaParsed))
        {
            var d = fechaParsed.Date;
            query = query.Where(s => s.FechaSolicitud.Date == d);
        }

        var list = await query
            .OrderByDescending(s => s.FechaSolicitud)
            .ThenByDescending(s => s.Id)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            list = list.Where(s =>
                (s.Razon ?? "").ToLowerInvariant().Contains(term)
                || (s.RubroNombre ?? "").ToLowerInvariant().Contains(term)
                || (s.ProveedorNombre ?? "").ToLowerInvariant().Contains(term)
                || (s.SolicitadoPorNombre ?? "").ToLowerInvariant().Contains(term)
                || GastoAutorizacionHelper.EtiquetaModulo(s.Modulo).ToLowerInvariant().Contains(term)
            ).ToList();
        }

        return list.Select(s => Map(s, usuarioActualId, usuarioActualNombre, esAutorizador)).ToList();
    }

    public async Task<GastoAutorizacionSolicitudDto> CrearAsync(
        GastoAutorizacionWriteDto dto,
        int? usuarioId,
        string? usuarioNombre)
    {
        if (!GastoAutorizacionHelper.ModuloValido(dto.Modulo))
            throw new InvalidOperationException("Módulo no válido.");
        if (string.IsNullOrWhiteSpace(dto.RubroId) || !int.TryParse(dto.RubroId, out var rubroIdParsed) || rubroIdParsed <= 0)
            throw new InvalidOperationException("Debe seleccionar un rubro.");
        if (string.IsNullOrWhiteSpace(dto.Razon))
            throw new InvalidOperationException("La razón del gasto es obligatoria.");
        if (dto.Cantidad == null || dto.Cantidad <= 0)
            throw new InvalidOperationException("La cantidad debe ser mayor a cero.");

        var esCredito = dto.EsSolicitudCredito == true;
        var esEfectivo = dto.EsEfectivo == true;
        if (!esCredito && !esEfectivo)
            throw new InvalidOperationException("Indique si el gasto es a crédito o en efectivo.");
        if (esCredito && esEfectivo)
            throw new InvalidOperationException("No puede marcar crédito y efectivo a la vez.");

        if (GastoAutorizacionHelper.EsRubroSinAutorizacion(dto.RubroNombre))
            throw new InvalidOperationException("Horas extras y recargos no requieren solicitud de autorización.");

        var fecha = ParseFecha(dto.FechaAproximada, DateTime.UtcNow.Date);
        var anio = dto.Anio ?? fecha.Year;
        var mes = dto.Mes ?? fecha.Month;

        int? proveedorId = null;
        if (!string.IsNullOrWhiteSpace(dto.ProveedorId) && int.TryParse(dto.ProveedorId, out var pid))
            proveedorId = pid;

        var entity = new GastoAutorizacionSolicitud
        {
            Modulo = dto.Modulo.Trim().ToLower(),
            RubroId = rubroIdParsed,
            RubroNombre = string.IsNullOrWhiteSpace(dto.RubroNombre) ? null : dto.RubroNombre.Trim(),
            ProveedorId = proveedorId,
            ProveedorNombre = string.IsNullOrWhiteSpace(dto.ProveedorNombre) ? null : dto.ProveedorNombre.Trim(),
            FechaAproximada = fecha,
            Cantidad = dto.Cantidad.Value,
            Razon = dto.Razon.Trim(),
            EsSolicitudCredito = esCredito,
            EsEfectivo = esEfectivo,
            EstadoAutorizacion = GastoAutorizacionHelper.EstadoPendiente,
            SolicitadoPorId = usuarioId,
            SolicitadoPorNombre = string.IsNullOrWhiteSpace(usuarioNombre) ? null : usuarioNombre.Trim(),
            FechaSolicitud = DateTime.UtcNow,
            Anio = anio,
            Mes = mes,
        };

        _context.GastoAutorizacionSolicitudes.Add(entity);
        await _context.SaveChangesAsync();

        await NotificarEmailSeguroAsync(entity, "creada");

        return Map(entity, usuarioId, usuarioNombre, GastoAutorizacionHelper.EsAutorizador(usuarioNombre));
    }

    private static void AplicarDatosEscritura(GastoAutorizacionSolicitud entity, GastoAutorizacionWriteDto dto)
    {
        if (!GastoAutorizacionHelper.ModuloValido(dto.Modulo))
            throw new InvalidOperationException("Módulo no válido.");
        if (string.IsNullOrWhiteSpace(dto.RubroId) || !int.TryParse(dto.RubroId, out var rubroIdParsed) || rubroIdParsed <= 0)
            throw new InvalidOperationException("Debe seleccionar un rubro.");
        if (string.IsNullOrWhiteSpace(dto.Razon))
            throw new InvalidOperationException("La razón del gasto es obligatoria.");
        if (dto.Cantidad == null || dto.Cantidad <= 0)
            throw new InvalidOperationException("La cantidad debe ser mayor a cero.");

        var esCredito = dto.EsSolicitudCredito == true;
        var esEfectivo = dto.EsEfectivo == true;
        if (!esCredito && !esEfectivo)
            throw new InvalidOperationException("Indique si el gasto es a crédito o en efectivo.");
        if (esCredito && esEfectivo)
            throw new InvalidOperationException("No puede marcar crédito y efectivo a la vez.");

        var fecha = ParseFecha(dto.FechaAproximada, entity.FechaAproximada);
        entity.Modulo = dto.Modulo.Trim().ToLower();
        entity.RubroId = rubroIdParsed;
        entity.RubroNombre = string.IsNullOrWhiteSpace(dto.RubroNombre) ? null : dto.RubroNombre.Trim();

        int? proveedorId = null;
        if (!string.IsNullOrWhiteSpace(dto.ProveedorId) && int.TryParse(dto.ProveedorId, out var pid))
            proveedorId = pid;
        entity.ProveedorId = proveedorId;
        entity.ProveedorNombre = string.IsNullOrWhiteSpace(dto.ProveedorNombre) ? null : dto.ProveedorNombre.Trim();
        entity.FechaAproximada = fecha;
        entity.Cantidad = dto.Cantidad.Value;
        entity.Razon = dto.Razon.Trim();
        entity.EsSolicitudCredito = esCredito;
        entity.EsEfectivo = esEfectivo;
        entity.Anio = dto.Anio ?? fecha.Year;
        entity.Mes = dto.Mes ?? fecha.Month;
    }

    public async Task<GastoAutorizacionSolicitudDto> ActualizarAsync(
        int id,
        GastoAutorizacionWriteDto dto,
        int? usuarioId,
        string? usuarioNombre)
    {
        var entity = await _context.GastoAutorizacionSolicitudes.FindAsync(id)
            ?? throw new InvalidOperationException("Solicitud no encontrada.");

        if (entity.GastoId.HasValue)
            throw new InvalidOperationException("No se puede editar una solicitud que ya tiene gasto registrado.");
        if (!GastoAutorizacionHelper.EsSolicitante(entity, usuarioId, usuarioNombre))
            throw new InvalidOperationException("Solo quien creó la solicitud puede editarla.");
        if (entity.EstadoAutorizacion != GastoAutorizacionHelper.EstadoPendiente
            && entity.EstadoAutorizacion != GastoAutorizacionHelper.EstadoAutorizada)
            throw new InvalidOperationException("No se puede editar una solicitud rechazada.");

        AplicarDatosEscritura(entity, dto);

        if (entity.EstadoAutorizacion == GastoAutorizacionHelper.EstadoAutorizada)
        {
            entity.EstadoAutorizacion = GastoAutorizacionHelper.EstadoPendiente;
            entity.AutorizadoPorId = null;
            entity.AutorizadoPorNombre = null;
            entity.FechaResolucion = null;
            entity.MotivoRechazo = null;
        }

        await _context.SaveChangesAsync();
        await NotificarEmailSeguroAsync(entity, "actualizada");
        return Map(entity, usuarioId, usuarioNombre, GastoAutorizacionHelper.EsAutorizador(usuarioNombre));
    }

    public async Task EliminarAsync(int id, int? usuarioId, string? usuarioNombre, string? usuarioRole = null)
    {
        var entity = await _context.GastoAutorizacionSolicitudes.FindAsync(id)
            ?? throw new InvalidOperationException("Solicitud no encontrada.");

        var esAutorizador = GastoAutorizacionHelper.EsAutorizador(usuarioNombre, usuarioRole);
        if (!GastoAutorizacionHelper.EsSolicitante(entity, usuarioId, usuarioNombre) && !esAutorizador)
            throw new InvalidOperationException("No tiene permiso para eliminar esta solicitud.");

        _context.GastoAutorizacionSolicitudes.Remove(entity);
        await _context.SaveChangesAsync();
    }

    public async Task<GastoAutorizacionSolicitudDto> AutorizarAsync(
        int id,
        int? autorizadorId,
        string? autorizadorNombre,
        string? autorizadorRole = null)
    {
        if (!GastoAutorizacionHelper.EsAutorizador(autorizadorNombre, autorizadorRole))
            throw new InvalidOperationException("No tiene permiso para autorizar solicitudes de gasto.");

        var entity = await _context.GastoAutorizacionSolicitudes.FindAsync(id)
            ?? throw new InvalidOperationException("Solicitud no encontrada.");

        if (entity.EstadoAutorizacion != GastoAutorizacionHelper.EstadoPendiente)
            throw new InvalidOperationException("La solicitud ya fue resuelta.");

        entity.EstadoAutorizacion = GastoAutorizacionHelper.EstadoAutorizada;
        entity.AutorizadoPorId = autorizadorId;
        entity.AutorizadoPorNombre = string.IsNullOrWhiteSpace(autorizadorNombre) ? null : autorizadorNombre.Trim();
        entity.FechaResolucion = DateTime.UtcNow;
        entity.MotivoRechazo = null;

        await _context.SaveChangesAsync();

        try
        {
            var gastoId = await GastoAutorizacionMaterializacionHelper.MaterializarGastoAsync(_context, entity);
            if (gastoId.HasValue && gastoId.Value > 0)
            {
                entity.GastoId = gastoId.Value;
                await _context.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GastoAutorizacion] No se pudo materializar movimiento para solicitud #{entity.Id}: {ex.Message}");
        }

        await NotificarEmailSeguroAsync(entity, "autorizada");
        return Map(entity, autorizadorId, autorizadorNombre, true);
    }

    /// <summary>
    /// Crea movimientos para solicitudes autorizadas que aún no tienen gasto vinculado (migración / sincronización).
    /// </summary>
    public async Task<int> MaterializarAutorizadasSinGastoAsync()
    {
        var pendientes = await _context.GastoAutorizacionSolicitudes
            .Where(s => s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoAutorizada && s.GastoId == null)
            .ToListAsync();

        var creados = 0;
        foreach (var sol in pendientes)
        {
            try
            {
                var gastoId = await GastoAutorizacionMaterializacionHelper.MaterializarGastoAsync(_context, sol);
                if (gastoId.HasValue && gastoId.Value > 0)
                {
                    sol.GastoId = gastoId.Value;
                    creados++;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GastoAutorizacion] Materializar #{sol.Id}: {ex.Message}");
            }
        }

        if (creados > 0)
            await _context.SaveChangesAsync();

        return creados;
    }

    public async Task<GastoAutorizacionSolicitudDto> RechazarAsync(
        int id,
        GastoAutorizacionRechazoDto dto,
        int? autorizadorId,
        string? autorizadorNombre,
        string? autorizadorRole = null)
    {
        if (!GastoAutorizacionHelper.EsAutorizador(autorizadorNombre, autorizadorRole))
            throw new InvalidOperationException("No tiene permiso para rechazar solicitudes de gasto.");

        if (string.IsNullOrWhiteSpace(dto.MotivoRechazo))
            throw new InvalidOperationException("Debe indicar el motivo del rechazo.");

        var entity = await _context.GastoAutorizacionSolicitudes.FindAsync(id)
            ?? throw new InvalidOperationException("Solicitud no encontrada.");

        if (entity.EstadoAutorizacion != GastoAutorizacionHelper.EstadoPendiente)
            throw new InvalidOperationException("La solicitud ya fue resuelta.");

        entity.EstadoAutorizacion = GastoAutorizacionHelper.EstadoNoAutorizada;
        entity.AutorizadoPorId = autorizadorId;
        entity.AutorizadoPorNombre = string.IsNullOrWhiteSpace(autorizadorNombre) ? null : autorizadorNombre.Trim();
        entity.FechaResolucion = DateTime.UtcNow;
        entity.MotivoRechazo = dto.MotivoRechazo.Trim();

        await _context.SaveChangesAsync();
        await NotificarEmailSeguroAsync(entity, "rechazada");
        return Map(entity, autorizadorId, autorizadorNombre, true);
    }

    public async Task<GastoAutorizacionSolicitud?> ValidarParaRegistrarGastoAsync(
        string modulo,
        int autorizacionId,
        int adminId,
        bool esNomina)
    {
        if (esNomina)
            return null;

        var sol = await _context.GastoAutorizacionSolicitudes.FindAsync(autorizacionId)
            ?? throw new InvalidOperationException("La autorización indicada no existe.");

        if (!string.Equals(sol.Modulo, modulo, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("La autorización no corresponde a este módulo.");

        if (sol.EstadoAutorizacion != GastoAutorizacionHelper.EstadoAutorizada)
            throw new InvalidOperationException("La solicitud no está autorizada.");

        if (sol.GastoId.HasValue)
            throw new InvalidOperationException("Esta autorización ya fue usada para registrar un gasto.");

        if (sol.SolicitadoPorId != adminId)
            throw new InvalidOperationException("Solo quien solicitó la autorización puede registrar el gasto.");

        return sol;
    }

    public async Task ExigirAutorizacionParaGastoNormalAsync(
        string modulo,
        int? autorizacionId,
        int adminId,
        bool esNomina)
    {
        if (esNomina) return;

        if (!autorizacionId.HasValue || autorizacionId.Value <= 0)
            throw new InvalidOperationException("Debe solicitar y obtener autorización antes de registrar el gasto.");

        await ValidarParaRegistrarGastoAsync(modulo, autorizacionId.Value, adminId, false);
    }

    public async Task VincularGastoRegistradoAsync(int autorizacionId, int gastoId)
    {
        var sol = await _context.GastoAutorizacionSolicitudes.FindAsync(autorizacionId);
        if (sol == null) return;
        sol.GastoId = gastoId;
        await _context.SaveChangesAsync();
    }

    private async Task NotificarEmailSeguroAsync(GastoAutorizacionSolicitud entity, string evento)
    {
        try
        {
            await _email.NotificarSolicitudAsync(entity, evento);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GastoAutorizacionEmail] {ex.Message}");
        }
    }

    public async Task<List<GastoAutorizacionComentarioDto>> ListarComentariosAsync(int solicitudId)
    {
        var sol = await _context.GastoAutorizacionSolicitudes
            .AsNoTracking()
            .Include(s => s.Comentarios)
            .FirstOrDefaultAsync(s => s.Id == solicitudId);
        if (sol == null) return new List<GastoAutorizacionComentarioDto>();
        return ConstruirArbolComentarios(sol.Comentarios);
    }

    public async Task<GastoAutorizacionComentarioDto> AgregarComentarioAsync(
        int solicitudId,
        GastoAutorizacionComentarioWriteDto dto,
        int? usuarioId,
        string? usuarioNombre)
    {
        if (string.IsNullOrWhiteSpace(dto.Texto))
            throw new InvalidOperationException("El comentario no puede estar vacío.");

        var sol = await _context.GastoAutorizacionSolicitudes.FindAsync(solicitudId)
            ?? throw new InvalidOperationException("Solicitud no encontrada.");

        int? parentId = null;
        if (!string.IsNullOrWhiteSpace(dto.ParentId))
        {
            if (!int.TryParse(dto.ParentId, out var parsedParent))
                throw new InvalidOperationException("Comentario padre no válido.");

            var parent = await _context.GastoAutorizacionComentarios
                .FirstOrDefaultAsync(c => c.Id == parsedParent && c.SolicitudId == solicitudId)
                ?? throw new InvalidOperationException("Comentario padre no encontrado.");

            parentId = parent.Id;
        }

        var entity = new GastoAutorizacionComentario
        {
            SolicitudId = sol.Id,
            ParentId = parentId,
            Texto = dto.Texto.Trim(),
            UsuarioId = usuarioId,
            UsuarioNombre = string.IsNullOrWhiteSpace(usuarioNombre) ? null : usuarioNombre.Trim(),
            FechaRegistro = DateTime.UtcNow,
        };

        _context.GastoAutorizacionComentarios.Add(entity);
        await _context.SaveChangesAsync();

        return new GastoAutorizacionComentarioDto
        {
            Id = entity.Id.ToString(),
            Texto = entity.Texto,
            UsuarioNombre = entity.UsuarioNombre,
            Fecha = FormatoFecha(entity.FechaRegistro),
            Hora = FormatoHoraColombia(entity.FechaRegistro),
            Respuestas = new List<GastoAutorizacionComentarioDto>(),
        };
    }

    private static DateTime ParseFecha(string? value, DateTime fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
            return iso.Date;
        if (DateTime.TryParse(value, new CultureInfo("es-CO"), DateTimeStyles.None, out var co))
            return co.Date;
        if (DateTime.TryParse(value, out var dt)) return dt.Date;
        return fallback;
    }
}
