using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Services;

public static class AlmacenCatalog
{
    public static readonly AlmacenTipoRequisicionDto[] TiposRequisicion =
    {
        new() { Id = "consumo_diario", Label = "Insumos de Consumo Diario", AccentColor = "#22C55E" },
        new() { Id = "cajas_empaque", Label = "Cajas y Empaque", AccentColor = "#3B82F6" },
        new() { Id = "gomas_adhesivos", Label = "Gomas y Adhesivos", AccentColor = "#EAB308" },
        new() { Id = "pantone", Label = "Tinta", AccentColor = "#A855F7" },
    };

    public static readonly string[] UnidadesMedida =
        { "kg", "unidades", "metros", "litros", "rollos", "cajas", "galones" };

  private static readonly HashSet<string> CategoriasCajasEmpaque = new(StringComparer.OrdinalIgnoreCase)
    {
        "cintas y empaque",
        "carton y cartulina",
        "cintas de estampar",
        "papel y carton",
        "papeles",
    };

    public static string NormalizarTextoClave(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;
        var t = Regex.Replace(texto.Trim().ToLowerInvariant(), @"\s+", " ");
        t = t.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(t.Length);
        foreach (var ch in t)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    public static string MapearCategoriaExcelATipoRequisicion(string? categoriaExcel)
    {
        var c = NormalizarTextoClave(categoriaExcel);
        if (string.IsNullOrEmpty(c)) return "consumo_diario";

        if (c is "tintas" or "tintas y sustratos")
            return "pantone";

        if (c is "pegantes" or "pegante y gomas")
            return "gomas_adhesivos";

        if (CategoriasCajasEmpaque.Contains(c))
            return "cajas_empaque";

        return "consumo_diario";
    }

    public static string? NormalizarUnidadMedidaProducto(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var u = raw.Trim().ToUpperInvariant();
        return u switch
        {
            "MTK" or "MT2" or "MT" or "MTS" or "METROS" or "M" => "metros",
            "UND" or "UNIDAD" or "UNIDADES" or "UN" => "unidades",
            "KG" or "KILO" or "KILOS" => "kg",
            "LT" or "LTS" or "LITROS" or "L" => "litros",
            "ROL" or "ROLLO" or "ROLLOS" => "rollos",
            "GL" or "GAL" or "GALONES" => "galones",
            "CAJ" or "CAJA" or "CAJAS" => "cajas",
            _ => raw.Trim().Length > 30 ? raw.Trim()[..30] : raw.Trim(),
        };
    }

    public static decimal? ParsearCostoEstandarExcel(object? valorCelda, string? texto)
    {
        if (valorCelda is double d) return Math.Round((decimal)d, 2);
        if (valorCelda is decimal dec) return Math.Round(dec, 2);
        if (valorCelda is int i) return i;
        if (valorCelda is long l) return l;

        var raw = (texto ?? valorCelda?.ToString() ?? "").Trim();
        if (string.IsNullOrWhiteSpace(raw)) return null;

        raw = raw.Replace("$", "").Replace(" ", "");
        if (decimal.TryParse(raw, NumberStyles.Any, CultureInfo.InvariantCulture, out var inv))
            return Math.Round(inv, 2);

        var sinMiles = raw.Contains(',')
            ? raw.Replace(".", "").Replace(',', '.')
            : raw;
        if (decimal.TryParse(sinMiles, NumberStyles.Any, CultureInfo.InvariantCulture, out var co))
            return Math.Round(co, 2);

        return null;
    }
}

public class AlmacenService
{
    private readonly AppDbContext _context;

