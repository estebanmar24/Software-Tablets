using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;

namespace TiempoProcesos.API.Services;

/// <summary>
/// Envía recordatorios de requisiciones sin pedido cuando faltan 2 días para la fecha requerida.
/// </summary>
public class AlmacenRequisicionReminderHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private static DateTime? _ultimaEjecucionDia;

    public AlmacenRequisicionReminderHostedService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Pequeña espera al arrancar para no competir con migraciones/seed.
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (DebeEjecutarRecordatoriosHoy())
                    await ProcesarRecordatoriosAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlmacenReminder] Error: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private static bool DebeEjecutarRecordatoriosHoy()
    {
        var ahora = ColombiaTime.Now;
        // Una vez al día, ~7:00 AM hora Colombia.
        if (ahora.Hour != 7) return false;
        if (_ultimaEjecucionDia == ahora.Date) return false;
        _ultimaEjecucionDia = ahora.Date;
        return true;
    }

    private async Task ProcesarRecordatoriosAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<AlmacenService>();
        var email = scope.ServiceProvider.GetRequiredService<AlmacenEmailService>();

        var hoy = ColombiaTime.Today;
        var fechaObjetivo = hoy.AddDays(2);

        var candidatas = await context.AlmacenRequisiciones
            .Include(r => r.Pedido)
            .Where(r =>
                r.Estado == "Pendiente" &&
                !r.RecordatorioPedidoEnviado &&
                r.FechaRequerida.Date == fechaObjetivo)
            .ToListAsync(ct);

        foreach (var req in candidatas)
        {
            if (req.Pedido != null) continue;

            var diasRestantes = AlmacenService.DiasHastaFechaRequerida(req.FechaRequerida, hoy);
            if (diasRestantes != 2) continue;

            var loaded = await service.CargarRequisicionCompletaAsync(req.Id);
            if (loaded == null || loaded.Pedido != null || loaded.Estado != "Pendiente") continue;

            var dto = service.MapRequisicion(loaded);
            try
            {
                await email.NotificarRecordatorioPedidoPendienteAsync(dto, diasRestantes);
                req.RecordatorioPedidoEnviado = true;
                await context.SaveChangesAsync(ct);
                Console.WriteLine($"[AlmacenReminder] Recordatorio enviado — {req.Codigo}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlmacenReminder] Fallo {req.Codigo}: {ex.Message}");
            }
        }
    }
}
