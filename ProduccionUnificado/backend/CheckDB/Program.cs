using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using Microsoft.Extensions.DependencyInjection;
using System.Threading.Tasks;

namespace CheckDB
{
    class Program
    {
        static async Task Main()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql("Host=localhost;Database=TiemposProcesos;Username=postgres;Password=@L3ph2026")
                .Options;

            using var context = new AppDbContext(options);
            
            Console.WriteLine("Connecting and inserting migration history...");
            var query = "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ('20260312162957_AddHorarioIdToTalleresPersonal', '9.0.0') ON CONFLICT DO NOTHING;";
            await context.Database.ExecuteSqlRawAsync(query);
            Console.WriteLine("Insert successful.");
        }
    }
}
