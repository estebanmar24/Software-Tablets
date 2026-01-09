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
    public DbSet<CalificacionMensual> CalificacionesMensuales { get; set; }
    public DbSet<RendimientoOperarioMensual> RendimientoOperariosMensual { get; set; }
    public DbSet<EncuestaCalidad> EncuestasCalidad { get; set; }
    public DbSet<EncuestaNovedad> EncuestaNovedades { get; set; }
    public DbSet<AdminUsuario> AdminUsuarios { get; set; }
    public DbSet<Equipo> Equipos { get; set; }
    public DbSet<HistorialMantenimiento> HistorialMantenimientos { get; set; }

    // SST Budget and Expense Management
    public DbSet<SST_Rubro> SST_Rubros { get; set; }
    public DbSet<SST_TipoServicio> SST_TiposServicio { get; set; }
    public DbSet<SST_Proveedor> SST_Proveedores { get; set; }
    public DbSet<SST_PresupuestoMensual> SST_PresupuestosMensuales { get; set; }
    public DbSet<SST_GastoMensual> SST_GastosMensuales { get; set; }

    // GH (Gestión Humana) Management
    public DbSet<GH_Rubro> GH_Rubros { get; set; }
    public DbSet<GH_TipoServicio> GH_TiposServicio { get; set; }
    public DbSet<GH_Proveedor> GH_Proveedores { get; set; }
    public DbSet<GH_Cotizacion> GH_Cotizaciones { get; set; }
    public DbSet<SST_Cotizacion> SST_Cotizaciones { get; set; }
    public DbSet<GH_GastoMensual> GH_GastosMensuales { get; set; }
    public DbSet<GH_PresupuestoMensual> GH_PresupuestosMensuales { get; set; }

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
        modelBuilder.Entity<CalificacionMensual>().ToTable("CalificacionesMensuales");
        modelBuilder.Entity<RendimientoOperarioMensual>().ToTable("RendimientoOperariosMensual");
        modelBuilder.Entity<EncuestaCalidad>().ToTable("EncuestasCalidad");
        modelBuilder.Entity<EncuestaNovedad>().ToTable("EncuestaNovedades");
        modelBuilder.Entity<AdminUsuario>().ToTable("AdminUsuarios");

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

        // Configurar relaciones para EncuestaCalidad
        modelBuilder.Entity<EncuestaCalidad>()
            .HasOne(e => e.Operario)
            .WithMany()
            .HasForeignKey(e => e.OperarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EncuestaCalidad>()
            .HasOne(e => e.Auxiliar)
            .WithMany()
            .HasForeignKey(e => e.AuxiliarId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EncuestaCalidad>()
            .HasOne(e => e.Maquina)
            .WithMany()
            .HasForeignKey(e => e.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EncuestaCalidad>()
            .HasMany(e => e.Novedades)
            .WithOne(n => n.Encuesta)
            .HasForeignKey(n => n.EncuestaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configurar Equipos y HistorialMantenimientos
        modelBuilder.Entity<Equipo>().ToTable("Equipos");
        modelBuilder.Entity<HistorialMantenimiento>().ToTable("HistorialMantenimientos");

        modelBuilder.Entity<HistorialMantenimiento>()
            .HasOne(h => h.Equipo)
            .WithMany(e => e.Mantenimientos)
            .HasForeignKey(h => h.EquipoId)
            .OnDelete(DeleteBehavior.Cascade);

        // SST Tables Configuration
        modelBuilder.Entity<SST_Rubro>().ToTable("SST_Rubros");
        modelBuilder.Entity<SST_TipoServicio>().ToTable("SST_TiposServicio");
        modelBuilder.Entity<SST_Proveedor>().ToTable("SST_Proveedores");
        modelBuilder.Entity<SST_PresupuestoMensual>().ToTable("SST_PresupuestosMensuales");
        modelBuilder.Entity<SST_GastoMensual>().ToTable("SST_GastosMensuales");

        // SST Relationships
        modelBuilder.Entity<SST_TipoServicio>()
            .HasOne(t => t.Rubro)
            .WithMany(r => r.TiposServicio)
            .HasForeignKey(t => t.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SST_Proveedor>()
            .HasOne(p => p.TipoServicio)
            .WithMany(t => t.Proveedores)
            .HasForeignKey(p => p.TipoServicioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SST_PresupuestoMensual>()
            .HasOne(p => p.TipoServicio)
            .WithMany(t => t.PresupuestosMensuales)
            .HasForeignKey(p => p.TipoServicioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: One budget per TipoServicio per month/year
        modelBuilder.Entity<SST_PresupuestoMensual>()
            .HasIndex(p => new { p.TipoServicioId, p.Anio, p.Mes })
            .IsUnique();

        modelBuilder.Entity<SST_GastoMensual>()
            .HasOne(g => g.Rubro)
            .WithMany()
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SST_GastoMensual>()
            .HasOne(g => g.TipoServicio)
            .WithMany()
            .HasForeignKey(g => g.TipoServicioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SST_GastoMensual>()
            .HasOne(g => g.Proveedor)
            .WithMany()
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        // GH Tables Configuration
        modelBuilder.Entity<GH_Rubro>().ToTable("GH_Rubros");
        modelBuilder.Entity<GH_TipoServicio>().ToTable("GH_TiposServicio");
        modelBuilder.Entity<GH_Proveedor>().ToTable("GH_Proveedores");
        modelBuilder.Entity<GH_Cotizacion>().ToTable("GH_Cotizaciones");
        modelBuilder.Entity<GH_GastoMensual>().ToTable("GH_GastosMensuales");
        modelBuilder.Entity<GH_PresupuestoMensual>().ToTable("GH_PresupuestosMensuales");

        // GH Relationships
        modelBuilder.Entity<GH_TipoServicio>()
            .HasOne(t => t.Rubro)
            .WithMany(r => r.TiposServicio)
            .HasForeignKey(t => t.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_Proveedor>()
            .HasOne(p => p.TipoServicio)
            .WithMany(t => t.Proveedores)
            .HasForeignKey(p => p.TipoServicioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_Cotizacion>()
            .HasOne(c => c.Proveedor)
            .WithMany(p => p.Cotizaciones)
            .HasForeignKey(c => c.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_GastoMensual>()
            .HasOne(g => g.Rubro)
            .WithMany()
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_GastoMensual>()
            .HasOne(g => g.TipoServicio)
            .WithMany()
            .HasForeignKey(g => g.TipoServicioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_GastoMensual>()
            .HasOne(g => g.Proveedor)
            .WithMany()
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GH_GastoMensual>()
            .HasOne(g => g.Cotizacion)
            .WithMany()
            .HasForeignKey(g => g.CotizacionId)
            .OnDelete(DeleteBehavior.SetNull);

        // NOTA: Los datos semilla se cargan directamente con init_db.sql
        // No usar HasData() para evitar conflictos con BD en la nube
    }
}
