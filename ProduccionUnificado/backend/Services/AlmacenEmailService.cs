using System.Globalization;
using System.Linq;
using System.Net;
using Microsoft.Extensions.Configuration;
using TiempoProcesos.API.DTOs;

namespace TiempoProcesos.API.Services;

public class AlmacenRecepcionNotificacionDto
{
    public string NombreProveedor { get; set; } = string.Empty;
    public string CodigoRecepcion { get; set; } = string.Empty;
    public string FechaLlegada { get; set; } = string.Empty;
    public decimal CantidadRecibida { get; set; }
    public decimal CantidadPedida { get; set; }
    public decimal SaldoPendienteTras { get; set; }
    public bool PedidoCompleto { get; set; }
    public bool CalidadEsperada { get; set; }
    public string? MotivoCalidadNo { get; set; }
    public bool FacturaEntregada { get; set; }
    public string? MotivoFacturaNo { get; set; }
    public string? MotivoCantidadParcial { get; set; }
    public string? NuevaFechaEntrega { get; set; }
}

public class AlmacenEmailService
{
    private readonly AlephEmailService _email;
    private readonly IConfiguration _config;

    public AlmacenEmailService(AlephEmailService email, IConfiguration config)
    {
        _email = email;
        _config = config;
    }

    private string DestinoNombre =>
        _config["AlmacenNotificaciones:NombreDestino"] ?? "Almacén";

    public AlmacenNotificacionesDto ObtenerConfiguracion() =>
        new()
        {
            NombreDestino = DestinoNombre,
            CorreosDestino = ResolverDestinatarios().ToList(),
        };

    private IReadOnlyList<string> Destinatarios => ResolverDestinatarios();

    private IReadOnlyList<string> ResolverDestinatarios()
    {
        var lista = _config.GetSection("AlmacenNotificaciones:CorreosDestino").Get<string[]>()?
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? new List<string>();

        var legacy = _config["AlmacenNotificaciones:CorreoDestino"]?.Trim();
        if (!string.IsNullOrWhiteSpace(legacy) &&
            !lista.Any(e => string.Equals(e, legacy, StringComparison.OrdinalIgnoreCase)))
        {
            lista.Add(legacy);
        }

        if (lista.Count == 0)
            lista.Add("juanesteban24082005@gmail.com");

        return lista;
    }

    public Task NotificarNuevaRequisicionAsync(AlmacenRequisicionDto req)
    {
        var urgente = EsUrgenteDesdeDto(req);
        var subject = urgente
            ? $"[Almacén] URGENTE! Nueva requisición {req.Codigo} — pendiente de pedido"
            : $"[Almacén] Nueva requisición {req.Codigo} — pendiente de pedido";
        return EnviarAsync(subject, BuildNuevaRequisicionBody(req, urgente));
    }

    public Task NotificarRecordatorioPedidoPendienteAsync(AlmacenRequisicionDto req, int diasRestantes) =>
        EnviarAsync(
            $"[Almacén] Recordatorio — faltan {diasRestantes} días para pedir {req.Codigo}",
            BuildRecordatorioPedidoBody(req, diasRestantes));

    private static bool EsUrgenteDesdeDto(AlmacenRequisicionDto req)
    {
        if (!DateTime.TryParse(req.FechaSolicitud, out var sol)) return false;
        if (!DateTime.TryParse(req.FechaRequerida, out var reqF)) return false;
        return AlmacenService.EsRequisicionUrgente(sol, reqF);
    }

    public Task NotificarPedidoAsync(AlmacenRequisicionDto req) =>
        EnviarAsync(
            $"[Almacén] Pedido registrado — {req.Codigo}",
            BuildPedidoBody(req));

    public Task NotificarPedidoParcialRestanteAsync(AlmacenRequisicionDto req) =>
        EnviarAsync(
            $"[Almacén] Pedido PARCIAL — resto pendiente — {req.Codigo}",
            BuildPedidoParcialRestanteBody(req));

