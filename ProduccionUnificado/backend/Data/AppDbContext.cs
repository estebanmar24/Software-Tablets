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
    public DbSet<EquipoFoto> EquipoFotos { get; set; }
    public DbSet<HistorialMantenimiento> HistorialMantenimientos { get; set; }
    public DbSet<LicenciaEquipo> LicenciasEquipos { get; set; }

    // Desperdicio Management
    public DbSet<CodigoDesperdicio> CodigosDesperdicio { get; set; }
    public DbSet<RegistroDesperdicio> RegistrosDesperdicio { get; set; }

    // Horarios/Turnos
    public DbSet<Horario> Horarios { get; set; }

    // SST Budget and Expense Management
    public DbSet<SST_Rubro> SST_Rubros { get; set; }
    public DbSet<SST_TipoServicio> SST_TiposServicio { get; set; }
    public DbSet<SST_Proveedor> SST_Proveedores { get; set; }
    public DbSet<SST_PresupuestoMensual> SST_PresupuestosMensuales { get; set; }
    public DbSet<SST_GastoMensual> SST_GastosMensuales { get; set; }
    public DbSet<PlanAccion> PlanesAccion { get; set; }
    public DbSet<PlanAccionEvidencia> PlanAccionEvidencias { get; set; }

    // GH (Gestión Humana) Management
    public DbSet<GH_Rubro> GH_Rubros { get; set; }
    public DbSet<GH_TipoServicio> GH_TiposServicio { get; set; }
    public DbSet<GH_Proveedor> GH_Proveedores { get; set; }
    public DbSet<GH_Cotizacion> GH_Cotizaciones { get; set; }
    public DbSet<SST_Cotizacion> SST_Cotizaciones { get; set; }
    public DbSet<GH_GastoMensual> GH_GastosMensuales { get; set; }
    public DbSet<GH_PresupuestoMensual> GH_PresupuestosMensuales { get; set; }

    // Produccion (Control Gastos)
    public DbSet<Produccion_Rubro> Produccion_Rubros { get; set; }
    public DbSet<Produccion_Proveedor> Produccion_Proveedores { get; set; }
    public DbSet<Produccion_TipoHora> Produccion_TiposHora { get; set; }
    public DbSet<Produccion_Gasto> Produccion_Gastos { get; set; }
    // Talleres
    public DbSet<Talleres_Personal> Talleres_Personal { get; set; }
    public DbSet<Produccion_Cotizacion> Produccion_Cotizaciones { get; set; }
    public DbSet<Produccion_PresupuestoMensual> Produccion_PresupuestosMensuales { get; set; }
    public DbSet<Produccion_TipoRecargo> Produccion_TiposRecargo { get; set; }

    // Talleres y Despachos Management
    public DbSet<Talleres_Rubro> Talleres_Rubros { get; set; }
    public DbSet<Talleres_Proveedor> Talleres_Proveedores { get; set; }
    public DbSet<Talleres_Cotizacion> Talleres_Cotizaciones { get; set; }
    public DbSet<Talleres_Gasto> Talleres_Gastos { get; set; }
    public DbSet<Talleres_PresupuestoMensual> Talleres_PresupuestosMensuales { get; set; }

    // Planeación Management
    public DbSet<Planeacion_Rubro> Planeacion_Rubros { get; set; }
    public DbSet<Planeacion_Proveedor> Planeacion_Proveedores { get; set; }
    public DbSet<Planeacion_Cotizacion> Planeacion_Cotizaciones { get; set; }
    public DbSet<Planeacion_Gasto> Planeacion_Gastos { get; set; }
    public DbSet<Planeacion_PresupuestoMensual> Planeacion_PresupuestosMensuales { get; set; }
    public DbSet<Planeacion_Personal> Planeacion_Personal { get; set; }

    // Diseño Management
    public DbSet<Diseno_Rubro> Diseno_Rubros { get; set; }
    public DbSet<Diseno_Proveedor> Diseno_Proveedores { get; set; }
    public DbSet<Diseno_Cotizacion> Diseno_Cotizaciones { get; set; }
    public DbSet<Diseno_Gasto> Diseno_Gastos { get; set; }
    public DbSet<Diseno_PresupuestoMensual> Diseno_PresupuestosMensuales { get; set; }

    // Orden y Aseo Surveys
    public DbSet<EncuestaOrdenAseo> EncuestasOrdenAseo { get; set; }

    // Detalle diario de producción
    public DbSet<ProduccionDiariaDetalle> ProduccionDiariaDetalles { get; set; }

    // Metas mensuales por máquina
    public DbSet<MetaMensual> MetasMensuales { get; set; }

    // Calidad Producción
    public DbSet<EncuestaCalidadProduccion> EncuestasCalidadProduccion { get; set; }
    public DbSet<EncuestaCalidadProduccionProceso> EncuestaCalidadProduccionProcesos { get; set; }

    // Consolidado NC (No Conformidad)
    public DbSet<ConsolidadoNC> ConsolidadosNC { get; set; }

    // Tickets de Reporte de Errores
    public DbSet<Ticket> Tickets { get; set; }
    public DbSet<TicketImagen> TicketImagenes { get; set; }

    // Planeador de Máquinas
    public DbSet<PlaneacionMaquina> PlaneacionesMaquinas { get; set; }

    // Talleres Externos
    public DbSet<TallerExterno> TalleresExternos { get; set; }
    public DbSet<EncuestaCalidadTaller> EncuestasCalidadTalleres { get; set; }

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
        modelBuilder.Entity<PlanAccion>().ToTable("PlanesAccion");
        modelBuilder.Entity<PlanAccionEvidencia>().ToTable("PlanAccionEvidencias");

        modelBuilder.Entity<PlanAccionEvidencia>()
            .HasOne(e => e.PlanAccion)
            .WithMany(p => p.Evidencias)
            .HasForeignKey(e => e.PlanAccionId)
            .OnDelete(DeleteBehavior.Cascade);

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
        modelBuilder.Entity<EquipoFoto>().ToTable("EquipoFotos");
        modelBuilder.Entity<HistorialMantenimiento>().ToTable("HistorialMantenimientos");

        modelBuilder.Entity<HistorialMantenimiento>()
            .HasOne(h => h.Equipo)
            .WithMany(e => e.Mantenimientos)
            .HasForeignKey(h => h.EquipoId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LicenciaEquipo>().ToTable("LicenciasEquipos");
        modelBuilder.Entity<LicenciaEquipo>()
            .HasOne(l => l.Equipo)
            .WithMany(e => e.Licencias)
            .HasForeignKey(l => l.EquipoId)
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

        // Produccion Tables Configuration
        modelBuilder.Entity<Produccion_Rubro>().ToTable("Produccion_Rubros");
        modelBuilder.Entity<Produccion_Proveedor>().ToTable("Produccion_Proveedores");
        modelBuilder.Entity<Produccion_TipoHora>().ToTable("Produccion_TiposHora");
        modelBuilder.Entity<Produccion_TipoRecargo>().ToTable("Produccion_TiposRecargo");
        modelBuilder.Entity<Produccion_Gasto>().ToTable("Produccion_Gastos");
        modelBuilder.Entity<Produccion_PresupuestoMensual>().ToTable("Produccion_PresupuestosMensuales");

        // Produccion Budget Relationship
        modelBuilder.Entity<Produccion_PresupuestoMensual>()
            .HasOne(p => p.Rubro)
            .WithMany()
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: One budget per Rubro per month/year
        modelBuilder.Entity<Produccion_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        // Talleres Tables Configuration
        modelBuilder.Entity<Talleres_Rubro>().ToTable("Talleres_Rubros");
        modelBuilder.Entity<Talleres_Proveedor>().ToTable("Talleres_Proveedores");
        modelBuilder.Entity<Talleres_Gasto>().ToTable("Talleres_Gastos");
        modelBuilder.Entity<Talleres_PresupuestoMensual>().ToTable("Talleres_PresupuestosMensuales");

        // Talleres Relationships
        modelBuilder.Entity<Talleres_Gasto>()
            .HasOne(g => g.Proveedor)
            .WithMany(p => p.Gastos)
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Talleres_Gasto>()
            .HasOne(g => g.Rubro)
            .WithMany(r => r.Gastos)
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Talleres_PresupuestoMensual>()
            .HasOne(p => p.Rubro)
            .WithMany(r => r.Presupuestos)
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: One budget per Rubro per month/year
        modelBuilder.Entity<Talleres_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        // Planeación Tables Configuration
        modelBuilder.Entity<Planeacion_Rubro>().ToTable("Planeacion_Rubros");
        modelBuilder.Entity<Planeacion_Proveedor>().ToTable("Planeacion_Proveedores");
        modelBuilder.Entity<Planeacion_Cotizacion>().ToTable("Planeacion_Cotizaciones");
        modelBuilder.Entity<Planeacion_Gasto>().ToTable("Planeacion_Gastos");
        modelBuilder.Entity<Planeacion_PresupuestoMensual>().ToTable("Planeacion_PresupuestosMensuales");
        modelBuilder.Entity<Planeacion_Personal>().ToTable("Planeacion_Personal");

        // Planeación Relationships
        modelBuilder.Entity<Planeacion_Proveedor>()
            .HasOne(p => p.Rubro)
            .WithMany(r => r.Proveedores)
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Cotizacion>()
            .HasOne(c => c.Proveedor)
            .WithMany()
            .HasForeignKey(c => c.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Gasto>()
            .HasOne(g => g.Proveedor)
            .WithMany()
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Gasto>()
            .HasOne(g => g.Rubro)
            .WithMany(r => r.Gastos)
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Gasto>()
            .HasOne(g => g.Personal)
            .WithMany()
            .HasForeignKey(g => g.PersonalId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Gasto>()
            .HasOne(g => g.TipoHora)
            .WithMany()
            .HasForeignKey(g => g.TipoHoraId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_Gasto>()
            .HasOne(g => g.TipoRecargo)
            .WithMany()
            .HasForeignKey(g => g.TipoRecargoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Planeacion_PresupuestoMensual>()
            .HasOne(p => p.Rubro)
            .WithMany()
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: One budget per Rubro per month/year
        modelBuilder.Entity<Planeacion_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        // Diseño Tables Configuration
        modelBuilder.Entity<Diseno_Rubro>().ToTable("Diseno_Rubros");
        modelBuilder.Entity<Diseno_Proveedor>().ToTable("Diseno_Proveedores");
        modelBuilder.Entity<Diseno_Cotizacion>().ToTable("Diseno_Cotizaciones");
        modelBuilder.Entity<Diseno_Gasto>().ToTable("Diseno_Gastos");
        modelBuilder.Entity<Diseno_PresupuestoMensual>().ToTable("Diseno_PresupuestosMensuales");

        // Diseño Relationships
        modelBuilder.Entity<Diseno_Proveedor>()
            .HasOne(p => p.Rubro)
            .WithMany(r => r.Proveedores)
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Diseno_Cotizacion>()
            .HasOne(c => c.Proveedor)
            .WithMany()
            .HasForeignKey(c => c.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Diseno_Gasto>()
            .HasOne(g => g.Proveedor)
            .WithMany()
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Diseno_Gasto>()
            .HasOne(g => g.Rubro)
            .WithMany(r => r.Gastos)
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Diseno_PresupuestoMensual>()
            .HasOne(p => p.Rubro)
            .WithMany()
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: One budget per Rubro per month/year
        modelBuilder.Entity<Diseno_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        // Desperdicio Tables Configuration
        modelBuilder.Entity<CodigoDesperdicio>().ToTable("CodigosDesperdicio");
        modelBuilder.Entity<RegistroDesperdicio>().ToTable("RegistrosDesperdicio");

        // Orden y Aseo Configuration
        modelBuilder.Entity<EncuestaOrdenAseo>().ToTable("EncuestasOrdenAseo");

        // ProduccionDiariaDetalle Configuration
        modelBuilder.Entity<ProduccionDiariaDetalle>().ToTable("ProduccionDiariaDetalles");
        modelBuilder.Entity<ProduccionDiariaDetalle>()
            .HasOne(d => d.ProduccionDiaria)
            .WithMany(p => p.Detalles)
            .HasForeignKey(d => d.ProduccionDiariaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ProduccionDiariaDetalle>()
            .HasOne(d => d.Actividad)
            .WithMany()
            .HasForeignKey(d => d.ActividadId)
            .OnDelete(DeleteBehavior.Restrict);

        // MetasMensuales Configuration
        modelBuilder.Entity<MetaMensual>().ToTable("MetasMensuales");
        modelBuilder.Entity<MetaMensual>()
            .HasOne(m => m.Maquina)
            .WithMany()
            .HasForeignKey(m => m.MaquinaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MetaMensual>()
            .HasIndex(m => new { m.MaquinaId, m.Mes, m.Anio })
            .IsUnique();

        // Calidad Producción Configuration
        modelBuilder.Entity<EncuestaCalidadProduccion>().ToTable("EncuestasCalidadProduccion");
        modelBuilder.Entity<EncuestaCalidadProduccionProceso>().ToTable("EncuestaCalidadProduccionProcesos");
        modelBuilder.Entity<EncuestaCalidadProduccion>()
            .HasMany(e => e.Procesos)
            .WithOne(p => p.Encuesta)
            .HasForeignKey(p => p.EncuestaId)
            .OnDelete(DeleteBehavior.Cascade);

        // Consolidado NC Configuration
        modelBuilder.Entity<ConsolidadoNC>().ToTable("ConsolidadosNC");
        modelBuilder.Entity<ConsolidadoNC>()
            .HasOne(nc => nc.EncuestaProduccion)
            .WithMany()
            .HasForeignKey(nc => nc.EncuestaProduccionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RegistroDesperdicio>()
            .HasOne(r => r.CodigoDesperdicio)
            .WithMany()
            .HasForeignKey(r => r.CodigoDesperdicioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RegistroDesperdicio>()
            .HasOne(r => r.Maquina)
            .WithMany()
            .HasForeignKey(r => r.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RegistroDesperdicio>()
            .HasOne(r => r.Usuario)
            .WithMany()
            .HasForeignKey(r => r.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Horario>().ToTable("Horarios");
        modelBuilder.Entity<Talleres_Personal>().ToTable("Talleres_Personal");

        modelBuilder.Entity<Talleres_Personal>()
            .HasOne(p => p.Horario)
            .WithMany()
            .HasForeignKey(p => p.HorarioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Tickets Configuration
        modelBuilder.Entity<Ticket>().ToTable("Tickets");
        modelBuilder.Entity<TicketImagen>().ToTable("TicketImagenes");

        modelBuilder.Entity<TicketImagen>()
            .HasOne(ti => ti.Ticket)
            .WithMany(t => t.Imagenes)
            .HasForeignKey(ti => ti.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        // PlaneacionMaquina Configuration
        modelBuilder.Entity<PlaneacionMaquina>().ToTable("PlaneacionesMaquinas");

        modelBuilder.Entity<PlaneacionMaquina>()
            .HasOne(p => p.Maquina)
            .WithMany()
            .HasForeignKey(p => p.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PlaneacionMaquina>()
            .HasOne(p => p.OrdenProduccion)
            .WithMany()
            .HasForeignKey(p => p.OrdenProduccionId)
            .OnDelete(DeleteBehavior.Restrict);

        // Calidad Talleres Externos
        modelBuilder.Entity<TallerExterno>().ToTable("TalleresExternos");
        modelBuilder.Entity<EncuestaCalidadTaller>().ToTable("EncuestasCalidadTalleres");

        modelBuilder.Entity<EncuestaCalidadTaller>()
            .HasOne(e => e.Taller)
            .WithMany()
            .HasForeignKey(e => e.TallerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EncuestaCalidadTaller>()
            .HasOne(e => e.Usuario)
            .WithMany()
            .HasForeignKey(e => e.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
