using System.Threading.Tasks;
using System;
using System.Net.Mail;
using System.Net;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using System.Linq;

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
        try
        {
            var smtpServer = _config["EmailSettings:SmtpServer"];
            var smtpPort = int.Parse(_config["EmailSettings:SmtpPort"] ?? "587");
            var senderEmail = _config["EmailSettings:SenderEmail"];
            var senderName = _config["EmailSettings:SenderName"];
            var username = _config["EmailSettings:Username"];
            var password = _config["EmailSettings:Password"];

            using var client = new SmtpClient(smtpServer, smtpPort);
            client.EnableSsl = true;
            client.Credentials = new NetworkCredential(username, password);

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            mailMessage.To.Add(new MailAddress(toEmail, toName));

            await client.SendMailAsync(mailMessage);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error enviando correo a {toEmail}: {ex.Message}");
            // En producción podríamos guardar este error en una tabla de logs
        }
    }

    public async Task SendAreaNotificationAsync(AppDbContext context, string area, string hallazgo, string accionCorrectiva, string responsable, string fechaCompromiso, string proceso)
    {
        // 1. Buscar usuarios que pertenezcan al área especificada
        var destinatarios = await context.AdminUsuarios
            .Where(u => u.Area == area && !string.IsNullOrEmpty(u.Username) && u.Username.Contains("@"))
            .ToListAsync();

        if (!destinatarios.Any())
        {
            Console.WriteLine($"No se encontraron usuarios para el área: {area}");
            return;
        }

        string subject = $"[Plan de Acción] Nuevo Hallazgo en {proceso} - {area}";
        string htmlBody = $@"
            <div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>
                <h2 style='color: #d32f2f;'>Notificación de Plan de Acción</h2>
                <p>Se ha registrado un nuevo hallazgo que requiere su atención:</p>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Proceso:</td><td style='padding: 8px; border: 1px solid #ddd;'>{proceso}</td></tr>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Área:</td><td style='padding: 8px; border: 1px solid #ddd;'>{area}</td></tr>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Hallazgo:</td><td style='padding: 8px; border: 1px solid #ddd;'>{hallazgo}</td></tr>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Acción Correctiva:</td><td style='padding: 8px; border: 1px solid #ddd;'>{accionCorrectiva}</td></tr>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Responsable:</td><td style='padding: 8px; border: 1px solid #ddd;'>{responsable}</td></tr>
                    <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: bold;'>Fecha Compromiso:</td><td style='padding: 8px; border: 1px solid #ddd;'>{fechaCompromiso}</td></tr>
                </table>
                <p style='margin-top: 20px;'>Por favor, ingrese al sistema para hacer el seguimiento correspondiente.</p>
                <hr style='margin-top: 30px;'>
                <p style='font-size: 0.8em; color: #777;'>Este es un mensaje automático, por favor no responda.</p>
            </div>";

        foreach (var user in destinatarios)
        {
            await SendEmailAsync(user.Username, user.NombreMostrar, subject, htmlBody);
        }
    }
}