    public Task NotificarRecepcionAsync(AlmacenRequisicionDto req, AlmacenRecepcionNotificacionDto linea) =>
        EnviarAsync(
            linea.PedidoCompleto
                ? $"[Almacén] Ingreso COMPLETO — {req.Codigo} ({linea.NombreProveedor})"
                : $"[Almacén] Ingreso PARCIAL — {req.Codigo} ({linea.NombreProveedor})",
            BuildRecepcionBody(req, linea));

    private async Task EnviarAsync(string subject, string htmlBody)
    {
        foreach (var correo in Destinatarios)
        {
            await _email.SendEmailAsync(correo, DestinoNombre, subject, htmlBody);
        }
    }

    private static string H(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "—" : WebUtility.HtmlEncode(value);

    private static string HtmlComentariosRequisicion(AlmacenRequisicionDto req)
    {
        if (req.Comentarios.Count == 0)
            return H(req.Observacion);

        static string Render(AlmacenRequisicionComentarioDto c, int nivel)
        {
            var indent = nivel * 16;
            var meta = $"{H(c.UsuarioNombre)} · {H(c.Fecha)} {H(c.Hora)}";
            var hijos = string.Concat(c.Respuestas.Select(r => Render(r, nivel + 1)));
            return $@"
            <div style='margin:0 0 10px {indent}px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;'>
                <div style='font-size:12px;color:#64748b;margin-bottom:4px;'>{meta}</div>
                <div style='color:#334155;white-space:pre-wrap;'>{H(c.Texto)}</div>
                {hijos}
            </div>";
        }

        return string.Concat(req.Comentarios.Select(c => Render(c, 0)));
    }

    private static string LabelTipo(string id) =>
        AlmacenCatalog.TiposRequisicion.FirstOrDefault(t => t.Id == id)?.Label ?? id;

    private static string F(decimal n) =>
        n.ToString("N2", CultureInfo.GetCultureInfo("es-CO"));

    private static string Wrap(string titulo, string badge, string badgeColor, string contenido)
    {
        const string primary = "#1a365d";
        const string accent = "#3182ce";
        return $@"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='utf-8'/>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'/>
            <style>
                @media only screen and (max-width: 600px) {{
                    .email-outer {{ padding: 16px 8px !important; }}
                    .email-card {{ border-radius: 8px !important; }}
                    .email-body {{ padding: 0 16px 20px !important; }}
                    .email-header {{ padding: 20px 16px 8px !important; }}
                }}
            </style>
        </head>
        <body style='margin:0;padding:0;'>
        <div class='email-outer' style='background-color:#f7fafc;padding:40px 20px;font-family:""Segoe UI"",Tahoma,Geneva,Verdana,sans-serif;'>
            <div class='email-card' style='max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);border-top:6px solid {primary};'>
                <div class='email-header' style='padding:28px 32px 12px;text-align:center;'>
                    <h1 style='color:{primary};margin:0;font-size:22px;'>SISTEMA ALEPH — ALMACÉN</h1>
                    <p style='color:#718096;margin-top:6px;font-size:12px;font-weight:600;'>Notificación automática</p>
                </div>
                <div class='email-body' style='padding:0 32px 28px;'>
                    <div style='text-align:center;margin-bottom:24px;'>
                        <span style='display:inline-block;padding:10px 20px;background:{badgeColor}22;border-radius:50px;color:{badgeColor};font-weight:700;font-size:14px;'>{badge}</span>
                    </div>
                    <h2 style='color:{primary};margin:0 0 16px;font-size:18px;'>{WebUtility.HtmlEncode(titulo)}</h2>
                    {contenido}
                    <div style='text-align:center;margin-top:28px;'>
                        <a href='https://perla.work' style='background:{accent};color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;display:inline-block;'>Abrir Perla</a>
                    </div>
                </div>
                <div style='background:#f1f5f9;padding:16px;text-align:center;'>
                    <p style='color:#94a3b8;font-size:12px;margin:0;'>Mensaje automático. Por favor no responder.</p>
                </div>
            </div>
        </div>
        </body>
        </html>";
    }

    private static string TablaRequisicion(AlmacenRequisicionDto req)
    {
        return $@"
        <table style='width:100%;border-collapse:collapse;font-size:14px;'>
            <tr><td style='padding:6px 0;color:#718096;width:38%;'>Código</td><td style='font-weight:700;'>{H(req.Codigo)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Estado</td><td style='font-weight:600;'>{H(req.Estado)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Tipo</td><td>{H(LabelTipo(req.TipoRequisicion))}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Fecha solicitud</td><td>{H(req.FechaSolicitud)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Fecha requerida</td><td>{H(req.FechaRequerida)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Orden de producción</td><td>{H(req.OrdenProduccion)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Cliente</td><td>{H(req.Cliente)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Referencia</td><td>{H(req.Referencia)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Producto</td><td style='font-weight:600;'>{H(req.Producto)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Cantidad</td><td><strong>{F(req.Cantidad)}</strong> {H(req.Unidad)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;vertical-align:top;'>Observaciones</td><td>{HtmlComentariosRequisicion(req)}</td></tr>
        </table>";
    }

    private string BuildNuevaRequisicionBody(AlmacenRequisicionDto req, bool urgente)
    {
        var bannerUrgente = urgente
            ? @"
        <div style='background:#FEE2E2;border:2px solid #EF4444;border-radius:10px;padding:16px;margin-bottom:18px;text-align:center;'>
            <p style='margin:0;font-size:20px;font-weight:800;color:#B91C1C;letter-spacing:.5px;'>URGENTE!</p>
            <p style='margin:8px 0 0;color:#7F1D1D;font-size:14px;'>
                La fecha requerida es a <strong>1 o 2 días</strong> de la solicitud. Priorizar el pedido a proveedores.
            </p>
        </div>"
            : "";

        var contenido = $@"
        {bannerUrgente}
        <p style='color:#4a5568;line-height:1.6;'>
            Se registró una <strong>nueva requisición</strong> en el sistema. Queda <strong>a la espera de realizar el pedido</strong> a proveedores.
        </p>
        <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-top:16px;'>
            {TablaRequisicion(req)}
        </div>";
        var badge = urgente ? "URGENTE — Nueva requisición" : "Nueva requisición";
        var badgeColor = urgente ? "#DC2626" : "#3182ce";
        return Wrap($"Requisición {req.Codigo}", badge, badgeColor, contenido);
    }

    private string BuildRecordatorioPedidoBody(AlmacenRequisicionDto req, int diasRestantes)
    {
        var contenido = $@"
        <div style='background:#FEF3C7;border:2px solid #F59E0B;border-radius:10px;padding:16px;margin-bottom:18px;text-align:center;'>
            <p style='margin:0;font-size:18px;font-weight:800;color:#B45309;'>RECORDATORIO DE PEDIDO PENDIENTE</p>
            <p style='margin:8px 0 0;color:#92400E;font-size:14px;'>
                Faltan <strong>{diasRestantes} día(s)</strong> para la fecha requerida y <strong>aún no se ha registrado el pedido</strong>.
            </p>
        </div>
        <p style='color:#4a5568;line-height:1.6;'>
            La requisición <strong>{H(req.Codigo)}</strong> sigue en estado <strong>Pendiente</strong>.
            Por favor realice el pedido a proveedores antes de la fecha requerida.
        </p>
        <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-top:16px;'>
            {TablaRequisicion(req)}
        </div>";
        return Wrap($"Recordatorio — {req.Codigo}", "Pedido pendiente", "#D97706", contenido);
    }

    private string BuildPedidoBody(AlmacenRequisicionDto req)
    {
        var pedido = req.Pedido;
        var filasProveedores = "";
        if (pedido?.Proveedores?.Count > 0)
        {
            foreach (var p in pedido.Proveedores)
            {
                var total = (p.PrecioUnitario ?? pedido.PrecioUnitario ?? 0) * p.Cantidad;
                filasProveedores += $@"
                <tr>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{H(p.Nombre)}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;'>{H(p.NumeroOrdenCompra?.ToString())}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;'>{F(p.Cantidad)}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;'>{(p.PrecioUnitario.HasValue ? F(p.PrecioUnitario.Value) : "—")}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;'>{(total > 0 ? F(total) : "—")}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{H(p.FechaEntregaEstimada)}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{H(p.Nit)}</td>
                    <td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{H(p.Telefono)}</td>
                </tr>";
            }
        }

        var contenido = $@"
        <p style='color:#4a5568;line-height:1.6;'>
            Se registró el <strong>pedido</strong> para la requisición <strong>{H(req.Codigo)}</strong>.
        </p>
        <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:16px 0;'>
            {TablaRequisicion(req)}
        </div>
        <h3 style='color:#1a365d;margin:20px 0 10px;font-size:15px;'>Datos del pedido</h3>
        <table style='width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;'>
            <tr><td style='padding:4px 0;color:#718096;width:40%;'>Fecha del pedido</td><td>{H(pedido?.FechaPedido)}</td></tr>
            <tr><td style='padding:4px 0;color:#718096;'>Entrega estimada (resumen)</td><td>{H(pedido?.FechaEntregaEstimada)}</td></tr>
        </table>
        <h3 style='color:#1a365d;margin:16px 0 8px;font-size:15px;'>Proveedores asignados</h3>
        <div style='overflow-x:auto;'>
            <table style='width:100%;border-collapse:collapse;font-size:13px;'>
                <thead>
                    <tr style='background:#edf2f7;'>
                        <th style='padding:8px;text-align:left;'>Proveedor</th>
                        <th style='padding:8px;'>OC</th>
                        <th style='padding:8px;text-align:right;'>Cant.</th>
                        <th style='padding:8px;text-align:right;'>P. unit.</th>
                        <th style='padding:8px;text-align:right;'>Total</th>
                        <th style='padding:8px;'>Entrega</th>
                        <th style='padding:8px;'>NIT</th>
                        <th style='padding:8px;'>Teléfono</th>
                    </tr>
                </thead>
                <tbody>{filasProveedores}</tbody>
            </table>
        </div>";
        return Wrap($"Pedido — {req.Codigo}", "Pedido registrado", "#059669", contenido);
    }

    private static string TarjetaProveedorPendiente(
        string nombre,
        decimal pedidoOrig,
        decimal recibido,
        decimal pendiente,
        string? fechaEntrega,
        string? unidad)
    {
        var u = string.IsNullOrWhiteSpace(unidad) ? "" : $" {H(unidad)}";
        return $@"
        <div style='border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;background:#ffffff;'>
            <p style='margin:0 0 12px;font-size:16px;font-weight:700;color:#1a365d;'>{H(nombre)}</p>
            <table role='presentation' cellpadding='0' cellspacing='0' style='width:100%;border-collapse:collapse;font-size:14px;'>
                <tr>
                    <td style='padding:6px 0;color:#718096;width:50%;'>Pedido</td>
                    <td style='padding:6px 0;text-align:right;font-weight:600;'>{F(pedidoOrig)}{u}</td>
                </tr>
                <tr>
                    <td style='padding:6px 0;color:#718096;'>Recibido</td>
                    <td style='padding:6px 0;text-align:right;font-weight:600;color:#059669;'>{F(recibido)}{u}</td>
                </tr>
                <tr>
                    <td style='padding:6px 0;color:#718096;'>Pendiente</td>
                    <td style='padding:6px 0;text-align:right;font-weight:700;color:#c05621;'>{F(pendiente)}{u}</td>
                </tr>
                <tr>
                    <td style='padding:6px 0;color:#718096;'>Próx. llegada</td>
                    <td style='padding:6px 0;text-align:right;font-weight:600;'>{H(fechaEntrega)}</td>
                </tr>
            </table>
        </div>";
    }

    private string BuildPedidoParcialRestanteBody(AlmacenRequisicionDto req)
    {
        var tarjetasPendientes = "";
        foreach (var p in req.Pedido?.Proveedores ?? new List<AlmacenProveedorAsignadoDto>())
        {
            if (p.Recibido) continue;

            var lineasProv = (req.Recepcion?.Lineas ?? new List<AlmacenRecepcionLineaDto>())
                .Where(l => l.ProveedorId == p.Id)
                .ToList();
            var recibido = lineasProv.Sum(l => l.CantidadRecibida);
            // Solo proveedores con entrega parcial registrada (no los que aún no han llegado).
            if (recibido <= 0) continue;

            var pedidoTotal = p.Cantidad > 0 ? p.Cantidad : lineasProv
                .Where(l => l.CantidadPedidaEnMomento > 0)
                .Select(l => l.CantidadPedidaEnMomento)
                .DefaultIfEmpty(0)
                .Max();
            var pendiente = Math.Max(0, pedidoTotal - recibido);
            if (pendiente <= 0) continue;

            tarjetasPendientes += TarjetaProveedorPendiente(
                p.Nombre,
                pedidoTotal,
                recibido,
                pendiente,
                p.FechaEntregaEstimada,
                req.Unidad);
        }

        if (string.IsNullOrEmpty(tarjetasPendientes))
        {
            tarjetasPendientes =
                "<p style='color:#718096;font-size:14px;margin:0;'>No hay proveedores con entrega parcial pendiente de confirmar.</p>";
        }

        var contenido = $@"
        <div style='background:#fffaf0;border:2px solid #fbd38d;border-radius:10px;padding:18px;margin-bottom:20px;text-align:center;'>
            <p style='margin:0;font-size:18px;font-weight:800;color:#c05621;'>PEDIDO PARCIAL — RESTO PENDIENTE</p>
            <p style='margin:10px 0 0;color:#4a5568;font-size:14px;'>
                Se confirmó el resto pendiente del proveedor que tuvo una entrega parcial en la requisición <strong>{H(req.Codigo)}</strong>.
            </p>
        </div>
        <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:16px 0;'>
            {TablaRequisicion(req)}
        </div>
        <h3 style='color:#1a365d;margin:16px 0 8px;font-size:15px;'>Saldo pendiente confirmado</h3>
        {tarjetasPendientes}
        <p style='color:#4a5568;font-size:13px;margin-top:16px;'>
            Entrega estimada (resumen): <strong>{H(req.Pedido?.FechaEntregaEstimada)}</strong>
        </p>";
        return Wrap($"Pedido parcial — {req.Codigo}", "Resto pendiente confirmado", "#c05621", contenido);
    }

    private string BuildRecepcionBody(AlmacenRequisicionDto req, AlmacenRecepcionNotificacionDto linea)
    {
        var esCompleto = linea.PedidoCompleto;
        var bannerColor = esCompleto ? "#059669" : "#c05621";
        var bannerBg = esCompleto ? "#ecfdf5" : "#fffaf0";
        var bannerBorder = esCompleto ? "#6ee7b7" : "#fbd38d";
        var tituloEstado = esCompleto ? "LLEGADA COMPLETA" : "LLEGADA PARCIAL";
        var mensajeEstado = esCompleto
            ? "El proveedor cumplió con la cantidad pedida en esta recepción."
            : $"Queda saldo pendiente por recibir: <strong>{F(linea.SaldoPendienteTras)}</strong> unidades de este proveedor.";

        var calidadHtml = linea.CalidadEsperada
            ? "<span style='color:#059669;font-weight:700;'>✓ Calidad conforme a lo esperado</span>"
            : $"<span style='color:#c53030;font-weight:700;'>✗ Calidad NO conforme</span><br/><span style='color:#4a5568;'>Motivo: {H(linea.MotivoCalidadNo)}</span>";

        var facturaHtml = linea.FacturaEntregada
            ? "<span style='color:#059669;font-weight:700;'>✓ Factura entregada</span>"
            : $"<span style='color:#c53030;font-weight:700;'>✗ Sin factura</span><br/><span style='color:#4a5568;'>Motivo: {H(linea.MotivoFacturaNo)}</span>";

        var parcialExtra = "";
        if (!esCompleto)
        {
            parcialExtra = $@"
            <div style='background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:14px;margin-top:14px;'>
                <p style='margin:0 0 6px;color:#c53030;font-weight:700;'>Detalle de entrega parcial</p>
                <p style='margin:0;color:#4a5568;'><strong>Motivo:</strong> {H(linea.MotivoCantidadParcial)}</p>
                <p style='margin:8px 0 0;color:#4a5568;'><strong>Nueva fecha estimada para el resto:</strong> {H(linea.NuevaFechaEntrega)}</p>
            </div>";
        }

        var contenido = $@"
        <div style='background:{bannerBg};border:2px solid {bannerBorder};border-radius:10px;padding:18px;margin-bottom:20px;text-align:center;'>
            <p style='margin:0;font-size:20px;font-weight:800;color:{bannerColor};letter-spacing:.5px;'>{tituloEstado}</p>
            <p style='margin:10px 0 0;color:#4a5568;font-size:14px;'>{mensajeEstado}</p>
        </div>
        <p style='color:#4a5568;line-height:1.6;'>
            Se registró el <strong>ingreso de mercancía</strong> para la requisición <strong>{H(req.Codigo)}</strong>.
            Estado actual de la requisición: <strong>{H(req.Estado)}</strong>.
        </p>
        <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:16px 0;'>
            <h3 style='color:#1a365d;margin:0 0 12px;font-size:15px;'>Resumen de la requisición</h3>
            {TablaRequisicion(req)}
        </div>
        <h3 style='color:#1a365d;margin:16px 0 8px;font-size:15px;'>Condiciones de esta recepción</h3>
        <table style='width:100%;border-collapse:collapse;font-size:14px;'>
            <tr><td style='padding:6px 0;color:#718096;width:40%;'>Proveedor</td><td style='font-weight:700;'>{H(linea.NombreProveedor)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Código de recepción</td><td>{H(linea.CodigoRecepcion)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Fecha de llegada</td><td>{H(linea.FechaLlegada)}</td></tr>
            {(esCompleto
                ? $"<tr><td style='padding:6px 0;color:#718096;'>Cantidad pedida (proveedor)</td><td>{F(linea.CantidadPedida)} {H(req.Unidad)}</td></tr>"
                : $"<tr><td style='padding:6px 0;color:#718096;'>Entrega parcial</td><td style='font-weight:700;color:{bannerColor};'>{F(linea.CantidadRecibida)} / {F(linea.CantidadPedida)} {H(req.Unidad)}</td></tr>")}
            <tr><td style='padding:6px 0;color:#718096;'>Cantidad recibida (esta entrega)</td><td style='font-weight:700;font-size:16px;color:{bannerColor};'>{F(linea.CantidadRecibida)} {H(req.Unidad)}</td></tr>
            <tr><td style='padding:6px 0;color:#718096;'>Saldo pendiente tras esta entrega</td><td style='font-weight:600;color:{(linea.SaldoPendienteTras > 0 ? "#c05621" : "#059669")};'>{F(linea.SaldoPendienteTras)} {H(req.Unidad)}</td></tr>
        </table>
        <div style='margin-top:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;'>
            <p style='margin:0 0 10px;'>{calidadHtml}</p>
            <p style='margin:0;'>{facturaHtml}</p>
        </div>
        {parcialExtra}";
        return Wrap($"Ingreso — {req.Codigo}", esCompleto ? "Ingreso completo" : "Ingreso parcial", bannerColor, contenido);
    }
}
