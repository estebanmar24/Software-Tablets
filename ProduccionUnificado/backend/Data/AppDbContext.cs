using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Usuario> Usuarios { get; set; }
    public DbSet<Maquina> Maquinas { get; set; }
    public DbSet<Actividad> Actividades { get; set; }
    public DbSet<OrdenProduccion> OrdenesProduccion { get; set; }
    public DbSet<TiempoProceso> TiemposProceso { get; set; }
    public DbSet<ProduccionDiaria> ProduccionDiaria { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Mapeo explícito de tablas para coincidir con init_db.sql
        modelBuilder.Entity<Usuario>().ToTable("Usuarios");
        modelBuilder.Entity<Maquina>().ToTable("Maquinas");
        modelBuilder.Entity<Actividad>().ToTable("Actividades");
        modelBuilder.Entity<OrdenProduccion>().ToTable("OrdenesProduccion");
        modelBuilder.Entity<TiempoProceso>().ToTable("TiempoProcesos");
        modelBuilder.Entity<ProduccionDiaria>().ToTable("ProduccionDiaria");

        // Configurar relaciones para TiempoProceso
        modelBuilder.Entity<TiempoProceso>()
            .HasOne(t => t.Usuario)
            .WithMany()
            .HasForeignKey(t => t.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TiempoProceso>()
            .HasOne(t => t.Maquina)
            .WithMany()
            .HasForeignKey(t => t.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TiempoProceso>()
            .HasOne(t => t.Actividad)
            .WithMany()
            .HasForeignKey(t => t.ActividadId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TiempoProceso>()
            .HasOne(t => t.OrdenProduccion)
            .WithMany()
            .HasForeignKey(t => t.OrdenProduccionId)
            .OnDelete(DeleteBehavior.SetNull);

        // Configurar relaciones para ProduccionDiaria
        modelBuilder.Entity<ProduccionDiaria>()
            .HasOne(p => p.Usuario)
            .WithMany()
            .HasForeignKey(p => p.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProduccionDiaria>()
            .HasOne(p => p.Maquina)
            .WithMany()
            .HasForeignKey(p => p.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        // NOTA: Los datos semilla se cargan directamente con init_db.sql
        // No usar HasData() para evitar conflictos con BD en la nube
    }
}
