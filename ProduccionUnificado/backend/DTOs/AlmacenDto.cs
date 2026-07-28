namespace TiempoProcesos.API.DTOs;

public class AlmacenNotificacionesDto
{
    public string NombreDestino { get; set; } = string.Empty;
    public List<string> CorreosDestino { get; set; } = new();
}

public class AlmacenCatalogosDto
{
    public List<AlmacenTipoRequisicionDto> TiposRequisicion { get; set; } = new();
    public List<AlmacenProductoDto> Productos { get; set; } = new();
    public List<string> UnidadesMedida { get; set; } = new();
    public AlmacenNotificacionesDto? Notificaciones { get; set; }
}

public class AlmacenTipoRequisicionDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string AccentColor { get; set; } = string.Empty;
}

public class AlmacenProductoDto
{
    public string Id { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public decimal? CostoEstandar { get; set; }
    public string TipoRequisicion { get; set; } = string.Empty;
    public string? UnidadSugerida { get; set; }
}

public class AlmacenImportarProductosResultDto
{
    public int Importados { get; set; }
    public int OmitidosDuplicados { get; set; }
    public int FilasVacias { get; set; }
    public int FilasInvalidas { get; set; }
    public List<AlmacenProductoDto> Productos { get; set; } = new();
}

public class AlmacenProveedorDto
{
    public string Id { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Nit { get; set; } = string.Empty;
    public string? Correo { get; set; }
    public string? TelefonoTrabajo { get; set; }
    public string? TelefonoMovil { get; set; }
    public string? Direccion { get; set; }
    public string? Categoria { get; set; }
    public bool ResponsableIva { get; set; }
    /// <summary>Teléfono principal (móvil o trabajo) para pedidos.</summary>
    public string Telefono { get; set; } = string.Empty;
}

public class AlmacenImportarProveedoresResultDto
{
    public int Importados { get; set; }
    public int Actualizados { get; set; }
    public int OmitidosDuplicados { get; set; }
    public int FilasVacias { get; set; }
    public int FilasInvalidas { get; set; }
    public int FilasConNit { get; set; }
    public int FilasConTelefono { get; set; }
    public int FilasConCorreo { get; set; }
    public string ColumnasDetectadas { get; set; } = string.Empty;
    public List<AlmacenProveedorDto> Proveedores { get; set; } = new();
}

public class AlmacenOrdenProduccionDto
{
    public string Id { get; set; } = string.Empty;
    public string Numero { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
}

public class AlmacenRequisicionWriteDto
{
    public string? TipoRequisicionId { get; set; }
    public string? OrdenProduccionId { get; set; }
    public string? OrdenProduccionNumero { get; set; }
    public string? Cliente { get; set; }
    public string? Referencia { get; set; }
    public string? ProductoId { get; set; }
    public string? FechaSolicitud { get; set; }
    public string? FechaRequerida { get; set; }
    public decimal? Cantidad { get; set; }
    public string? Unidad { get; set; }
    public string? Observacion { get; set; }
}

public class AlmacenProveedorPedidoWriteDto
{
    public string? Id { get; set; }
    public string? Nombre { get; set; }
    public decimal Cantidad { get; set; }
    public string? Nit { get; set; }
    public string? Telefono { get; set; }
    public string? CatalogoId { get; set; }
    public string? FechaEntregaEstimada { get; set; }
    public decimal? PrecioUnitario { get; set; }
    public bool? PrecioEspecial { get; set; }
    public string? ComentarioPrecioEspecial { get; set; }
    public bool? Recibido { get; set; }
    public string? Categoria { get; set; }
    public bool? ResponsableIva { get; set; }
    /// <summary>Si se indica, agrega la línea a esa OC existente del mismo proveedor.</summary>
    public string? AgregarAOrdenCompraId { get; set; }
    public string? ProformaUrl { get; set; }
    public string? ProformaNombre { get; set; }
}

public class AlmacenPedidoWriteDto
{
    public string? FechaPedido { get; set; }
    public string? FechaEntregaEstimada { get; set; }
    public decimal? PrecioUnitario { get; set; }
    public List<AlmacenProveedorPedidoWriteDto> Proveedores { get; set; } = new();
}

public class AlmacenRecepcionLineaWriteDto
{
    public string ProveedorId { get; set; } = string.Empty;
    public string? NombreProveedor { get; set; }
    public string CodigoUsuario { get; set; } = string.Empty;
    public string FechaLlegada { get; set; } = string.Empty;
    public bool CalidadEsperada { get; set; }
    public string? MotivoCalidadNo { get; set; }
    public bool FacturaEntregada { get; set; }
    public string? MotivoFacturaNo { get; set; }
    public decimal CantidadRecibida { get; set; }
    public decimal CantidadPedidaEnMomento { get; set; }
    public bool PedidoCompleto { get; set; }
    public string? MotivoCantidadParcial { get; set; }
    public string? NuevaFechaEntrega { get; set; }
}

public class AlmacenProveedorAsignadoDto
{
    public string Id { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public string? Nit { get; set; }
    public string? Telefono { get; set; }
    public string? CatalogoId { get; set; }
    public string? FechaEntregaEstimada { get; set; }
    public decimal? PrecioUnitario { get; set; }
    public bool PrecioEspecial { get; set; }
    public string? ComentarioPrecioEspecial { get; set; }
    public bool Recibido { get; set; }
    public bool Pagado { get; set; }
    public string? FormaPago { get; set; }
    public int? NumeroOrdenCompra { get; set; }
    public string? OrdenCompraId { get; set; }
    public string? ProformaUrl { get; set; }
    public string? ProformaNombre { get; set; }
}

public class AlmacenMarcarPagadoDto
{
    public bool Pagado { get; set; } = true;
    public string? FormaPago { get; set; }
}

public class AlmacenDatosPedidoDto
{
    public string FechaPedido { get; set; } = string.Empty;
    public string FechaEntregaEstimada { get; set; } = string.Empty;
    public decimal? PrecioUnitario { get; set; }
    public string? ProcesadoPorNombre { get; set; }
    public List<AlmacenProveedorAsignadoDto> Proveedores { get; set; } = new();
}

public class AlmacenRecepcionLineaDto
{
    public string ProveedorId { get; set; } = string.Empty;
    public string NombreProveedor { get; set; } = string.Empty;
    public string CodigoUsuario { get; set; } = string.Empty;
    public string? RegistradoPorNombre { get; set; }
    public string FechaLlegada { get; set; } = string.Empty;
    public bool CalidadEsperada { get; set; }
    public string? MotivoCalidadNo { get; set; }
    public bool FacturaEntregada { get; set; }
    public string? MotivoFacturaNo { get; set; }
    public decimal CantidadRecibida { get; set; }
    public decimal CantidadPedidaEnMomento { get; set; }
    public bool PedidoCompleto { get; set; }
    public string? MotivoCantidadParcial { get; set; }
    public string? NuevaFechaEntrega { get; set; }
}

public class AlmacenDatosRecepcionDto
{
    public List<AlmacenRecepcionLineaDto> Lineas { get; set; } = new();
}

public class AlmacenRequisicionDto
{
    public string Id { get; set; } = string.Empty;
    public string Codigo { get; set; } = string.Empty;
    public string TipoRequisicion { get; set; } = string.Empty;
    public string FechaSolicitud { get; set; } = string.Empty;
    public string HoraRegistro { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string Producto { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public string Unidad { get; set; } = string.Empty;
    public string FechaRequerida { get; set; } = string.Empty;
    public string? Observacion { get; set; }
    public string Estado { get; set; } = "Pendiente";
    public string? CreadoPorNombre { get; set; }
    public AlmacenDatosPedidoDto? Pedido { get; set; }
    public AlmacenDatosRecepcionDto? Recepcion { get; set; }
    public List<AlmacenRequisicionComentarioDto> Comentarios { get; set; } = new();
    public int TotalComentarios { get; set; }
}

public class AlmacenRequisicionComentarioDto
{
    public string Id { get; set; } = string.Empty;
    public string Texto { get; set; } = string.Empty;
    public string? UsuarioNombre { get; set; }
    public string Fecha { get; set; } = string.Empty;
    public string Hora { get; set; } = string.Empty;
    public bool EsLegacy { get; set; }
    public List<AlmacenRequisicionComentarioDto> Respuestas { get; set; } = new();
}

public class AlmacenRequisicionComentarioWriteDto
{
    public string Texto { get; set; } = string.Empty;
    public string? ParentId { get; set; }
}

public class AlmacenOrdenCompraLineaDto
{
    public string Id { get; set; } = string.Empty;
    public string PedidoProveedorId { get; set; } = string.Empty;
    public string RequisicionId { get; set; } = string.Empty;
    public string RequisicionCodigo { get; set; } = string.Empty;
    public string Producto { get; set; } = string.Empty;
    public string OrdenProduccion { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public string Unidad { get; set; } = string.Empty;
    public decimal? PrecioUnitario { get; set; }
    public bool PrecioEspecial { get; set; }
    public string? ComentarioPrecioEspecial { get; set; }
    public string? FechaEntregaEstimada { get; set; }
    public bool Recibido { get; set; }
    public bool Pagado { get; set; }
}

public class AlmacenOrdenCompraDto
{
    public string Id { get; set; } = string.Empty;
    public int NumeroOrdenCompra { get; set; }
    public string NombreProveedor { get; set; } = string.Empty;
    public string? Nit { get; set; }
    public string? Telefono { get; set; }
    public string? CatalogoId { get; set; }
    public string FechaPedido { get; set; } = string.Empty;
    public string FechaEntregaEstimada { get; set; } = string.Empty;
    public string Estado { get; set; } = "Emitida";
    public bool Pagado { get; set; }
    public string? FormaPago { get; set; }
    public string? ProcesadoPorNombre { get; set; }
    public List<AlmacenOrdenCompraLineaDto> Lineas { get; set; } = new();
}

public class AlmacenConsolidarPedidoLineaWriteDto
{
    public string RequisicionId { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public decimal? PrecioUnitario { get; set; }
    public bool? PrecioEspecial { get; set; }
    public string? ComentarioPrecioEspecial { get; set; }
    public string? FechaEntregaEstimada { get; set; }
}

public class AlmacenConsolidarPedidoWriteDto
{
    public string? FechaPedido { get; set; }
    public string? FechaEntregaEstimada { get; set; }
    public AlmacenProveedorPedidoWriteDto? Proveedor { get; set; }
    public List<AlmacenConsolidarPedidoLineaWriteDto> Lineas { get; set; } = new();
    public string? AgregarAOrdenCompraId { get; set; }
}

public class AlmacenConsolidarPedidoResultDto
{
    public AlmacenOrdenCompraDto OrdenCompra { get; set; } = new();
    public List<AlmacenRequisicionDto> Requisiciones { get; set; } = new();
}
