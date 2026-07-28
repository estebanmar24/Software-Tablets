using System.Globalization;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Services;

public class GastoAutorizacionEmailService
{
    private readonly AlephEmailService _email;
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public GastoAutorizacionEmailService(AlephEmailService email, IConfiguration config, AppDbContext db)
    {
        _email = email;
        _config = config;
        _db = db;
    }

    private string DestinoNombre =>
        _config["GastoAutorizacionNotificaciones:NombreDestino"] ?? "Alertas Compras";

    private IReadOnlyList<string> Destinatarios
    {
        get
        {
            var lista = _config.GetSection("GastoAutorizacionNotificaciones:CorreosDestino").Get<string[]>()?
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(e => e.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>();

            var legacy = _config["GastoAutorizacionNotificaciones:CorreoDestino"]?.Trim();
            if (!string.IsNullOrWhiteSpace(legacy) &&
                !lista.Any(e => string.Equals(e, legacy, StringComparison.OrdinalIgnoreCase)))
            {
                lista.Add(legacy);
            }

            if (lista.Count == 0)
                lista.Add("alertascompras2@gmail.com");

            return lista;
        }
    }

    public async Task NotificarSolicitudAsync(GastoAutorizacionSolicitud s, string evento)
    {
        if (GastoAutorizacionHelper.EsRubroSinAutorizacion(s.RubroNombre))
            return;

        var estado = s.EstadoAutorizacion;
        var accion = estado switch
        {
            GastoAutorizacionHelper.EstadoAutorizada =>
                "Autorizada — el solicitante puede registrar el gasto completo en el sistema.",
            GastoAutorizacionHelper.EstadoNoAutorizada =>
                "No autorizada — el gasto no debe registrarse.",
            _ => "Pendiente de autorización — requiere revisión de Nohora Ortiz.",
        };

        var subject = evento switch
        {
            "creada" => $"[Gastos] Nueva solicitud PENDIENTE — {GastoAutorizacionHelper.EtiquetaModulo(s.Modulo)}",
            "actualizada" => $"[Gastos] Solicitud actualizada — {GastoAutorizacionHelper.EtiquetaModulo(s.Modulo)}",
            "autorizada" => $"[Gastos] Solicitud AUTORIZADA — {GastoAutorizacionHelper.EtiquetaModulo(s.Modulo)}",
            "rechazada" => $"[Gastos] Solicitud NO AUTORIZADA — {GastoAutorizacionHelper.EtiquetaModulo(s.Modulo)}",
            _ => $"[Gastos] Solicitud de pago — {GastoAutorizacionHelper.EtiquetaModulo(s.Modulo)}",
        };

        var html = BuildBody(s, evento, accion);
        var notificarSolicitante = evento is "autorizada" or "rechazada";
        var correos = notificarSolicitante
            ? await ResolveSolicitanteCorreosAsync(s)
            : Destinatarios;

        if (correos.Count == 0)
            return;

        var nombreDestino = notificarSolicitante
            ? (string.IsNullOrWhiteSpace(s.SolicitadoPorNombre) ? "Solicitante" : s.SolicitadoPorNombre.Trim())
            : DestinoNombre;

        await EnviarAsync(correos, nombreDestino, subject, html);
    }

    private async Task<IReadOnlyList<string>> ResolveSolicitanteCorreosAsync(GastoAutorizacionSolicitud s)
    {
        if (s.SolicitadoPorId.HasValue)
        {
            var email = await _db.AdminUsuarios.AsNoTracking()
                .Where(u => u.Id == s.SolicitadoPorId.Value)
                .Select(u => u.Email)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(email))
                return new List<string> { email.Trim() };
        }

        return Array.Empty<string>();
    }

    private async Task EnviarAsync(IReadOnlyList<string> correos, string nombreDestino, string subject, string htmlBody)
    {
        foreach (var correo in correos)
        {
            await _email.SendEmailAsync(correo, nombreDestino, subject, htmlBody);
        }
    }

    private static string H(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "—" : WebUtility.HtmlEncode(value);

    private static string FormatoMoneda(decimal valor) =>
        valor.ToString("C0", new CultureInfo("es-CO"));

    private static string FormatoFecha(DateTime d) =>
        d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static string MedioPago(GastoAutorizacionSolicitud s) =>
        s.EsSolicitudCredito ? "Crédito" : s.EsEfectivo ? "Efectivo" : "—";

    private static string BuildBody(GastoAutorizacionSolicitud s, string evento, string accionRequerida)
    {
        var estadoColor = s.EstadoAutorizacion switch
        {
            GastoAutorizacionHelper.EstadoAutorizada => "#059669",
            GastoAutorizacionHelper.EstadoNoAutorizada => "#DC2626",
            _ => "#D97706",
        };

        var motivoRechazo = s.EstadoAutorizacion == GastoAutorizacionHelper.EstadoNoAutorizada
            ? $@"<tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Motivo rechazo</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.MotivoRechazo)}</td></tr>"
            : "";

        var resolucion = s.FechaResolucion.HasValue
            ? $@"<tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Fecha resolución</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{FormatoFecha(s.FechaResolucion.Value)}</td></tr>
<tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Resuelto por</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.AutorizadoPorNombre)}</td></tr>"
            : "";

        return $@"
<div style=""font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;"">
  <div style=""background:#2563EB;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;"">
    <h2 style=""margin:0;font-size:18px;"">Solicitud de autorización de gasto</h2>
    <p style=""margin:6px 0 0;opacity:.9;font-size:13px;"">Evento: {H(evento)} · Módulo {H(GastoAutorizacionHelper.EtiquetaModulo(s.Modulo))}</p>
  </div>
  <div style=""border:1px solid #E5E7EB;border-top:none;padding:16px 20px;background:#fff;"">
    <p style=""margin:0 0 12px;padding:10px 12px;background:{estadoColor}15;border-left:4px solid {estadoColor};"">
      <strong>Estado:</strong> {H(s.EstadoAutorizacion)}<br/>
      <span style=""font-size:13px;"">{H(accionRequerida)}</span>
    </p>
    <table style=""width:100%;border-collapse:collapse;font-size:14px;"">
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;width:38%;"">ID solicitud</td><td style=""padding:8px;border:1px solid #E5E7EB;"">#{s.Id}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Rubro</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.RubroNombre)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Proveedor</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.ProveedorNombre)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Fecha aproximada</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{FormatoFecha(s.FechaAproximada)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Monto</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{FormatoMoneda(s.Cantidad)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Forma de pago</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{MedioPago(s)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Razón</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.Razon)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Solicitó</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{H(s.SolicitadoPorNombre)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Fecha solicitud</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{FormatoFecha(s.FechaSolicitud)}</td></tr>
      <tr><td style=""padding:8px;border:1px solid #E5E7EB;font-weight:600;"">Período</td><td style=""padding:8px;border:1px solid #E5E7EB;"">{s.Mes}/{s.Anio}</td></tr>
      {resolucion}
      {motivoRechazo}
    </table>
    <p style=""margin:16px 0 0;font-size:12px;color:#6B7280;"">Correo automático de Notificaciones Aleph. No incluye horas extras ni recargos.</p>
  </div>
</div>";
    }
}