    public AlmacenService(AppDbContext context)
    {
        _context = context;
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

    public static DateTime ParseFecha(string? value, DateTime fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
            return iso.Date;
        if (DateTime.TryParse(value, new CultureInfo("es-CO"), DateTimeStyles.None, out var co))
            return co.Date;
        if (DateTime.TryParse(value, out var dt)) return dt.Date;
        return fallback;
    }

    public static DateTime? ParseFecha(string? value, DateTime? fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
            return iso.Date;
        if (DateTime.TryParse(value, new CultureInfo("es-CO"), DateTimeStyles.None, out var co))
            return co.Date;
        if (DateTime.TryParse(value, out var dt)) return dt.Date;
        return fallback;
    }

    public async Task<string> GenerarCodigoRequisicionAsync()
    {
        var year = DateTime.UtcNow.Year;
        var codigos = await _context.AlmacenRequisiciones
            .Where(r => r.FechaRegistro.Year == year)
            .Select(r => r.Codigo)
            .ToListAsync();

        var maxNum = 0;
        foreach (var codigo in codigos)
        {
            if (!codigo.StartsWith("REQ-", StringComparison.OrdinalIgnoreCase)) continue;
            var suffix = codigo[4..];
            if (int.TryParse(suffix, out var n) && n > maxNum)
                maxNum = n;
        }

        return $"REQ-{maxNum + 1:D3}";
    }

    /// <summary>
    /// Corrige en memoria cantidades y estados de proveedor según el historial de recepciones.
    /// </summary>
    public void NormalizarRecepcionProveedores(AlmacenRequisicion req)
    {
        if (req.Pedido == null || req.RecepcionLineas.Count == 0) return;
        RecalcularEstadosProveedoresDesdeLineas(req);
    }

    public AlmacenRequisicionDto MapRequisicion(AlmacenRequisicion r)
    {
        NormalizarRecepcionProveedores(r);

        var dto = new AlmacenRequisicionDto
        {
            Id = r.Id.ToString(),
            Codigo = r.Codigo,
            TipoRequisicion = r.TipoRequisicionId,
            FechaSolicitud = FormatoFecha(r.FechaSolicitud),
            HoraRegistro = FormatoHoraColombia(r.FechaRegistro),
            OrdenProduccion = r.OrdenProduccionNumero,
            Cliente = r.Cliente,
            Referencia = r.Referencia,
            Producto = r.ProductoNombre,
            Cantidad = r.Cantidad,
            Unidad = r.Unidad,
            FechaRequerida = FormatoFecha(r.FechaRequerida),
            Observacion = r.Observacion,
            Estado = r.Estado,
            CreadoPorNombre = r.CreadoPorNombre,
        };

        if (r.Pedido != null)
        {
            var provs = r.Pedido.Proveedores.OrderBy(p => p.Id).ToList();
            var fechas = provs.Select(p => p.FechaEntregaEstimada).Where(f => f.HasValue).Select(f => f!.Value).ToList();
            var fechaResumen = fechas.Count > 0
                ? fechas.Max()
                : r.Pedido.FechaEntregaEstimada ?? r.Pedido.FechaPedido;

            dto.Pedido = new AlmacenDatosPedidoDto
            {
                FechaPedido = FormatoFecha(r.Pedido.FechaPedido),
                FechaEntregaEstimada = FormatoFecha(fechaResumen),
                PrecioUnitario = r.Pedido.PrecioUnitario,
                ProcesadoPorNombre = r.Pedido.ProcesadoPorNombre,
                Proveedores = provs.Select(p => new AlmacenProveedorAsignadoDto
                {
                    Id = p.Id.ToString(),
                    Nombre = p.Nombre,
                    Cantidad = p.Cantidad,
                    Nit = p.Nit,
                    Telefono = p.Telefono,
                    CatalogoId = p.ProveedorCatalogoId?.ToString(),
                    FechaEntregaEstimada = p.FechaEntregaEstimada.HasValue ? FormatoFecha(p.FechaEntregaEstimada.Value) : null,
                    PrecioUnitario = p.PrecioUnitario ?? r.Pedido.PrecioUnitario,
                    Recibido = p.Recibido,
                    Pagado = p.Pagado,
                    FormaPago = p.FormaPago,
                    NumeroOrdenCompra = p.OrdenCompra?.NumeroOrdenCompra ?? p.NumeroOrdenCompra,
                    OrdenCompraId = p.OrdenCompraId?.ToString(),
                }).ToList(),
            };
        }

        if (r.RecepcionLineas?.Count > 0)
        {
            dto.Recepcion = new AlmacenDatosRecepcionDto
            {
                Lineas = r.RecepcionLineas
                    .OrderBy(l => l.FechaLlegada)
                    .ThenBy(l => l.Id)
                    .Select(l => new AlmacenRecepcionLineaDto
                    {
                        ProveedorId = l.PedidoProveedorId.ToString(),
                        NombreProveedor = l.NombreProveedor,
                        CodigoUsuario = l.CodigoUsuario,
                        RegistradoPorNombre = l.RegistradoPorNombre,
                        FechaLlegada = FormatoFecha(l.FechaLlegada),
                        CalidadEsperada = l.CalidadEsperada,
                        MotivoCalidadNo = l.MotivoCalidadNo,
                        FacturaEntregada = l.FacturaEntregada,
                        MotivoFacturaNo = l.MotivoFacturaNo,
                        CantidadRecibida = l.CantidadRecibida,
                        CantidadPedidaEnMomento = l.CantidadPedidaEnMomento,
                        PedidoCompleto = l.PedidoCompleto,
                        MotivoCantidadParcial = l.MotivoCantidadParcial,
                        NuevaFechaEntrega = l.NuevaFechaEntrega.HasValue ? FormatoFecha(l.NuevaFechaEntrega.Value) : null,
                    }).ToList(),
            };
        }

        return dto;
    }

    public async Task<AlmacenRequisicion?> CargarRequisicionCompletaAsync(int id)
    {
        var req = await _context.AlmacenRequisiciones
            .Include(r => r.Pedido!)
                .ThenInclude(p => p.Proveedores)
                    .ThenInclude(pv => pv.OrdenCompra)
            .Include(r => r.RecepcionLineas)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (req != null)
        {
            EliminarLineasRecepcionDuplicadas(req);
            RecalcularEstadosProveedoresDesdeLineas(req);
        }

        return req;
    }

    /// <summary>
    /// Elimina líneas duplicadas (mismo proveedor + código de recepción). Conserva la más antigua.
    /// </summary>
    public bool EliminarLineasRecepcionDuplicadas(AlmacenRequisicion req)
    {
        if (req.RecepcionLineas.Count < 2) return false;

        var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var duplicadas = new List<AlmacenRecepcionLinea>();

        foreach (var linea in req.RecepcionLineas.OrderBy(l => l.Id))
        {
            var clave = $"{linea.PedidoProveedorId}|{linea.CodigoUsuario.Trim()}";
            if (!vistos.Add(clave))
                duplicadas.Add(linea);
        }

        if (duplicadas.Count == 0) return false;

        foreach (var linea in duplicadas)
        {
            _context.AlmacenRecepcionLineas.Remove(linea);
            req.RecepcionLineas.Remove(linea);
        }

        return true;
    }

    /// <summary>
    /// Sincroniza Recibido y estado del pedido según la suma real de líneas de recepción.
    /// </summary>
    public void RecalcularEstadosProveedoresDesdeLineas(AlmacenRequisicion req)
    {
        if (req.Pedido == null) return;

        ReconciliarCantidadesPedidoOriginal(req);

        foreach (var prov in req.Pedido.Proveedores)
        {
            var lineasProv = req.RecepcionLineas
                .Where(l => l.PedidoProveedorId == prov.Id)
                .OrderBy(l => l.FechaLlegada)
                .ThenBy(l => l.Id)
                .ToList();

            if (lineasProv.Count == 0 && prov.Cantidad <= 0) continue;

            prov.Recibido = lineasProv.Any(l => l.PedidoCompleto);
            if (prov.Recibido)
            {
                var totalRecibido = CantidadRecibidaProveedor(req, prov.Id);
                if (totalRecibido > 0)
                    prov.Cantidad = totalRecibido;
            }
        }

        ActualizarEstadoRecepcion(req);
    }

    public decimal CantidadRecibidaProveedor(AlmacenRequisicion req, int pedidoProveedorId)
    {
        return req.RecepcionLineas
            .Where(l => l.PedidoProveedorId == pedidoProveedorId)
            .Sum(l => l.CantidadRecibida);
    }

    /// <summary>
    /// Total pedido original del proveedor desde líneas de recepción.
    /// CantidadPedidaEnMomento = total pedido (formato actual) o saldo pendiente (legacy).
    /// </summary>
    public decimal InferirCantidadPedidaProveedor(AlmacenRequisicion req, AlmacenPedidoProveedor prov)
    {
        var totalRecibido = CantidadRecibidaProveedor(req, prov.Id);
        if (prov.Recibido && totalRecibido > 0) return totalRecibido;

        var lineas = req.RecepcionLineas
            .Where(l => l.PedidoProveedorId == prov.Id)
            .OrderBy(l => l.FechaLlegada)
            .ThenBy(l => l.Id)
            .ToList();

        var inferidoDesdeLineas = InferirCantidadPedidaDesdeLineas(lineas);
        if (inferidoDesdeLineas > 0)
            return inferidoDesdeLineas;

        if (prov.Cantidad > 0)
            return prov.Cantidad;

        return totalRecibido;
    }

    /// <summary>
    /// Si todas las líneas guardan el mismo CantidadPedidaEnMomento, es el total pedido.
    /// Si varían, se asume formato legacy (saldo pendiente antes de cada envío).
    /// </summary>
    internal static decimal InferirCantidadPedidaDesdeLineas(IEnumerable<AlmacenRecepcionLinea> lineas)
    {
        var ordenadas = lineas
            .OrderBy(l => l.FechaLlegada)
            .ThenBy(l => l.Id)
            .ToList();

        var momentos = ordenadas
            .Where(l => l.CantidadPedidaEnMomento > 0)
            .Select(l => l.CantidadPedidaEnMomento)
            .ToList();

        if (momentos.Count == 0) return 0;

        var primerMomento = momentos[0];
        if (momentos.All(m => Math.Abs(m - primerMomento) < 0.001m))
            return primerMomento;

        var inferido = 0m;
        decimal acum = 0;
        foreach (var l in ordenadas)
        {
            if (l.CantidadPedidaEnMomento > 0)
                inferido = Math.Max(inferido, acum + l.CantidadPedidaEnMomento);
            acum += l.CantidadRecibida;
        }

        return inferido;
    }

    public void AplicarRecepcionAProveedor(
        AlmacenRequisicion req,
        AlmacenPedidoProveedor prov,
        decimal cantidadPedidaOriginal,
        bool pedidoCompletoEfectivo)
    {
        var totalRecibido = CantidadRecibidaProveedor(req, prov.Id);

        if (pedidoCompletoEfectivo || totalRecibido >= cantidadPedidaOriginal - 0.0001m)
        {
            prov.Recibido = true;
        }
        else
        {
            prov.Recibido = false;
        }
    }

    public void AplicarFechaRestoProveedor(AlmacenPedidoProveedor prov, string? nuevaFechaEntrega, bool pedidoCompletoEfectivo)
    {
        if (pedidoCompletoEfectivo || string.IsNullOrWhiteSpace(nuevaFechaEntrega)) return;
        prov.FechaEntregaEstimada = ParseFecha(nuevaFechaEntrega, DateTime.UtcNow.Date);
    }

    /// <summary>
    /// Restaura la cantidad pedida original (p. ej. 50) si quedó reducida por recepciones parciales antiguas.
    /// </summary>
    public void ReconciliarCantidadesPedidoOriginal(AlmacenRequisicion req)
    {
        if (req.Pedido == null) return;

        foreach (var prov in req.Pedido.Proveedores)
        {
            var totalRecibido = CantidadRecibidaProveedor(req, prov.Id);
            if (totalRecibido <= 0 && prov.Cantidad <= 0) continue;

            if (prov.Recibido && totalRecibido > 0)
            {
                prov.Cantidad = totalRecibido;
                continue;
            }

            var inferido = InferirCantidadPedidaProveedor(req, prov);

            if (prov.Cantidad <= 0 && inferido > 0)
                prov.Cantidad = inferido;
            else if (totalRecibido > 0 && prov.Cantidad + 0.0001m < totalRecibido)
                prov.Cantidad = Math.Max(inferido, totalRecibido);
            else if (inferido > 0 && prov.Cantidad > inferido + 0.0001m)
                prov.Cantidad = inferido;

            if (prov.Recibido && totalRecibido + 0.0001m < inferido)
            {
                prov.Recibido = false;
                foreach (var l in req.RecepcionLineas.Where(l => l.PedidoProveedorId == prov.Id))
                    l.PedidoCompleto = false;
            }
        }
    }

    public bool TieneSaldoPendienteRecepcion(AlmacenRequisicion req)
    {
        if (req.Pedido == null) return false;

        foreach (var prov in req.Pedido.Proveedores)
        {
            if (prov.Cantidad <= 0 && CantidadRecibidaProveedor(req, prov.Id) <= 0) continue;

            var pedidoOriginal = InferirCantidadPedidaProveedor(req, prov);
            if (pedidoOriginal <= 0) pedidoOriginal = prov.Cantidad;

            var saldo = pedidoOriginal - CantidadRecibidaProveedor(req, prov.Id);
            if (saldo > 0.0001m) return true;
        }

        return false;
    }

    public bool TieneRecepcionRegistrada(AlmacenRequisicion req) =>
        req.RecepcionLineas.Count > 0;

    public void ActualizarEstadoRecepcion(AlmacenRequisicion req)
    {
        if (req.Pedido == null) return;

        var activos = req.Pedido.Proveedores
            .Where(p => p.Cantidad > 0 || p.Recibido || CantidadRecibidaProveedor(req, p.Id) > 0)
            .ToList();

        var todosCompletos = activos.Count > 0 && activos.All(p => p.Recibido);

        if (todosCompletos && !TieneSaldoPendienteRecepcion(req))
            req.Estado = "En Almacen";
        else if (TieneSaldoPendienteRecepcion(req) && TieneRecepcionRegistrada(req))
            req.Estado = "Parcial";
        else if (req.Pedido != null)
            req.Estado = "Pedido";
    }

    public async Task<int> ObtenerMaxNumeroOrdenCompraAsync()
    {
        var maxOc = await _context.AlmacenOrdenesCompra
            .MaxAsync(o => (int?)o.NumeroOrdenCompra);
        if (maxOc.HasValue) return maxOc.Value;

        return await _context.AlmacenPedidoProveedores
            .MaxAsync(p => (int?)p.NumeroOrdenCompra) ?? 0;
    }

    public async Task<AlmacenOrdenCompra> CrearOrdenCompraAsync(
        int? proveedorCatalogoId,
        string nombreProveedor,
        string? nit,
        string? telefono,
        DateTime fechaPedido,
        DateTime? fechaEntregaEstimada,
        int? procesadoPorId,
        string? procesadoPorNombre)
    {
        var siguiente = await ObtenerMaxNumeroOrdenCompraAsync() + 1;
        var oc = new AlmacenOrdenCompra
        {
            NumeroOrdenCompra = siguiente,
            ProveedorCatalogoId = proveedorCatalogoId,
            NombreProveedor = nombreProveedor.Trim(),
            Nit = string.IsNullOrWhiteSpace(nit) ? null : nit.Trim(),
            Telefono = string.IsNullOrWhiteSpace(telefono) ? null : telefono.Trim(),
            FechaPedido = fechaPedido,
            FechaEntregaEstimada = fechaEntregaEstimada,
            Estado = "Emitida",
            ProcesadoPorId = procesadoPorId,
            ProcesadoPorNombre = string.IsNullOrWhiteSpace(procesadoPorNombre) ? null : procesadoPorNombre.Trim(),
            FechaRegistro = DateTime.UtcNow,
        };
        _context.AlmacenOrdenesCompra.Add(oc);
        return oc;
    }

    private static string NormalizarNitClave(string? nit)
    {
        if (string.IsNullOrWhiteSpace(nit)) return string.Empty;
        return new string(nit.Where(char.IsDigit).ToArray());
    }

    /// <summary>
    /// Mismo proveedor: catálogo id, o nombre normalizado (+ NIT si ambos lo tienen).
    /// Nunca fusionar solo por NIT si el nombre difiere.
    /// </summary>
    private static bool EsMismoProveedorParaOc(
        AlmacenOrdenCompra oc,
        int? proveedorCatalogoId,
        string nombreProveedor,
        string? nit)
    {
        if (proveedorCatalogoId is > 0 && oc.ProveedorCatalogoId == proveedorCatalogoId)
            return true;

        var nombreClave = AlmacenCatalog.NormalizarTextoClave(nombreProveedor);
        var ocNombreClave = AlmacenCatalog.NormalizarTextoClave(oc.NombreProveedor);
        if (string.IsNullOrEmpty(nombreClave) || nombreClave != ocNombreClave)
            return false;

        var nitClave = NormalizarNitClave(nit);
        var ocNitClave = NormalizarNitClave(oc.Nit);
        if (!string.IsNullOrEmpty(nitClave) && !string.IsNullOrEmpty(ocNitClave) && nitClave != ocNitClave)
            return false;

        return true;
    }

    /// <summary>
    /// Busca una OC en estado Emitida (no pagada) del mismo proveedor (solo referencia interna).
    /// </summary>
    [Obsolete("Ya no se usa fusión automática; el usuario elige OC manualmente.")]
    public async Task<AlmacenOrdenCompra?> BuscarOrdenCompraAbiertaProveedorAsync(
        int? proveedorCatalogoId,
        string nombreProveedor,
        string? nit)
    {
        var candidatas = await _context.AlmacenOrdenesCompra
            .Include(o => o.Lineas)
            .Where(o => o.Estado == "Emitida" && !o.Pagado)
            .OrderByDescending(o => o.NumeroOrdenCompra)
            .ToListAsync();

        return candidatas.FirstOrDefault(o =>
            EsMismoProveedorParaOc(o, proveedorCatalogoId, nombreProveedor, nit));
    }

    /// <summary>
    /// Crea OC nueva o adjunta a una existente si el usuario la eligió explícitamente.
    /// </summary>
    public async Task<AlmacenOrdenCompra> ResolverOrdenCompraParaPedidoAsync(
        string? agregarAOrdenCompraId,
        int? proveedorCatalogoId,
        string nombreProveedor,
        string? nit,
        string? telefono,
        DateTime fechaPedido,
        DateTime? fechaEntregaEstimada,
        int? procesadoPorId,
        string? procesadoPorNombre)
    {
        if (!string.IsNullOrWhiteSpace(agregarAOrdenCompraId)
            && int.TryParse(agregarAOrdenCompraId, out var ocExistenteId))
        {
            var existente = await CargarOrdenCompraCompletaAsync(ocExistenteId)
                ?? throw new InvalidOperationException("La orden de compra indicada no existe.");
            if (!string.Equals(existente.Estado, "Emitida", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Solo se pueden agregar líneas a órdenes de compra en estado Emitida.");
            if (!EsMismoProveedorParaOc(existente, proveedorCatalogoId, nombreProveedor, nit))
                throw new InvalidOperationException(
                    $"La orden de compra pertenece a «{existente.NombreProveedor}», no a «{nombreProveedor}».");

            if (proveedorCatalogoId is > 0 && existente.ProveedorCatalogoId == null)
                existente.ProveedorCatalogoId = proveedorCatalogoId;
            if (!string.IsNullOrWhiteSpace(telefono) && string.IsNullOrWhiteSpace(existente.Telefono))
                existente.Telefono = telefono.Trim();
            if (!string.IsNullOrWhiteSpace(nit) && string.IsNullOrWhiteSpace(existente.Nit))
                existente.Nit = nit.Trim();
            if (fechaEntregaEstimada.HasValue)
            {
                if (!existente.FechaEntregaEstimada.HasValue
                    || fechaEntregaEstimada.Value > existente.FechaEntregaEstimada.Value)
                {
                    existente.FechaEntregaEstimada = fechaEntregaEstimada;
                }
            }
            return existente;
        }

        return await CrearOrdenCompraAsync(
            proveedorCatalogoId,
            nombreProveedor,
            nit,
            telefono,
            fechaPedido,
            fechaEntregaEstimada,
            procesadoPorId,
            procesadoPorNombre);
    }

    public async Task<AlmacenOrdenCompraLinea> VincularPedidoProveedorAOrdenCompraAsync(
        AlmacenOrdenCompra ordenCompra,
        AlmacenPedidoProveedor pedidoProveedor,
        int requisicionId)
    {
        if (!EsMismoProveedorParaOc(
                ordenCompra,
                pedidoProveedor.ProveedorCatalogoId,
                pedidoProveedor.Nombre,
                pedidoProveedor.Nit))
        {
            throw new InvalidOperationException(
                $"La orden de compra pertenece a «{ordenCompra.NombreProveedor}», no a «{pedidoProveedor.Nombre}».");
        }

        pedidoProveedor.OrdenCompraId = ordenCompra.Id;
        pedidoProveedor.NumeroOrdenCompra = ordenCompra.NumeroOrdenCompra;

        var orden = ordenCompra.Id > 0
            ? await _context.AlmacenOrdenCompraLineas.CountAsync(l => l.OrdenCompraId == ordenCompra.Id)
            : ordenCompra.Lineas.Count;
        var linea = new AlmacenOrdenCompraLinea
        {
            OrdenCompraId = ordenCompra.Id,
            PedidoProveedorId = pedidoProveedor.Id,
            RequisicionId = requisicionId,
            Orden = orden,
        };
        _context.AlmacenOrdenCompraLineas.Add(linea);
        ordenCompra.Lineas.Add(linea);
        await Task.CompletedTask;
        return linea;
    }

    public void ActualizarFechaEntregaOrdenCompra(AlmacenOrdenCompra ordenCompra)
    {
        var fechas = ordenCompra.PedidoProveedores
            .Select(p => p.FechaEntregaEstimada)
            .Where(f => f.HasValue)
            .Select(f => f!.Value)
            .ToList();
        if (fechas.Count > 0)
            ordenCompra.FechaEntregaEstimada = fechas.Max();
    }

    /// <summary>
    /// Corrige proveedores cuya OC no corresponde (p. ej. mismo NIT, distinto nombre).
    /// </summary>
    public async Task<int> RepararOrdenesCompraProveedorMalAsignadasAsync(int? procesadoPorId, string? procesadoPorNombre)
    {
        var proveedores = await _context.AlmacenPedidoProveedores
            .Include(p => p.Pedido)
            .Include(p => p.OrdenCompra)
            .Where(p => p.OrdenCompraId != null)
            .ToListAsync();

        var reparados = 0;
        foreach (var prov in proveedores)
        {
            if (prov.OrdenCompra == null) continue;
            if (EsMismoProveedorParaOc(
                    prov.OrdenCompra,
                    prov.ProveedorCatalogoId,
                    prov.Nombre,
                    prov.Nit))
                continue;

            await ReasignarOrdenCompraProveedorAsync(prov, procesadoPorId, procesadoPorNombre);
            reparados++;
        }

        await _context.SaveChangesAsync();
        return reparados;
    }

    private async Task ReasignarOrdenCompraProveedorAsync(
        AlmacenPedidoProveedor prov,
        int? procesadoPorId,
        string? procesadoPorNombre)
    {
        var reqId = prov.Pedido!.RequisicionId;
        var linea = await _context.AlmacenOrdenCompraLineas
            .FirstOrDefaultAsync(l => l.PedidoProveedorId == prov.Id);
        if (linea != null)
        {
            var ocId = linea.OrdenCompraId;
            _context.AlmacenOrdenCompraLineas.Remove(linea);
            await _context.SaveChangesAsync();

            var quedan = await _context.AlmacenOrdenCompraLineas.CountAsync(l => l.OrdenCompraId == ocId);
            if (quedan == 0)
            {
                var ocVacia = await _context.AlmacenOrdenesCompra.FindAsync(ocId);
                if (ocVacia != null) _context.AlmacenOrdenesCompra.Remove(ocVacia);
            }
        }

        prov.OrdenCompraId = null;
        prov.NumeroOrdenCompra = null;
        await _context.SaveChangesAsync();

        var oc = await CrearOrdenCompraAsync(
            prov.ProveedorCatalogoId,
            prov.Nombre,
            prov.Nit,
            prov.Telefono,
            prov.Pedido.FechaPedido,
            prov.FechaEntregaEstimada,
            procesadoPorId,
            procesadoPorNombre);
        await _context.SaveChangesAsync();
        await VincularPedidoProveedorAOrdenCompraAsync(oc, prov, reqId);
        ActualizarFechaEntregaOrdenCompra(oc);
        await _context.SaveChangesAsync();
    }

    public async Task<AlmacenOrdenCompra?> CargarOrdenCompraCompletaAsync(int id)
    {
        return await _context.AlmacenOrdenesCompra
            .Include(o => o.Lineas)
                .ThenInclude(l => l.Requisicion)
            .Include(o => o.Lineas)
                .ThenInclude(l => l.PedidoProveedor)
            .Include(o => o.PedidoProveedores)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public AlmacenOrdenCompraDto MapOrdenCompra(AlmacenOrdenCompra oc)
    {
        var lineasOrdenadas = oc.Lineas
            .OrderBy(l => l.Orden)
            .ThenBy(l => l.Id)
            .ToList();

        var fechas = lineasOrdenadas
            .Select(l => l.PedidoProveedor.FechaEntregaEstimada)
            .Where(f => f.HasValue)
            .Select(f => f!.Value)
            .ToList();
        var fechaResumen = fechas.Count > 0
            ? fechas.Max()
            : oc.FechaEntregaEstimada ?? oc.FechaPedido;

        return new AlmacenOrdenCompraDto
        {
            Id = oc.Id.ToString(),
            NumeroOrdenCompra = oc.NumeroOrdenCompra,
            NombreProveedor = oc.NombreProveedor,
            Nit = oc.Nit,
            Telefono = oc.Telefono,
            CatalogoId = oc.ProveedorCatalogoId?.ToString(),
            FechaPedido = FormatoFecha(oc.FechaPedido),
            FechaEntregaEstimada = FormatoFecha(fechaResumen),
            Estado = oc.Estado,
            Pagado = oc.Pagado,
            FormaPago = oc.FormaPago,
            ProcesadoPorNombre = oc.ProcesadoPorNombre,
            Lineas = lineasOrdenadas.Select(l =>
            {
                var req = l.Requisicion;
                var prov = l.PedidoProveedor;
                return new AlmacenOrdenCompraLineaDto
                {
                    Id = l.Id.ToString(),
                    PedidoProveedorId = prov.Id.ToString(),
                    RequisicionId = req.Id.ToString(),
                    RequisicionCodigo = req.Codigo,
                    Producto = req.ProductoNombre,
                    OrdenProduccion = req.OrdenProduccionNumero,
                    Referencia = req.Referencia,
                    Cliente = req.Cliente,
                    Cantidad = prov.Cantidad,
                    Unidad = req.Unidad,
                    PrecioUnitario = prov.PrecioUnitario,
                    FechaEntregaEstimada = prov.FechaEntregaEstimada.HasValue
                        ? FormatoFecha(prov.FechaEntregaEstimada.Value)
                        : null,
                    Recibido = prov.Recibido,
                    Pagado = prov.Pagado,
                };
            }).ToList(),
        };
    }

    public async Task<List<AlmacenOrdenCompraDto>> ListarOrdenesCompraAsync(
        string? estado = null,
        int? proveedorCatalogoId = null,
        string? nombreProveedor = null,
        string? nit = null)
    {
        var query = _context.AlmacenOrdenesCompra.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(estado))
            query = query.Where(o => o.Estado == estado);

        var list = await query
            .OrderByDescending(o => o.NumeroOrdenCompra)
            .Take(200)
            .ToListAsync();

        if (proveedorCatalogoId is > 0 || !string.IsNullOrWhiteSpace(nombreProveedor))
        {
            list = list
                .Where(o => EsMismoProveedorParaOc(o, proveedorCatalogoId, nombreProveedor ?? "", nit))
                .ToList();
        }

        var ids = list.Select(o => o.Id).ToList();
        var lineas = await _context.AlmacenOrdenCompraLineas
            .AsNoTracking()
            .Include(l => l.Requisicion)
            .Include(l => l.PedidoProveedor)
            .Where(l => ids.Contains(l.OrdenCompraId))
            .ToListAsync();

        foreach (var oc in list)
            oc.Lineas = lineas.Where(l => l.OrdenCompraId == oc.Id).ToList();

        return list.Select(MapOrdenCompra).ToList();
    }

    public async Task<AlmacenConsolidarPedidoResultDto> ConsolidarPedidoAsync(
        AlmacenConsolidarPedidoWriteDto dto,
        int? procesadoPorId,
        string? procesadoPorNombre)
    {
        var provDto = dto.Proveedor ?? throw new InvalidOperationException("Seleccione el proveedor.");
        if (string.IsNullOrWhiteSpace(provDto.Nombre))
            throw new InvalidOperationException("Indique el nombre del proveedor.");

        var lineasWrite = (dto.Lineas ?? new List<AlmacenConsolidarPedidoLineaWriteDto>())
            .Where(l => !string.IsNullOrWhiteSpace(l.RequisicionId) && l.Cantidad > 0)
            .ToList();
        if (lineasWrite.Count < 2)
            throw new InvalidOperationException("Seleccione al menos dos requisiciones para consolidar.");

        int? catalogoIdHint = null;
        if (!string.IsNullOrWhiteSpace(provDto.CatalogoId) && int.TryParse(provDto.CatalogoId, out var cid))
            catalogoIdHint = cid;

        var catalogoEntity = await UpsertProveedorCatalogoDesdePedidoAsync(
            provDto.Nombre.Trim(),
            provDto.Nit,
            provDto.Telefono,
            catalogoIdHint,
            provDto.Categoria,
            provDto.ResponsableIva);

        await _context.SaveChangesAsync();
        var catalogoId = catalogoEntity?.Id;

        AlmacenOrdenCompra? ordenCompra = null;
        if (!string.IsNullOrWhiteSpace(dto.AgregarAOrdenCompraId)
            && int.TryParse(dto.AgregarAOrdenCompraId, out var ocExistenteId))
        {
            ordenCompra = await CargarOrdenCompraCompletaAsync(ocExistenteId);
            if (ordenCompra == null)
                throw new InvalidOperationException("La orden de compra indicada no existe.");
            if (!string.Equals(ordenCompra.Estado, "Emitida", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Solo se pueden agregar líneas a órdenes de compra en estado Emitida.");
        }

        var fechaPedido = ParseFecha(dto.FechaPedido, DateTime.UtcNow.Date);
        var fechaEntregaGlobal = ParseFecha(dto.FechaEntregaEstimada, (DateTime?)null);

        if (ordenCompra == null)
        {
            ordenCompra = await CrearOrdenCompraAsync(
                catalogoId,
                provDto.Nombre.Trim(),
                provDto.Nit,
                provDto.Telefono,
                fechaPedido,
                fechaEntregaGlobal,
                procesadoPorId,
                procesadoPorNombre);
            await _context.SaveChangesAsync();
        }
        else if (!EsMismoProveedorParaOc(ordenCompra, catalogoId, provDto.Nombre.Trim(), provDto.Nit))
        {
            throw new InvalidOperationException(
                $"La orden de compra pertenece a «{ordenCompra.NombreProveedor}», no a «{provDto.Nombre}».");
        }

        var requisicionesActualizadas = new List<AlmacenRequisicionDto>();
        var reqIds = lineasWrite
            .Select(l => int.TryParse(l.RequisicionId, out var rid) ? rid : 0)
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (reqIds.Count != lineasWrite.Count)
            throw new InvalidOperationException("Hay requisiciones duplicadas o inválidas en la consolidación.");

        foreach (var lineaWrite in lineasWrite)
        {
            if (!int.TryParse(lineaWrite.RequisicionId, out var reqId))
                throw new InvalidOperationException("Requisición inválida.");

            var entity = await CargarRequisicionCompletaAsync(reqId)
                ?? throw new InvalidOperationException($"Requisición {reqId} no encontrada.");

            if (entity.Estado != "Pendiente")
                throw new InvalidOperationException($"La requisición {entity.Codigo} no está pendiente de pedido.");

            var fechaEntrega = string.IsNullOrWhiteSpace(lineaWrite.FechaEntregaEstimada)
                ? fechaEntregaGlobal
                : ParseFecha(lineaWrite.FechaEntregaEstimada, DateTime.UtcNow.Date);

            if (entity.Pedido == null)
            {
                entity.Pedido = new AlmacenPedido
                {
                    RequisicionId = entity.Id,
                    FechaPedido = fechaPedido,
                    ProcesadoPorId = procesadoPorId,
                    ProcesadoPorNombre = string.IsNullOrWhiteSpace(procesadoPorNombre) ? null : procesadoPorNombre.Trim(),
                };
                _context.AlmacenPedidos.Add(entity.Pedido);
            }
            else
            {
                entity.Pedido.FechaPedido = fechaPedido;
                entity.Pedido.ProcesadoPorId = procesadoPorId;
                entity.Pedido.ProcesadoPorNombre = string.IsNullOrWhiteSpace(procesadoPorNombre) ? null : procesadoPorNombre.Trim();
            }

            var nuevoProv = new AlmacenPedidoProveedor
            {
                ProveedorCatalogoId = catalogoId,
                Nombre = provDto.Nombre!.Trim(),
                Nit = provDto.Nit?.Trim(),
                Telefono = provDto.Telefono?.Trim(),
                Cantidad = lineaWrite.Cantidad,
                PrecioUnitario = lineaWrite.PrecioUnitario,
                FechaEntregaEstimada = fechaEntrega,
                Recibido = false,
            };
            entity.Pedido.Proveedores.Add(nuevoProv);
            await _context.SaveChangesAsync();

            await VincularPedidoProveedorAOrdenCompraAsync(ordenCompra, nuevoProv, entity.Id);
            ordenCompra.PedidoProveedores.Add(nuevoProv);

            RecalcularEstadosProveedoresDesdeLineas(entity);
            NormalizarFechaEntregaPedido(entity.Pedido);
            entity.Estado = "Pedido";

            await _context.SaveChangesAsync();

            var loaded = await CargarRequisicionCompletaAsync(reqId);
            if (loaded != null)
                requisicionesActualizadas.Add(MapRequisicion(loaded));
        }

        ActualizarFechaEntregaOrdenCompra(ordenCompra);
        await _context.SaveChangesAsync();

        var ocCompleta = await CargarOrdenCompraCompletaAsync(ordenCompra.Id)
            ?? ordenCompra;

        return new AlmacenConsolidarPedidoResultDto
        {
            OrdenCompra = MapOrdenCompra(ocCompleta),
            Requisiciones = requisicionesActualizadas,
        };
    }

    public void NormalizarFechaEntregaPedido(AlmacenPedido pedido)
    {
        var fechas = pedido.Proveedores
            .Select(p => p.FechaEntregaEstimada)
            .Where(f => f.HasValue)
            .Select(f => f!.Value)
            .ToList();
        pedido.FechaEntregaEstimada = fechas.Count > 0 ? fechas.Max() : pedido.FechaEntregaEstimada;
    }

    /// <summary>
    /// Crea o actualiza el catálogo de proveedores con los datos ingresados al guardar un pedido.
    /// </summary>
    public async Task<AlmacenProveedor?> UpsertProveedorCatalogoDesdePedidoAsync(
        string nombre,
        string? nit,
        string? telefono,
        int? catalogoIdHint,
        string? categoria = null,
        bool? responsableIva = null)
    {
        var nombreTrim = nombre.Trim();
        if (string.IsNullOrWhiteSpace(nombreTrim)) return null;

        AlmacenProveedor? entity = null;

        if (catalogoIdHint is > 0)
        {
            entity = await _context.AlmacenProveedores
                .FirstOrDefaultAsync(p => p.Id == catalogoIdHint.Value && p.Activo);
        }

        if (entity == null)
        {
            var clave = AlmacenCatalog.NormalizarTextoClave(nombreTrim);
            var activos = await _context.AlmacenProveedores.Where(p => p.Activo).ToListAsync();
            entity = activos.FirstOrDefault(p => AlmacenCatalog.NormalizarTextoClave(p.Nombre) == clave);
        }

        if (entity == null)
        {
            entity = new AlmacenProveedor { Activo = true };
            _context.AlmacenProveedores.Add(entity);
        }

        AplicarDatosContactoProveedorCatalogo(entity, nombreTrim, nit, telefono, categoria, responsableIva);
        return entity;
    }

    private static void AplicarDatosContactoProveedorCatalogo(
        AlmacenProveedor entity,
        string nombre,
        string? nit,
        string? telefono,
        string? categoria = null,
        bool? responsableIva = null)
    {
        entity.Nombre = nombre;
        entity.Nit = nit?.Trim() ?? "";
        if (!string.IsNullOrWhiteSpace(telefono))
            entity.TelefonoMovil = telefono.Trim();
        entity.Telefono = !string.IsNullOrWhiteSpace(entity.TelefonoMovil)
            ? entity.TelefonoMovil.Trim()
            : (entity.TelefonoTrabajo?.Trim() ?? "");
        if (categoria != null)
            entity.Categoria = string.IsNullOrWhiteSpace(categoria) ? null : categoria.Trim();
        if (responsableIva.HasValue)
            entity.ResponsableIva = responsableIva.Value;
    }

    public void EliminarProveedorDelPedido(AlmacenRequisicion req, AlmacenPedidoProveedor prov)
    {
        if (prov.Id == 0) return;

        var lineas = req.RecepcionLineas.Where(l => l.PedidoProveedorId == prov.Id).ToList();
        if (lineas.Count > 0)
        {
            _context.AlmacenRecepcionLineas.RemoveRange(lineas);
            foreach (var linea in lineas)
                req.RecepcionLineas.Remove(linea);
        }

        req.Pedido!.Proveedores.Remove(prov);
        _context.AlmacenPedidoProveedores.Remove(prov);
    }

    /// <summary>
    /// Quita el pedido de una requisición y la deja en Pendiente (sin borrar la requisición).
    /// </summary>
    public async Task<bool> RevertirPedidoRequisicionAsync(int id)
    {
        var entity = await CargarRequisicionCompletaAsync(id);
        if (entity == null) return false;

        if (entity.RecepcionLineas.Count > 0)
            throw new InvalidOperationException("No se puede revertir: la requisición ya tiene recepciones.");

        if (entity.Pedido != null)
        {
            var proveedorIds = entity.Pedido.Proveedores.Select(p => p.Id).ToList();
            if (proveedorIds.Count > 0)
            {
                var lineasOc = await _context.AlmacenOrdenCompraLineas
                    .Where(l => proveedorIds.Contains(l.PedidoProveedorId))
                    .ToListAsync();
                var ordenCompraIds = lineasOc.Select(l => l.OrdenCompraId).Distinct().ToList();
                var removidasPorOc = lineasOc
                    .GroupBy(l => l.OrdenCompraId)
                    .ToDictionary(g => g.Key, g => g.Count());
                if (lineasOc.Count > 0)
                    _context.AlmacenOrdenCompraLineas.RemoveRange(lineasOc);

                _context.AlmacenPedidoProveedores.RemoveRange(entity.Pedido.Proveedores);

                foreach (var ocId in ordenCompraIds)
                {
                    var totalEnOc = await _context.AlmacenOrdenCompraLineas.CountAsync(l => l.OrdenCompraId == ocId);
                    var removidas = removidasPorOc.GetValueOrDefault(ocId, 0);
                    if (totalEnOc > removidas) continue;
                    var oc = await _context.AlmacenOrdenesCompra.FindAsync(ocId);
                    if (oc != null) _context.AlmacenOrdenesCompra.Remove(oc);
                }
            }
            else
            {
                _context.AlmacenPedidoProveedores.RemoveRange(entity.Pedido.Proveedores);
            }

            _context.AlmacenPedidos.Remove(entity.Pedido);
        }

        entity.Estado = "Pendiente";
        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Elimina una requisición con pedido, proveedores asignados y recepciones (pruebas).
    /// </summary>
    public async Task<bool> EliminarRequisicionCompletaAsync(int id)
    {
        var entity = await CargarRequisicionCompletaAsync(id);
        if (entity == null) return false;

        if (entity.RecepcionLineas.Count > 0)
            _context.AlmacenRecepcionLineas.RemoveRange(entity.RecepcionLineas);

        if (entity.Pedido != null)
        {
            var proveedorIds = entity.Pedido.Proveedores.Select(p => p.Id).ToList();
            if (proveedorIds.Count > 0)
            {
                var lineasOc = await _context.AlmacenOrdenCompraLineas
                    .Where(l => proveedorIds.Contains(l.PedidoProveedorId))
                    .ToListAsync();
                var ordenCompraIds = lineasOc.Select(l => l.OrdenCompraId).Distinct().ToList();
                var removidasPorOc = lineasOc
                    .GroupBy(l => l.OrdenCompraId)
                    .ToDictionary(g => g.Key, g => g.Count());
                if (lineasOc.Count > 0)
                    _context.AlmacenOrdenCompraLineas.RemoveRange(lineasOc);

                _context.AlmacenPedidoProveedores.RemoveRange(entity.Pedido.Proveedores);

                foreach (var ocId in ordenCompraIds)
                {
                    var totalEnOc = await _context.AlmacenOrdenCompraLineas.CountAsync(l => l.OrdenCompraId == ocId);
                    var removidas = removidasPorOc.GetValueOrDefault(ocId, 0);
                    if (totalEnOc > removidas) continue;
                    var oc = await _context.AlmacenOrdenesCompra.FindAsync(ocId);
                    if (oc != null) _context.AlmacenOrdenesCompra.Remove(oc);
                }
            }
            else
            {
                _context.AlmacenPedidoProveedores.RemoveRange(entity.Pedido.Proveedores);
            }

            _context.AlmacenPedidos.Remove(entity.Pedido);
        }

        _context.AlmacenRequisiciones.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Elimina todo el catálogo de proveedores y reinicia IDs. Los pedidos conservan nombre/NIT en snapshot.
    /// </summary>
    public async Task<int> VaciarCatalogoProveedoresAsync()
    {
        await _context.Database.ExecuteSqlRawAsync("""
            UPDATE "Almacen_PedidoProveedores" SET "ProveedorCatalogoId" = NULL
            WHERE "ProveedorCatalogoId" IS NOT NULL;
            """);

        return await _context.Database.ExecuteSqlRawAsync("""
            TRUNCATE TABLE "Almacen_Proveedores" RESTART IDENTITY;
            """);
    }

    /// <summary>
    /// Vacía tablas operativas de almacén y reinicia IDs (solo entorno de pruebas).
    /// </summary>
    public async Task ResetDatosPruebasAsync()
    {
        await _context.Database.ExecuteSqlRawAsync("""
            TRUNCATE TABLE
                "Almacen_RecepcionLineas",
                "Almacen_OrdenCompraLineas",
                "Almacen_PedidoProveedores",
                "Almacen_Pedidos",
                "Almacen_OrdenesCompra",
                "Almacen_Requisiciones"
            RESTART IDENTITY CASCADE;
            """);
    }
}
