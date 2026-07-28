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

    // Horarios
    public DbSet<Horario> Horarios { get; set; }

    // SST Management
    public DbSet<SST_Rubro> SST_Rubros { get; set; }
    public DbSet<SST_TipoServicio> SST_TiposServicio { get; set; }
    public DbSet<SST_Proveedor> SST_Proveedores { get; set; }
    public DbSet<SST_PresupuestoMensual> SST_PresupuestosMensuales { get; set; }
    public DbSet<SST_GastoMensual> SST_GastosMensuales { get; set; }
    public DbSet<PlanAccion> PlanesAccion { get; set; }
    public DbSet<PlanAccionEvidencia> PlanAccionEvidencias { get; set; }
    public DbSet<PlanAccionObservacion> PlanAccionObservaciones { get; set; }

    // GH Management
    public DbSet<GH_Rubro> GH_Rubros { get; set; }
    public DbSet<GH_TipoServicio> GH_TiposServicio { get; set; }
    public DbSet<GH_Proveedor> GH_Proveedores { get; set; }
    public DbSet<GH_Cotizacion> GH_Cotizaciones { get; set; }
    public DbSet<SST_Cotizacion> SST_Cotizaciones { get; set; }
    public DbSet<GH_GastoMensual> GH_GastosMensuales { get; set; }
    public DbSet<GH_PresupuestoMensual> GH_PresupuestosMensuales { get; set; }

    // Produccion
    public DbSet<Produccion_Rubro> Produccion_Rubros { get; set; }
    public DbSet<Produccion_Proveedor> Produccion_Proveedores { get; set; }
    public DbSet<Produccion_ProveedorRubro> Produccion_ProveedorRubros { get; set; }
    public DbSet<Produccion_TipoHora> Produccion_TiposHora { get; set; }
    public DbSet<Produccion_Gasto> Produccion_Gastos { get; set; }
    
    // Talleres
    public DbSet<Talleres_Personal> Talleres_Personal { get; set; }
    public DbSet<Produccion_Cotizacion> Produccion_Cotizaciones { get; set; }
    public DbSet<Produccion_PresupuestoMensual> Produccion_PresupuestosMensuales { get; set; }
    public DbSet<Produccion_TipoRecargo> Produccion_TiposRecargo { get; set; }
    public DbSet<Produccion_Producto> Produccion_Productos { get; set; }
    public DbSet<ParametrosJornadaOt> ParametrosJornadaOt { get; set; }

    // Talleres y Despachos
    public DbSet<Talleres_Rubro> Talleres_Rubros { get; set; }
    public DbSet<Talleres_Proveedor> Talleres_Proveedores { get; set; }
    public DbSet<Talleres_ProveedorRubro> Talleres_ProveedorRubros { get; set; }
    public DbSet<Talleres_Cotizacion> Talleres_Cotizaciones { get; set; }
    public DbSet<Talleres_Gasto> Talleres_Gastos { get; set; }
    public DbSet<Talleres_PresupuestoMensual> Talleres_PresupuestosMensuales { get; set; }

    // Planeacion
    public DbSet<Planeacion_Rubro> Planeacion_Rubros { get; set; }
    public DbSet<Planeacion_Proveedor> Planeacion_Proveedores { get; set; }
    public DbSet<Planeacion_ProveedorRubro> Planeacion_ProveedorRubros { get; set; }
    public DbSet<Planeacion_Cotizacion> Planeacion_Cotizaciones { get; set; }
    public DbSet<Planeacion_Gasto> Planeacion_Gastos { get; set; }
    public DbSet<Planeacion_PresupuestoMensual> Planeacion_PresupuestosMensuales { get; set; }
    public DbSet<Planeacion_Personal> Planeacion_Personal { get; set; }

    // Diseno
    public DbSet<Diseno_Rubro> Diseno_Rubros { get; set; }
    public DbSet<Diseno_Proveedor> Diseno_Proveedores { get; set; }
    public DbSet<Diseno_ProveedorRubro> Diseno_ProveedorRubros { get; set; }
    public DbSet<Diseno_Cotizacion> Diseno_Cotizaciones { get; set; }
    public DbSet<Diseno_Gasto> Diseno_Gastos { get; set; }
    public DbSet<Diseno_PresupuestoMensual> Diseno_PresupuestosMensuales { get; set; }

    // Orden y Aseo Surveys
    public DbSet<EncuestaOrdenAseo> EncuestasOrdenAseo { get; set; }

    // Produccion Diario
    public DbSet<ProduccionDiariaDetalle> ProduccionDiariaDetalles { get; set; }

    // Metas mensuales
    public DbSet<MetaMensual> MetasMensuales { get; set; }

    // Calidad Produccion
    public DbSet<EncuestaCalidadProduccion> EncuestasCalidadProduccion { get; set; }
    public DbSet<EncuestaCalidadProduccionProceso> EncuestaCalidadProduccionProcesos { get; set; }

    // Consolidado NC
    public DbSet<ConsolidadoNC> ConsolidadosNC { get; set; }
    public DbSet<CalidadNC_TipoReclamacionOpcion> CalidadNC_TiposReclamacion { get; set; }

    // Tickets
    public DbSet<Ticket> Tickets { get; set; }
    public DbSet<TicketImagen> TicketImagenes { get; set; }

    // Planeador
    public DbSet<PlaneacionMaquina> PlaneacionesMaquinas { get; set; }
    public DbSet<ProgramacionOP> ProgramacionesOP { get; set; }
    public DbSet<ProgramacionOPProceso> ProgramacionesOPProcesos { get; set; }
    public DbSet<ProcesoGantt> ProcesosGantt { get; set; }
    public DbSet<MetaFacturacionMes> MetasFacturacionMes { get; set; }
    // Roster / disponibilidad planta
    public DbSet<MaquinaTurnoConfig> MaquinaTurnoConfigs { get; set; }
    public DbSet<RosterAsignacion> RosterAsignaciones { get; set; }
    public DbSet<PersonalNovedad> PersonalNovedades { get; set; }
    public DbSet<RosterTurnoDia> RosterTurnoDias { get; set; }
    public DbSet<RosterDiaFestivo> RosterDiasFestivos { get; set; }

    // Calidad Talleres Externos
    public DbSet<TallerExterno> TalleresExternos { get; set; }
    public DbSet<EncuestaCalidadTaller> EncuestasCalidadTalleres { get; set; }

    // Hoja de Vida Maquinas
    public DbSet<HojaVidaMaquina> HojasVidaMaquinas { get; set; }
    public DbSet<MantenimientoHojaVida> MantenimientosHojaVida { get; set; }
    public DbSet<MantenimientoFoto> MantenimientoFotos { get; set; }
    public DbSet<CronogramaActividad> CronogramaActividades { get; set; }
    public DbSet<CronogramaRegistro> CronogramaRegistros { get; set; }
    public DbSet<HojaVidaFoto> HojaVidaFotos { get; set; }
    public DbSet<BitacoraMaquina> BitacorasMaquinas { get; set; }
    public DbSet<BitacoraMantenimientoDiaria> BitacoraMantenimientoDiaria { get; set; }

    // Mantenimiento Gastos
    public DbSet<Mantenimiento_Rubro> Mantenimiento_Rubros { get; set; }
    public DbSet<Mantenimiento_Proveedor> Mantenimiento_Proveedores { get; set; }
    public DbSet<Mantenimiento_ProveedorRubro> Mantenimiento_ProveedorRubros { get; set; }
    public DbSet<Mantenimiento_Cotizacion> Mantenimiento_Cotizaciones { get; set; }
    public DbSet<Mantenimiento_Gasto> Mantenimiento_Gastos { get; set; }
    public DbSet<Mantenimiento_PresupuestoMensual> Mantenimiento_PresupuestosMensuales { get; set; }
    public DbSet<Mantenimiento_Producto> Mantenimiento_Productos { get; set; }
    public DbSet<Mantenimiento_Consumo> Mantenimiento_Consumos { get; set; }
    public DbSet<Mantenimiento_AjusteInventario> Mantenimiento_AjustesInventario { get; set; }
    public DbSet<Mantenimiento_TipoHora> Mantenimiento_TiposHora { get; set; }
    public DbSet<Mantenimiento_TipoRecargo> Mantenimiento_TiposRecargo { get; set; }
    public DbSet<Mantenimiento_Trazabilidad> Mantenimiento_Trazabilidad { get; set; }

    // Actas de Destrucci├│n
    public DbSet<ActaDestruccion> ActasDestruccion { get; set; }
    public DbSet<ActaDestruccionProceso> ActaDestruccionProcesos { get; set; }
    public DbSet<Contabilidad_Ingreso> Contabilidad_Ingresos { get; set; }
    public DbSet<Contabilidad_Gasto> Contabilidad_Gastos { get; set; }
    public DbSet<AdjuntoDocumentoExtraccion> AdjuntoDocumentoExtracciones { get; set; }
    public DbSet<CatalogoOrdenProduccion> CatalogoOrdenesProduccion { get; set; }

    // Evaluaci├│n por ├ürea (checklist mensual por ├írea)
    public DbSet<EvaluacionArea_Actividad> EvaluacionArea_Actividades { get; set; }
    public DbSet<Audit_Checklist> Audit_Checklist_Items { get; set; }
    public DbSet<Audit_ChecklistResponsable> Audit_Checklist_Responsables { get; set; }
    public DbSet<Audit_ChecklistTipo> Audit_Checklist_Tipos { get; set; }

    // Almac├®n
    public DbSet<AlmacenProducto> AlmacenProductos { get; set; }
    public DbSet<AlmacenProveedor> AlmacenProveedores { get; set; }
    public DbSet<AlmacenRequisicion> AlmacenRequisiciones { get; set; }
    public DbSet<AlmacenPedido> AlmacenPedidos { get; set; }
    public DbSet<AlmacenPedidoProveedor> AlmacenPedidoProveedores { get; set; }
    public DbSet<AlmacenRecepcionLinea> AlmacenRecepcionLineas { get; set; }
    public DbSet<AlmacenOrdenCompra> AlmacenOrdenesCompra { get; set; }
    public DbSet<AlmacenOrdenCompraLinea> AlmacenOrdenCompraLineas { get; set; }
    public DbSet<AlmacenRequisicionComentario> AlmacenRequisicionComentarios { get; set; }
    public DbSet<GastoAutorizacionSolicitud> GastoAutorizacionSolicitudes { get; set; }
    public DbSet<GastoAutorizacionComentario> GastoAutorizacionComentarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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

        modelBuilder.Entity<PlanAccionObservacion>()
            .HasOne(o => o.PlanAccion)
            .WithMany(p => p.HistoricoObservaciones)
            .HasForeignKey(o => o.PlanAccionId)
            .OnDelete(DeleteBehavior.Cascade);

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

        modelBuilder.Entity<SST_Rubro>().ToTable("SST_Rubros");
        modelBuilder.Entity<SST_TipoServicio>().ToTable("SST_TiposServicio");
        modelBuilder.Entity<SST_Proveedor>().ToTable("SST_Proveedores");
        modelBuilder.Entity<SST_PresupuestoMensual>().ToTable("SST_PresupuestosMensuales");
        modelBuilder.Entity<SST_GastoMensual>().ToTable("SST_GastosMensuales");

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

        modelBuilder.Entity<GH_Rubro>().ToTable("GH_Rubros");
        modelBuilder.Entity<GH_TipoServicio>().ToTable("GH_TiposServicio");
        modelBuilder.Entity<GH_Proveedor>().ToTable("GH_Proveedores");
        modelBuilder.Entity<GH_Cotizacion>().ToTable("GH_Cotizaciones");
        modelBuilder.Entity<GH_GastoMensual>().ToTable("GH_GastosMensuales");
        modelBuilder.Entity<GH_PresupuestoMensual>().ToTable("GH_PresupuestosMensuales");

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

        modelBuilder.Entity<Produccion_Rubro>().ToTable("Produccion_Rubros");
        modelBuilder.Entity<Produccion_Proveedor>().ToTable("Produccion_Proveedores");
        modelBuilder.Entity<Produccion_ProveedorRubro>()
            .HasKey(x => new { x.ProveedorId, x.RubroId });
        modelBuilder.Entity<Produccion_ProveedorRubro>()
            .HasOne(x => x.Proveedor).WithMany(p => p.ProveedorRubros).HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Produccion_ProveedorRubro>()
            .HasOne(x => x.Rubro).WithMany().HasForeignKey(x => x.RubroId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Produccion_TipoHora>().ToTable("Produccion_TiposHora");
        modelBuilder.Entity<Produccion_TipoRecargo>().ToTable("Produccion_TiposRecargo");
        modelBuilder.Entity<Produccion_Gasto>().ToTable("Produccion_Gastos");
        modelBuilder.Entity<Produccion_PresupuestoMensual>().ToTable("Produccion_PresupuestosMensuales");
        modelBuilder.Entity<Produccion_Producto>().ToTable("Produccion_Productos");
        modelBuilder.Entity<ParametrosJornadaOt>().ToTable("ParametrosJornadaOt");
        
        modelBuilder.Entity<Produccion_Cotizacion>()
            .HasOne(c => c.Producto)
            .WithMany()
            .HasForeignKey(c => c.ProductoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Produccion_PresupuestoMensual>()
            .HasOne(p => p.Rubro)
            .WithMany()
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Produccion_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        modelBuilder.Entity<Talleres_Rubro>().ToTable("Talleres_Rubros");
        modelBuilder.Entity<Talleres_Proveedor>().ToTable("Talleres_Proveedores");
        modelBuilder.Entity<Talleres_ProveedorRubro>()
            .HasKey(x => new { x.ProveedorId, x.RubroId });
        modelBuilder.Entity<Talleres_ProveedorRubro>()
            .HasOne(x => x.Proveedor).WithMany(p => p.ProveedorRubros).HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Talleres_ProveedorRubro>()
            .HasOne(x => x.Rubro).WithMany().HasForeignKey(x => x.RubroId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Talleres_Gasto>().ToTable("Talleres_Gastos");
        modelBuilder.Entity<Talleres_PresupuestoMensual>().ToTable("Talleres_PresupuestosMensuales");

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

        modelBuilder.Entity<Talleres_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        modelBuilder.Entity<Planeacion_Rubro>().ToTable("Planeacion_Rubros");
        modelBuilder.Entity<Planeacion_Proveedor>().ToTable("Planeacion_Proveedores");
        modelBuilder.Entity<Planeacion_Cotizacion>().ToTable("Planeacion_Cotizaciones");
        modelBuilder.Entity<Planeacion_Gasto>().ToTable("Planeacion_Gastos");
        modelBuilder.Entity<Planeacion_PresupuestoMensual>().ToTable("Planeacion_PresupuestosMensuales");
        modelBuilder.Entity<Planeacion_Personal>().ToTable("Planeacion_Personal");

        modelBuilder.Entity<Planeacion_ProveedorRubro>()
            .HasKey(x => new { x.ProveedorId, x.RubroId });
        modelBuilder.Entity<Planeacion_ProveedorRubro>()
            .HasOne(x => x.Proveedor).WithMany(p => p.ProveedorRubros).HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Planeacion_ProveedorRubro>()
            .HasOne(x => x.Rubro).WithMany().HasForeignKey(x => x.RubroId).OnDelete(DeleteBehavior.Restrict);

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

        modelBuilder.Entity<Planeacion_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        modelBuilder.Entity<Diseno_Rubro>().ToTable("Diseno_Rubros");
        modelBuilder.Entity<Diseno_Proveedor>().ToTable("Diseno_Proveedores");
        modelBuilder.Entity<Diseno_Cotizacion>().ToTable("Diseno_Cotizaciones");
        modelBuilder.Entity<Diseno_Gasto>().ToTable("Diseno_Gastos");
        modelBuilder.Entity<Diseno_PresupuestoMensual>().ToTable("Diseno_PresupuestosMensuales");

        modelBuilder.Entity<Diseno_ProveedorRubro>()
            .HasKey(x => new { x.ProveedorId, x.RubroId });
        modelBuilder.Entity<Diseno_ProveedorRubro>()
            .HasOne(x => x.Proveedor).WithMany(p => p.ProveedorRubros).HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Diseno_ProveedorRubro>()
            .HasOne(x => x.Rubro).WithMany().HasForeignKey(x => x.RubroId).OnDelete(DeleteBehavior.Restrict);

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

        modelBuilder.Entity<Diseno_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        modelBuilder.Entity<CodigoDesperdicio>().ToTable("CodigosDesperdicio");
        modelBuilder.Entity<RegistroDesperdicio>().ToTable("RegistrosDesperdicio");

        modelBuilder.Entity<EncuestaOrdenAseo>().ToTable("EncuestasOrdenAseo");

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

        modelBuilder.Entity<MetaMensual>().ToTable("MetasMensuales");
        modelBuilder.Entity<MetaMensual>()
            .HasOne(m => m.Maquina)
            .WithMany()
            .HasForeignKey(m => m.MaquinaId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MetaMensual>()
            .HasIndex(m => new { m.MaquinaId, m.Mes, m.Anio })
            .IsUnique();

        modelBuilder.Entity<EncuestaCalidadProduccion>().ToTable("EncuestasCalidadProduccion");
        modelBuilder.Entity<EncuestaCalidadProduccionProceso>().ToTable("EncuestaCalidadProduccionProcesos");
        modelBuilder.Entity<EncuestaCalidadProduccion>()
            .HasMany(e => e.Procesos)
            .WithOne(p => p.Encuesta)
            .HasForeignKey(p => p.EncuestaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ConsolidadoNC>().ToTable("ConsolidadosNC");
        modelBuilder.Entity<CalidadNC_TipoReclamacionOpcion>().ToTable("CalidadNC_TiposReclamacion");
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

        modelBuilder.Entity<Ticket>().ToTable("Tickets");
        modelBuilder.Entity<TicketImagen>().ToTable("TicketImagenes");

        modelBuilder.Entity<TicketImagen>()
            .HasOne(ti => ti.Ticket)
            .WithMany(t => t.Imagenes)
            .HasForeignKey(ti => ti.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

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


        modelBuilder.Entity<ProgramacionOP>().ToTable("ProgramacionesOP");
        modelBuilder.Entity<ProgramacionOPProceso>().ToTable("ProgramacionesOPProcesos");
        modelBuilder.Entity<ProcesoGantt>().ToTable("ProcesosGantt");
        modelBuilder.Entity<MetaFacturacionMes>().ToTable("MetasFacturacionMes");
        modelBuilder.Entity<MaquinaTurnoConfig>(e =>
        {
            e.ToTable("MaquinaTurnoConfig");
            e.HasIndex(x => new { x.MaquinaId, x.HorarioId }).IsUnique();
            e.HasOne(x => x.Maquina).WithMany().HasForeignKey(x => x.MaquinaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Horario).WithMany().HasForeignKey(x => x.HorarioId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<RosterAsignacion>(e =>
        {
            e.ToTable("RosterAsignaciones");
            e.HasIndex(x => new { x.FechaDia, x.MaquinaId, x.HorarioId, x.UsuarioId }).IsUnique();
            e.HasIndex(x => new { x.Anio, x.SemanaIso });
            e.HasOne(x => x.Maquina).WithMany().HasForeignKey(x => x.MaquinaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Horario).WithMany().HasForeignKey(x => x.HorarioId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<PersonalNovedad>(e =>
        {
            e.ToTable("PersonalNovedades");
            e.HasIndex(x => new { x.UsuarioId, x.FechaInicio, x.FechaFin });
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<RosterTurnoDia>(e =>
        {
            e.ToTable("RosterTurnoDias");
            e.HasIndex(x => new { x.FechaDia, x.MaquinaId, x.HorarioId }).IsUnique();
            e.HasOne(x => x.Maquina).WithMany().HasForeignKey(x => x.MaquinaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Horario).WithMany().HasForeignKey(x => x.HorarioId).OnDelete(DeleteBehavior.Restrict);
        });
                modelBuilder.Entity<RosterDiaFestivo>(e =>
        {
            e.ToTable("RosterDiasFestivos");
            e.HasIndex(x => x.FechaDia).IsUnique();
        });
        modelBuilder.Entity<MetaFacturacionMes>().HasIndex(m => new { m.Anio, m.Mes }).IsUnique();

        modelBuilder.Entity<ProgramacionOP>()
            .HasOne(p => p.OrdenProduccion)
            .WithMany()
            .HasForeignKey(p => p.OrdenProduccionId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ProgramacionOPProceso>()
            .HasOne(p => p.ProgramacionOP)
            .WithMany(op => op.Procesos)
            .HasForeignKey(p => p.ProgramacionOPId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TallerExterno>().ToTable("TalleresExternos");
        modelBuilder.Entity<EncuestaCalidadTaller>().ToTable("EncuestasCalidadTalleres");

        modelBuilder.Entity<EncuestaCalidadTaller>()
            .HasOne(e => e.Taller)
            .WithMany()
            .HasForeignKey(e => e.TallerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EncuestaCalidadTaller>()
            .HasOne(e => e.AdminUsuario)
            .WithMany()
            .HasForeignKey(e => e.UsuarioId)
            .OnDelete(DeleteBehavior.Restrict);

        // Hoja de Vida Maquinas
        modelBuilder.Entity<HojaVidaMaquina>().ToTable("HojasVidaMaquinas");
        modelBuilder.Entity<MantenimientoHojaVida>().ToTable("MantenimientosHojaVida");
        modelBuilder.Entity<HojaVidaFoto>().ToTable("HojaVidaFotos");

        modelBuilder.Entity<MantenimientoHojaVida>()
            .HasOne(m => m.HojaVida)
            .WithMany(h => h.Mantenimientos)
            .HasForeignKey(m => m.HojaVidaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<HojaVidaFoto>()
            .HasOne(f => f.HojaVida)
            .WithMany(h => h.Fotos)
            .HasForeignKey(f => f.HojaVidaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MantenimientoFoto>().ToTable("MantenimientoFotos");
        modelBuilder.Entity<MantenimientoFoto>()
            .HasOne(f => f.Mantenimiento)
            .WithMany(m => m.Fotos)
            .HasForeignKey(f => f.MantenimientoId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BitacoraMaquina>().ToTable("BitacorasMaquinas");
        modelBuilder.Entity<BitacoraMaquina>()
            .HasOne(b => b.HojaVida)
            .WithMany()
            .HasForeignKey(b => b.HojaVidaId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BitacoraMantenimientoDiaria>().ToTable("Bitacora_MantenimientoDiaria");

        modelBuilder.Entity<CronogramaActividad>().ToTable("Cronogramas_Actividades");
        modelBuilder.Entity<CronogramaRegistro>().ToTable("Cronogramas_Registros");

        // Mantenimiento Gastos
        modelBuilder.Entity<Mantenimiento_Rubro>().ToTable("Mantenimiento_Rubros");
        modelBuilder.Entity<Mantenimiento_Proveedor>().ToTable("Mantenimiento_Proveedores");
        modelBuilder.Entity<Mantenimiento_Cotizacion>().ToTable("Mantenimiento_Cotizaciones");
        modelBuilder.Entity<Mantenimiento_Gasto>().ToTable("Mantenimiento_Gastos");
        modelBuilder.Entity<Mantenimiento_PresupuestoMensual>().ToTable("Mantenimiento_PresupuestosMensuales");
        modelBuilder.Entity<Mantenimiento_Producto>().ToTable("Mantenimiento_Productos");
        modelBuilder.Entity<Mantenimiento_Consumo>().ToTable("Mantenimiento_Consumos");
        modelBuilder.Entity<Mantenimiento_AjusteInventario>().ToTable("Mantenimiento_AjustesInventario");
        modelBuilder.Entity<Mantenimiento_AjusteInventario>()
            .HasOne(a => a.Producto)
            .WithMany()
            .HasForeignKey(a => a.ProductoId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Mantenimiento_Consumo>()
            .HasOne(c => c.Producto)
            .WithMany()
            .HasForeignKey(c => c.ProductoId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Mantenimiento_Consumo>()
            .HasOne(c => c.Maquina)
            .WithMany()
            .HasForeignKey(c => c.MaquinaId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Mantenimiento_Consumo>()
            .HasOne(c => c.HojaVida)
            .WithMany()
            .HasForeignKey(c => c.HojaVidaId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Mantenimiento_Consumo>()
            .HasOne(c => c.MantenimientoRegistro)
            .WithMany()
            .HasForeignKey(c => c.MantenimientoHojaVidaId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Mantenimiento_TipoHora>().ToTable("Mantenimiento_TiposHora");
        modelBuilder.Entity<Mantenimiento_TipoRecargo>().ToTable("Mantenimiento_TiposRecargo");

        modelBuilder.Entity<Mantenimiento_ProveedorRubro>()
            .HasKey(x => new { x.ProveedorId, x.RubroId });
        modelBuilder.Entity<Mantenimiento_ProveedorRubro>()
            .HasOne(x => x.Proveedor).WithMany(p => p.ProveedorRubros).HasForeignKey(x => x.ProveedorId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Mantenimiento_ProveedorRubro>()
            .HasOne(x => x.Rubro).WithMany().HasForeignKey(x => x.RubroId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_Proveedor>()
            .HasOne(p => p.Rubro)
            .WithMany()
            .HasForeignKey(p => p.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_Cotizacion>()
            .HasOne(c => c.Proveedor)
            .WithMany(p => p.Cotizaciones)
            .HasForeignKey(c => c.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_Gasto>()
            .HasOne(g => g.Rubro)
            .WithMany()
            .HasForeignKey(g => g.RubroId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_Gasto>()
            .HasOne(g => g.Proveedor)
            .WithMany()
            .HasForeignKey(g => g.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_Gasto>()
            .HasOne(g => g.Maquina)
            .WithMany()
            .HasForeignKey(g => g.MaquinaId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mantenimiento_PresupuestoMensual>()
            .HasIndex(p => new { p.RubroId, p.Anio, p.Mes })
            .IsUnique();

        // Actas de Destrucci├│n
        modelBuilder.Entity<ActaDestruccion>().ToTable("ActasDestruccion");
        modelBuilder.Entity<ActaDestruccionProceso>().ToTable("ActaDestruccionProcesos");
        modelBuilder.Entity<Contabilidad_Ingreso>().ToTable("Contabilidad_Ingresos");
        modelBuilder.Entity<Contabilidad_Gasto>().ToTable("Contabilidad_Gastos");
        modelBuilder.Entity<EvaluacionArea_Actividad>().ToTable("EvaluacionArea_Actividades");

        modelBuilder.Entity<EvaluacionArea_Actividad>()
            .HasIndex(a => new { a.Area, a.Anio, a.Mes });

        modelBuilder.Entity<ActaDestruccionProceso>()
            .HasOne(p => p.ActaDestruccion)
            .WithMany(a => a.Procesos)
            .HasForeignKey(p => p.ActaDestruccionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Audit Checklist (CT-PAT / ILS)
        modelBuilder.Entity<Audit_Checklist>().ToTable("Audit_Checklist_Items");
        modelBuilder.Entity<Audit_ChecklistResponsable>().ToTable("Audit_Checklist_Responsables");

        modelBuilder.Entity<Audit_Checklist>()
            .HasIndex(c => new { c.Tipo, c.Anio, c.Mes });

        modelBuilder.Entity<Audit_Checklist>()
            .HasMany(c => c.Responsables)
            .WithOne(r => r.Checklist!)
            .HasForeignKey(r => r.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Audit_ChecklistTipo>().ToTable("Audit_Checklist_Tipos");
        modelBuilder.Entity<Audit_ChecklistTipo>()
            .HasIndex(t => new { t.Codigo, t.Anio })
            .IsUnique();

        // Almac├®n
        modelBuilder.Entity<AlmacenPedido>()
            .HasOne(p => p.Requisicion)
            .WithOne(r => r.Pedido)
            .HasForeignKey<AlmacenPedido>(p => p.RequisicionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AlmacenPedidoProveedor>()
            .HasOne(p => p.Pedido)
            .WithMany(p => p.Proveedores)
            .HasForeignKey(p => p.PedidoId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AlmacenPedidoProveedor>()
            .HasOne(p => p.OrdenCompra)
            .WithMany(o => o.PedidoProveedores)
            .HasForeignKey(p => p.OrdenCompraId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AlmacenOrdenCompra>()
            .HasIndex(o => o.NumeroOrdenCompra)
            .IsUnique();

        modelBuilder.Entity<AlmacenOrdenCompraLinea>()
            .HasOne(l => l.OrdenCompra)
            .WithMany(o => o.Lineas)
            .HasForeignKey(l => l.OrdenCompraId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AlmacenOrdenCompraLinea>()
            .HasOne(l => l.PedidoProveedor)
            .WithOne(p => p.OrdenCompraLinea)
            .HasForeignKey<AlmacenOrdenCompraLinea>(l => l.PedidoProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AlmacenOrdenCompraLinea>()
            .HasOne(l => l.Requisicion)
            .WithMany()
            .HasForeignKey(l => l.RequisicionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AlmacenOrdenCompraLinea>()
            .HasIndex(l => l.PedidoProveedorId)
            .IsUnique();

        modelBuilder.Entity<AlmacenRecepcionLinea>()
            .HasOne(l => l.Requisicion)
            .WithMany(r => r.RecepcionLineas)
            .HasForeignKey(l => l.RequisicionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AlmacenRecepcionLinea>()
            .HasOne(l => l.PedidoProveedor)
            .WithMany()
            .HasForeignKey(l => l.PedidoProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AlmacenRequisicion>()
            .HasIndex(r => r.Codigo)
            .IsUnique();

        modelBuilder.Entity<AlmacenRequisicionComentario>()
            .HasOne(c => c.Requisicion)
            .WithMany(r => r.Comentarios)
            .HasForeignKey(c => c.RequisicionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AlmacenRequisicionComentario>()
            .HasOne(c => c.Parent)
            .WithMany(c => c.Respuestas)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GastoAutorizacionComentario>()
            .HasOne(c => c.Solicitud)
            .WithMany(s => s.Comentarios)
            .HasForeignKey(c => c.SolicitudId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GastoAutorizacionComentario>()
            .HasOne(c => c.Parent)
            .WithMany(c => c.Respuestas)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
