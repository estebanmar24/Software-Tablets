using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

[Table("Almacen_Productos")]
public class AlmacenProducto
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string TipoRequisicionId { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? CostoEstandar { get; set; }

    [MaxLength(30)]
    public string? UnidadSugerida { get; set; }

    public bool Activo { get; set; } = true;
}

[Table("Almacen_Proveedores")]
public class AlmacenProveedor
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Nit { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Correo { get; set; }

    [MaxLength(50)]
    public string? TelefonoTrabajo { get; set; }

    [MaxLength(50)]
    public string? TelefonoMovil { get; set; }

    [MaxLength(500)]
    public string? Direccion { get; set; }

    /// <summary>Clasificación fiscal (p. ej. declarante).</summary>
    [MaxLength(50)]
    public string? Categoria { get; set; }

    public bool ResponsableIva { get; set; }

    [MaxLength(50)]
    public string Telefono { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;
}

[Table("Almacen_Requisiciones")]
public class AlmacenRequisicion
{
    public int Id { get; set; }

    [Required, MaxLength(20)]
    public string Codigo { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string TipoRequisicionId { get; set; } = string.Empty;

    public DateTime FechaSolicitud { get; set; }

    [Required, MaxLength(50)]
    public string OrdenProduccionNumero { get; set; } = string.Empty;

    public int? CatalogoOpId { get; set; }

    [MaxLength(300)]
    public string Cliente { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Referencia { get; set; } = string.Empty;

    public int? ProductoId { get; set; }

    [Required, MaxLength(200)]
    public string ProductoNombre { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Cantidad { get; set; }

    [Required, MaxLength(30)]
    public string Unidad { get; set; } = string.Empty;

    public DateTime FechaRequerida { get; set; }

    public string? Observacion { get; set; }

    /// <summary>Pendiente | Pedido | En Almacen</summary>
    [Required, MaxLength(20)]
    public string Estado { get; set; } = "Pendiente";

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public int? CreadoPorId { get; set; }

    [MaxLength(200)]
    public string? CreadoPorNombre { get; set; }

    /// <summary>Evita reenviar el recordatorio de pedido pendiente (faltan 2 días).</summary>
    public bool RecordatorioPedidoEnviado { get; set; }

    public AlmacenPedido? Pedido { get; set; }
    public ICollection<AlmacenRecepcionLinea> RecepcionLineas { get; set; } = new List<AlmacenRecepcionLinea>();
    public ICollection<AlmacenRequisicionComentario> Comentarios { get; set; } = new List<AlmacenRequisicionComentario>();
}

[Table("Almacen_RequisicionComentarios")]
public class AlmacenRequisicionComentario
{
    public int Id { get; set; }

    public int RequisicionId { get; set; }

    public int? ParentId { get; set; }

    [Required]
    public string Texto { get; set; } = string.Empty;

    public int? UsuarioId { get; set; }

    [MaxLength(200)]
    public string? UsuarioNombre { get; set; }

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public AlmacenRequisicion Requisicion { get; set; } = null!;

    public AlmacenRequisicionComentario? Parent { get; set; }

    public ICollection<AlmacenRequisicionComentario> Respuestas { get; set; } = new List<AlmacenRequisicionComentario>();
}

[Table("Almacen_Pedidos")]
public class AlmacenPedido
{
    public int Id { get; set; }

    public int RequisicionId { get; set; }

    public DateTime FechaPedido { get; set; }

    public DateTime? FechaEntregaEstimada { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioUnitario { get; set; }

    public int? ProcesadoPorId { get; set; }

    [MaxLength(200)]
    public string? ProcesadoPorNombre { get; set; }

    public AlmacenRequisicion Requisicion { get; set; } = null!;
    public ICollection<AlmacenPedidoProveedor> Proveedores { get; set; } = new List<AlmacenPedidoProveedor>();
}

[Table("Almacen_PedidoProveedores")]
public class AlmacenPedidoProveedor
{
    public int Id { get; set; }

    public int PedidoId { get; set; }

    public int? ProveedorCatalogoId { get; set; }

    [Required, MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Nit { get; set; }

    [MaxLength(50)]
    public string? Telefono { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Cantidad { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? PrecioUnitario { get; set; }

    public bool PrecioEspecial { get; set; }

    [MaxLength(500)]
    public string? ComentarioPrecioEspecial { get; set; }

    public DateTime? FechaEntregaEstimada { get; set; }

    public bool Recibido { get; set; }

    public bool Pagado { get; set; }

    /** Medio de pago al marcar como pagado: credito | efectivo */
    [MaxLength(20)]
    public string? FormaPago { get; set; }

    /** Consecutivo global (denormalizado desde AlmacenOrdenCompra para compatibilidad). */
    public int? NumeroOrdenCompra { get; set; }

    public int? OrdenCompraId { get; set; }

    /** Ruta relativa del documento proforma (PDF o imagen). */
    [MaxLength(500)]
    public string? ProformaUrl { get; set; }

    /** Nombre original del archivo subido. */
    [MaxLength(260)]
    public string? ProformaNombre { get; set; }

    public AlmacenPedido Pedido { get; set; } = null!;
    public AlmacenOrdenCompra? OrdenCompra { get; set; }
    public AlmacenOrdenCompraLinea? OrdenCompraLinea { get; set; }
}

[Table("Almacen_OrdenesCompra")]
public class AlmacenOrdenCompra
{
    public int Id { get; set; }

    public int NumeroOrdenCompra { get; set; }

    public int? ProveedorCatalogoId { get; set; }

    [Required, MaxLength(200)]
    public string NombreProveedor { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Nit { get; set; }

    [MaxLength(50)]
    public string? Telefono { get; set; }

    public DateTime FechaPedido { get; set; }

    public DateTime? FechaEntregaEstimada { get; set; }

    /// <summary>Emitida | Cerrada</summary>
    [Required, MaxLength(20)]
    public string Estado { get; set; } = "Emitida";

    public bool Pagado { get; set; }

    [MaxLength(20)]
    public string? FormaPago { get; set; }

    public int? ProcesadoPorId { get; set; }

    [MaxLength(200)]
    public string? ProcesadoPorNombre { get; set; }

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public ICollection<AlmacenOrdenCompraLinea> Lineas { get; set; } = new List<AlmacenOrdenCompraLinea>();
    public ICollection<AlmacenPedidoProveedor> PedidoProveedores { get; set; } = new List<AlmacenPedidoProveedor>();
}

[Table("Almacen_OrdenCompraLineas")]
public class AlmacenOrdenCompraLinea
{
    public int Id { get; set; }

    public int OrdenCompraId { get; set; }

    public int PedidoProveedorId { get; set; }

    public int RequisicionId { get; set; }

    public int Orden { get; set; }

    public AlmacenOrdenCompra OrdenCompra { get; set; } = null!;
    public AlmacenPedidoProveedor PedidoProveedor { get; set; } = null!;
    public AlmacenRequisicion Requisicion { get; set; } = null!;
}

[Table("Almacen_RecepcionLineas")]
public class AlmacenRecepcionLinea
{
    public int Id { get; set; }

    public int RequisicionId { get; set; }

    public int PedidoProveedorId { get; set; }

    [Required, MaxLength(200)]
    public string NombreProveedor { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string CodigoUsuario { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? RegistradoPorNombre { get; set; }

    public DateTime FechaLlegada { get; set; }

    public bool CalidadEsperada { get; set; }

    public string? MotivoCalidadNo { get; set; }

    public bool FacturaEntregada { get; set; }

    public string? MotivoFacturaNo { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CantidadRecibida { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal CantidadPedidaEnMomento { get; set; }

    public bool PedidoCompleto { get; set; }

    public string? MotivoCantidadParcial { get; set; }

    public DateTime? NuevaFechaEntrega { get; set; }

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public AlmacenRequisicion Requisicion { get; set; } = null!;
    public AlmacenPedidoProveedor PedidoProveedor { get; set; } = null!;
}
