using System.Threading.Tasks;
using System;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using System.Linq;
using System.IO;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace TiempoProcesos.API.Services;

public class AlephEmailService
{
    private readonly IConfiguration _config;

    public AlephEmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendEmailAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var message = new MimeMessage();
        var smtpServer = _config["EmailSettings:SmtpServer"];
        var smtpPort = int.Parse(_config["EmailSettings:SmtpPort"] ?? "587");
        var senderEmail = _config["EmailSettings:SenderEmail"];
        var senderName = _config["EmailSettings:SenderName"];
        var username = _config["EmailSettings:Username"];
        var password = _config["EmailSettings:Password"];

        message.From.Add(new MailboxAddress(senderName, senderEmail));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        try
        {
            await client.ConnectAsync(smtpServer, smtpPort, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(username, password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            try 
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log_emails.txt");
                File.AppendAllText(logPath, $"[{DateTime.Now}] ÉXITO (Directo): Correo enviado a {toEmail}.\n");
            } catch {}
        }
        catch (Exception ex)
        {
            try 
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log_emails.txt");
                File.AppendAllText(logPath, $"[{DateTime.Now}] ERROR enviando a {toEmail}: {ex.Message}\n");
            } catch {}
        }
    }

    public string BuildPlanAccionBody(string area, string hallazgo, string accionCorrectiva, string responsable, string fechaCompromiso, string proceso)
    {
        string primaryColor = "#1a365d";
        string accentColor = "#3182ce";
        
        return $@"
        <div style='background-color: #f7fafc; padding: 40px 20px; font-family: ""Segoe UI"", Tahoma, Geneva, Verdana, sans-serif;'>
            <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-top: 6px solid {primaryColor};'>
                <div style='padding: 30px; text-align: center; background-color: #ffffff;'>
                    <h1 style='color: {primaryColor}; margin: 0; font-size: 24px;'>SISTEMA ALEPH</h1>
                    <p style='color: #718096; margin-top: 5px; font-weight: 600; font-size: 12px;'>Gestión de Mejora Continua</p>
                </div>
                <div style='padding: 0 40px 30px 40px;'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <div style='display: inline-block; padding: 10px 20px; background-color: #ebf8ff; border-radius: 50px; color: {accentColor}; font-weight: bold; font-size: 14px;'>
                            Nuevo Plan de Acción Asignado
                        </div>
                    </div>
                    <p style='color: #4a5568; line-height: 1.6;'>
                        Se ha registrado un nuevo plan de acción para el área de <strong>{area}</strong>:
                    </p>
                    <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;'>
                        <table style='width: 100%; border-collapse: collapse;'>
                            <tr><td style='padding: 5px 0; color: #718096; font-size: 13px;'>PROCESO:</td><td style='font-weight: 600;'>{proceso}</td></tr>
                            <tr><td style='padding: 5px 0; color: #718096; font-size: 13px;'>RESPONSABLE:</td><td style='font-weight: 600;'>{responsable}</td></tr>
                            <tr><td style='padding: 5px 0; color: #718096; font-size: 13px;'>COMPROMISO:</td><td style='color: #e53e3e; font-weight: 700;'>{fechaCompromiso}</td></tr>
                        </table>
                    </div>
                    <div style='margin-bottom: 25px;'><h4 style='color: {primaryColor}; margin-bottom: 5px;'>Hallazgo:</h4><div style='font-style: italic;'>""{hallazgo}""</div></div>
                    <div style='margin-bottom: 35px;'><h4 style='color: {primaryColor}; margin-bottom: 5px;'>Acción:</h4><div>{accionCorrectiva}</div></div>
                    <div style='text-align: center;'><a href='https://perla.work' style='background-color: {accentColor}; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Abrir Perla</a></div>
                </div>
                <div style='background-color: #f1f5f9; padding: 20px; text-align: center;'>
                    <p style='color: #94a3b8; font-size: 12px; margin: 0;'>Mensaje automático Aleph. Por favor no responder.</p>
                </div>
            </div>
        </div>";
    }

    /// <summary>
    /// Cuerpo HTML para el correo de asignación de un item de checklist
    /// de auditoría (CT-PAT / ILS). El mensaje incluye título, descripción,
    /// tipo de auditoría y un enlace al sistema.
    /// </summary>
    public string BuildAuditAssignmentBody(string tipoAuditoria, string titulo, string descripcion, string asignadoPor, int anio, int mes)
    {
        string primaryColor = "#1a365d";
        string accentColor = tipoAuditoria.ToUpperInvariant() == "ILS" ? "#805ad5" : "#3182ce";
        string tipoLabel = tipoAuditoria.ToUpperInvariant() == "ILS" ? "ILS" : "CT-PAT";
        string mesNombre = new System.Globalization.CultureInfo("es-CO").DateTimeFormat.GetMonthName(mes);
        mesNombre = char.ToUpper(mesNombre[0]) + mesNombre.Substring(1);
        string descripcionHtml = string.IsNullOrWhiteSpace(descripcion)
            ? "<em style='color:#a0aec0'>(sin descripción)</em>"
            : System.Net.WebUtility.HtmlEncode(descripcion).Replace("\n", "<br/>");

        return $@"
        <div style='background-color:#f7fafc;padding:40px 20px;font-family:""Segoe UI"",Tahoma,Geneva,Verdana,sans-serif;'>
            <div style='max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);border-top:6px solid {primaryColor};'>
                <div style='padding:30px;text-align:center;'>
                    <h1 style='color:{primaryColor};margin:0;font-size:24px;'>SISTEMA ALEPH</h1>
                    <p style='color:#718096;margin-top:5px;font-weight:600;font-size:12px;'>Auditoría {tipoLabel}</p>
                </div>
                <div style='padding:0 40px 30px 40px;'>
                    <div style='text-align:center;margin-bottom:30px;'>
                        <div style='display:inline-block;padding:10px 20px;background-color:{accentColor}22;border-radius:50px;color:{accentColor};font-weight:bold;font-size:14px;'>
                            Nueva tarea asignada · {tipoLabel}
                        </div>
                    </div>
                    <p style='color:#4a5568;line-height:1.6;'>
                        Se te ha asignado una nueva tarea del check list <strong>{tipoLabel}</strong> para el período
                        <strong>{mesNombre} {anio}</strong>:
                    </p>
                    <div style='background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:25px 0;'>
                        <h3 style='margin:0 0 8px 0;color:{primaryColor};font-size:16px;'>{System.Net.WebUtility.HtmlEncode(titulo)}</h3>
                        <div style='color:#4a5568;font-size:13px;line-height:1.6;'>{descripcionHtml}</div>
                    </div>
                    <table style='width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;'>
                        <tr><td style='padding:5px 0;color:#718096;'>Asignado por:</td><td style='font-weight:600;'>{System.Net.WebUtility.HtmlEncode(asignadoPor)}</td></tr>
                        <tr><td style='padding:5px 0;color:#718096;'>Tipo:</td><td style='font-weight:600;'>Auditoría {tipoLabel}</td></tr>
                        <tr><td style='padding:5px 0;color:#718096;'>Período:</td><td style='font-weight:600;'>{mesNombre} {anio}</td></tr>
                    </table>
                    <div style='text-align:center;'>
                        <a href='https://perla.work' style='background-color:{accentColor};color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;'>Abrir en Perla</a>
                    </div>
                </div>
                <div style='background-color:#f1f5f9;padding:20px;text-align:center;'>
                    <p style='color:#94a3b8;font-size:12px;margin:0;'>Mensaje automático Aleph. Por favor no responder.</p>
                </div>
            </div>
        </div>";
    }

    /// <summary>
    /// Notifica por correo a un único destinatario que se le asignó un item de
    /// auditoría. Si <paramref name="email"/> es vacío o nulo, no envía nada.
    /// </summary>
    public async Task NotifyAuditAssignmentAsync(string email, string nombre, string tipoAuditoria, string titulo, string descripcion, string asignadoPor, int anio, int mes)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        string tipoLabel = tipoAuditoria.ToUpperInvariant() == "ILS" ? "ILS" : "CT-PAT";
        string subject = $"[Auditoría {tipoLabel}] Nueva tarea asignada: {titulo}";
        string body = BuildAuditAssignmentBody(tipoAuditoria, titulo, descripcion ?? string.Empty, asignadoPor ?? "Administrador", anio, mes);
        await SendEmailAsync(email, nombre ?? string.Empty, subject, body);
    }

    public async Task SendAreaNotificationAsync(AppDbContext context, string area, string hallazgo, string accionCorrectiva, string responsable, string fechaCompromiso, string proceso)
    {
        var destinatarios = await context.AdminUsuarios
            .Where(u => u.Area != null && u.Area.ToLower() == area.ToLower() && !string.IsNullOrEmpty(u.Email))
            .ToListAsync();

        if (!destinatarios.Any()) return;

        string subject = $"[Notificación Aleph] Plan de Acción Asignado: {proceso}";
        string body = BuildPlanAccionBody(area, hallazgo, accionCorrectiva, responsable, fechaCompromiso, proceso);

        foreach (var user in destinatarios)
        {
            await SendEmailAsync(user.Email, user.NombreMostrar, subject, body);
        }
    }
}
