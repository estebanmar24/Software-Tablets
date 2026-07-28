using System.Text.RegularExpressions;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/almacen")]
public class AlmacenController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AlmacenService _service;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AlmacenEmailService _emailService;
    private readonly IWebHostEnvironment _env;

    public AlmacenController(
        AppDbContext context,
        AlmacenService service,
        IServiceScopeFactory scopeFactory,
        AlmacenEmailService emailService,
        IWebHostEnvironment env)
    {
        _context = context;
        _service = service;
        _scopeFactory = scopeFactory;
        _emailService = emailService;
        _env = env;
    }

    private void EncolarCorreo(Func<AlmacenEmailService, Task> accion)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var mail = scope.ServiceProvider.GetRequiredService<AlmacenEmailService>();
                await accion(mail);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AlmacenEmail] {ex.Message}");
            }
        });
    }

    private (int? id, string nombre) ObtenerUsuarioActual()
    {
        var idClaim = User.Claims.FirstOrDefault(c => c.Type == "Id");
        var nombre = User.Claims.FirstOrDefault(c => c.Type == "NombreMostrar")?.Value
            ?? User.Identity?.Name
            ?? "";
        int? id = idClaim != null && int.TryParse(idClaim.Value, out var parsed) ? parsed : null;
        return (id, nombre.Trim());
    }

    [HttpGet("catalogos")]
    public async Task<ActionResult<AlmacenCatalogosDto>> GetCatalogos()
    {
        var productos = await _context.AlmacenProductos
            .AsNoTracking()
            .Where(p => p.Activo)
            .OrderBy(p => p.Nombre)
            .ToListAsync();

        return Ok(new AlmacenCatalogosDto
        {
            TiposRequisicion = AlmacenCatalog.TiposRequisicion.ToList(),
            Productos = productos.Select(MapProducto).ToList(),
            UnidadesMedida = AlmacenCatalog.UnidadesMedida.ToList(),
            Notificaciones = _emailService.ObtenerConfiguracion(),
        });
    }

    [HttpGet("productos")]
    public async Task<ActionResult<IEnumerable<AlmacenProductoDto>>> GetProductos(
        [FromQuery] string? tipo, [FromQuery] string? q, [FromQuery] string? unidad)
    {
        var query = _context.AlmacenProductos.AsNoTracking().Where(p => p.Activo);
        if (!string.IsNullOrWhiteSpace(tipo))
            query = query.Where(p => p.TipoRequisicionId == tipo);
        if (!string.IsNullOrWhiteSpace(unidad))
        {
            var u = unidad.Trim().ToLower();
            query = query.Where(p => p.UnidadSugerida != null && p.UnidadSugerida.ToLower() == u);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(p =>
                p.Nombre.ToLower().Contains(term) ||
                (p.Descripcion != null && p.Descripcion.ToLower().Contains(term)) ||
                (p.UnidadSugerida != null && p.UnidadSugerida.ToLower().Contains(term)));
        }

        var data = await query.OrderBy(p => p.Nombre).ToListAsync();
        return Ok(data.Select(MapProducto));
    }

    [HttpPost("productos")]
    public async Task<ActionResult<AlmacenProductoDto>> CreateProducto([FromBody] AlmacenProductoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre))
            return BadRequest(new { message = "El nombre del producto es obligatorio." });
        if (string.IsNullOrWhiteSpace(dto.TipoRequisicion))
            return BadRequest(new { message = "La categoría del producto es obligatoria." });

        var tipo = dto.TipoRequisicion.Trim();
        if (!AlmacenCatalog.TiposRequisicion.Any(t => t.Id == tipo))
            return BadRequest(new { message = "Categoría de producto no válida." });

        var nombre = dto.Nombre.Trim();
        var duplicado = await _context.AlmacenProductos
            .AnyAsync(p => p.Activo && p.Nombre.ToLower() == nombre.ToLower());
        if (duplicado)
            return BadRequest(new { message = "Ya existe un producto con ese nombre." });

        var entity = new AlmacenProducto
        {
            Nombre = nombre,
            TipoRequisicionId = tipo,
            Descripcion = LimpiarTextoOpcional(dto.Descripcion, 500),
            CostoEstandar = dto.CostoEstandar,
            UnidadSugerida = AlmacenCatalog.NormalizarUnidadMedidaProducto(dto.UnidadSugerida),
            Activo = true,
        };
        _context.AlmacenProductos.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(MapProducto(entity));
    }

    [HttpPut("productos/{id:int}")]
    public async Task<ActionResult<AlmacenProductoDto>> UpdateProducto(int id, [FromBody] AlmacenProductoDto dto)
    {
        var entity = await _context.AlmacenProductos.FindAsync(id);
        if (entity == null || !entity.Activo) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Nombre))
            return BadRequest(new { message = "El nombre del producto es obligatorio." });
        if (string.IsNullOrWhiteSpace(dto.TipoRequisicion))
            return BadRequest(new { message = "La categoría del producto es obligatoria." });

        var tipo = dto.TipoRequisicion.Trim();
        if (!AlmacenCatalog.TiposRequisicion.Any(t => t.Id == tipo))
            return BadRequest(new { message = "Categoría de producto no válida." });

        var nombre = dto.Nombre.Trim();
        var duplicado = await _context.AlmacenProductos
            .AnyAsync(p => p.Activo && p.Id != id && p.Nombre.ToLower() == nombre.ToLower());
        if (duplicado)
            return BadRequest(new { message = "Ya existe otro producto con ese nombre." });

        entity.Nombre = nombre;
        entity.TipoRequisicionId = tipo;
        entity.Descripcion = LimpiarTextoOpcional(dto.Descripcion, 500);
        entity.CostoEstandar = dto.CostoEstandar;
        entity.UnidadSugerida = AlmacenCatalog.NormalizarUnidadMedidaProducto(dto.UnidadSugerida);

        await _context.SaveChangesAsync();
        return Ok(MapProducto(entity));
    }

    [HttpDelete("productos/{id:int}")]
    public async Task<IActionResult> DeleteProducto(int id)
    {
        var entity = await _context.AlmacenProductos.FindAsync(id);
        if (entity == null || !entity.Activo) return NotFound();

        var enUso = await _context.AlmacenRequisiciones.AnyAsync(r => r.ProductoId == id);
        if (enUso)
            return BadRequest(new { message = "No se puede eliminar: el producto está asociado a requisiciones." });

        entity.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("productos/importar-excel")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AlmacenImportarProductosResultDto>> ImportarProductosExcel([FromForm] FileUploadDto dto)
    {
        var file = dto.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No se ha subido ningún archivo." });

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase) && !ext.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "El archivo debe ser Excel (.xlsx o .xls)." });

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

            using var package = new ExcelPackage(stream);
            var worksheet = package.Workbook.Worksheets.FirstOrDefault(w => w.Dimension != null)
                            ?? package.Workbook.Worksheets.FirstOrDefault();
            if (worksheet?.Dimension == null)
                return BadRequest(new { message = "El archivo Excel no contiene datos." });

            var columnas = DetectarColumnasProducto(worksheet);
            if (columnas == null)
                return BadRequest(new { message = "No se encontraron las columnas del catálogo de productos (nombre, descripción, costo, unidad, categoría)." });

            var filas = ExtraerProductosDesdeExcel(worksheet, columnas, out var filasVacias, out var filasInvalidas);
            if (filas.Count == 0)
                return BadRequest(new { message = "No se encontraron productos válidos en el archivo." });

            var existentes = await _context.AlmacenProductos.AsNoTracking().Select(p => p.Nombre).ToListAsync();
            var yaRegistrados = new HashSet<string>(
                existentes.Select(NormalizarNombreProducto),
                StringComparer.OrdinalIgnoreCase);

            var importados = new List<AlmacenProducto>();
            var omitidos = 0;
            var vistosEnArchivo = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var fila in filas)
            {
                var clave = NormalizarNombreProducto(fila.Nombre);
                if (!vistosEnArchivo.Add(clave) || yaRegistrados.Contains(clave))
                {
                    omitidos++;
                    continue;
                }

                yaRegistrados.Add(clave);
                var entity = new AlmacenProducto
                {
                    Nombre = fila.Nombre,
                    Descripcion = fila.Descripcion,
                    CostoEstandar = fila.CostoEstandar,
                    TipoRequisicionId = fila.TipoRequisicionId,
                    UnidadSugerida = fila.UnidadSugerida,
                    Activo = true,
                };
                _context.AlmacenProductos.Add(entity);
                importados.Add(entity);
            }

            if (importados.Count > 0)
                await _context.SaveChangesAsync();

            return Ok(new AlmacenImportarProductosResultDto
            {
                Importados = importados.Count,
                OmitidosDuplicados = omitidos,
                FilasVacias = filasVacias,
                FilasInvalidas = filasInvalidas,
                Productos = importados.Select(MapProducto).OrderBy(p => p.Nombre).ToList(),
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al leer el Excel: {ex.Message}" });
        }
    }

    [HttpGet("proveedores")]
    public async Task<ActionResult<IEnumerable<AlmacenProveedorDto>>> GetProveedores([FromQuery] string? q, [FromQuery] int limit = 50)
    {
        var query = _context.AlmacenProveedores.AsNoTracking().Where(p => p.Activo);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            var nit = q.Replace(" ", "");
            query = query.Where(p =>
                p.Nombre.ToLower().Contains(term) ||
                p.Nit.Replace(" ", "").Contains(nit));
        }

        var data = await query.OrderBy(p => p.Nombre).Take(Math.Clamp(limit, 1, 5000)).ToListAsync();
        return Ok(data.Select(MapProveedor));
    }

    [HttpPost("proveedores/importar-excel")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<AlmacenImportarProveedoresResultDto>> ImportarProveedoresExcel([FromForm] FileUploadDto dto)
    {
        var file = dto.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No se ha subido ningún archivo." });

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".xlsx", StringComparison.OrdinalIgnoreCase) && !ext.Equals(".xls", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "El archivo debe ser Excel (.xlsx o .xls)." });

        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

            using var package = new ExcelPackage(stream);
            var worksheet = package.Workbook.Worksheets.FirstOrDefault(w => w.Dimension != null)
                            ?? package.Workbook.Worksheets.FirstOrDefault();
            if (worksheet?.Dimension == null)
                return BadRequest(new { message = "El archivo Excel no contiene datos." });

            var columnas = DetectarColumnasProveedor(worksheet);
            if (columnas == null)
                return BadRequest(new { message = "No se encontraron las columnas del catálogo de proveedores (nombre, correo, teléfonos, NIT, dirección)." });

            var filas = ExtraerProveedoresDesdeExcel(worksheet, columnas, out var filasVacias, out var filasInvalidas);
            if (filas.Count == 0)
                return BadRequest(new { message = "No se encontraron proveedores válidos en el archivo." });

            var filasConNit = filas.Count(f => !string.IsNullOrWhiteSpace(f.Nit));
            var filasConTelefono = filas.Count(f =>
                !string.IsNullOrWhiteSpace(f.TelefonoMovil) || !string.IsNullOrWhiteSpace(f.TelefonoTrabajo));
            var filasConCorreo = filas.Count(f => !string.IsNullOrWhiteSpace(f.Correo));

            var existentesDb = await _context.AlmacenProveedores.Where(p => p.Activo).ToListAsync();
            var porNombre = existentesDb.ToDictionary(
                p => NormalizarNombreProveedor(p.Nombre),
                p => p,
                StringComparer.OrdinalIgnoreCase);

            var importados = new List<AlmacenProveedor>();
            var actualizados = new List<AlmacenProveedor>();
            var omitidos = 0;
            var vistosEnArchivo = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var fila in filas)
            {
                var clave = NormalizarNombreProveedor(fila.Nombre);
                if (!vistosEnArchivo.Add(clave))
                {
                    omitidos++;
                    continue;
                }

                if (porNombre.TryGetValue(clave, out var existente))
                {
                    if (RellenarProveedorDesdeFila(existente, fila))
                        actualizados.Add(existente);
                    else
                        omitidos++;
                    continue;
                }

                var entity = CrearProveedorDesdeFila(fila);
                _context.AlmacenProveedores.Add(entity);
                porNombre[clave] = entity;
                importados.Add(entity);
            }

            if (importados.Count > 0 || actualizados.Count > 0)
                await _context.SaveChangesAsync();

            var proveedoresRespuesta = importados
                .Concat(actualizados)
                .Select(MapProveedor)
                .OrderBy(p => p.Nombre)
                .ToList();

            return Ok(new AlmacenImportarProveedoresResultDto
            {
                Importados = importados.Count,
                Actualizados = actualizados.Count,
                OmitidosDuplicados = omitidos,
                FilasVacias = filasVacias,
                FilasInvalidas = filasInvalidas,
                FilasConNit = filasConNit,
                FilasConTelefono = filasConTelefono,
                FilasConCorreo = filasConCorreo,
                ColumnasDetectadas = DescribirColumnasProveedor(columnas),
                Proveedores = proveedoresRespuesta,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al leer el Excel: {ex.Message}" });
        }
    }

    [HttpPost("proveedores")]
    public async Task<ActionResult<AlmacenProveedorDto>> CreateProveedor([FromBody] AlmacenProveedorDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre))
            return BadRequest(new { message = "El nombre del proveedor es obligatorio." });

        var entity = new AlmacenProveedor
        {
            Nombre = dto.Nombre.Trim(),
            Nit = dto.Nit?.Trim() ?? "",
            Correo = LimpiarTextoOpcional(dto.Correo, 200),
            TelefonoTrabajo = LimpiarTextoOpcional(dto.TelefonoTrabajo, 50),
            TelefonoMovil = LimpiarTextoOpcional(dto.TelefonoMovil, 50),
            Direccion = LimpiarTextoOpcional(dto.Direccion, 500),
            Categoria = LimpiarTextoOpcional(dto.Categoria, 50),
            ResponsableIva = dto.ResponsableIva,
            Activo = true,
        };
        AplicarTelefonoPrincipal(entity);
        _context.AlmacenProveedores.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(MapProveedor(entity));
    }

    [HttpPut("proveedores/{id:int}")]
    public async Task<ActionResult<AlmacenProveedorDto>> UpdateProveedor(int id, [FromBody] AlmacenProveedorDto dto)
    {
        var entity = await _context.AlmacenProveedores.FindAsync(id);
        if (entity == null) return NotFound();

        if (string.IsNullOrWhiteSpace(dto.Nombre))
            return BadRequest(new { message = "El nombre del proveedor es obligatorio." });

        entity.Nombre = dto.Nombre.Trim();
        entity.Nit = dto.Nit?.Trim() ?? "";
        entity.Correo = LimpiarTextoOpcional(dto.Correo, 200);
        entity.TelefonoTrabajo = LimpiarTextoOpcional(dto.TelefonoTrabajo, 50);
        entity.TelefonoMovil = LimpiarTextoOpcional(dto.TelefonoMovil, 50);
        entity.Direccion = LimpiarTextoOpcional(dto.Direccion, 500);
        entity.Categoria = LimpiarTextoOpcional(dto.Categoria, 50);
        entity.ResponsableIva = dto.ResponsableIva;
        AplicarTelefonoPrincipal(entity);

        await SincronizarProveedorEnPedidosAsync(id, entity);
        await _context.SaveChangesAsync();
        return Ok(MapProveedor(entity));
    }

    [HttpDelete("proveedores/{id:int}")]
    public async Task<IActionResult> DeleteProveedor(int id)
    {
        var entity = await _context.AlmacenProveedores.FindAsync(id);
        if (entity == null) return NotFound();

        var enUso = await _context.AlmacenPedidoProveedores
            .AnyAsync(p => p.ProveedorCatalogoId == id);
        if (enUso)
            return BadRequest(new { message = "No se puede eliminar: el proveedor está asociado a pedidos." });

        entity.Activo = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Vacía el catálogo de proveedores para reimportar desde cero.</summary>
    [HttpDelete("proveedores/todos")]
    public async Task<ActionResult> VaciarCatalogoProveedores()
    {
        await _service.VaciarCatalogoProveedoresAsync();
        return Ok(new { message = "Catálogo de proveedores vaciado. Puede importar o crear proveedores nuevos." });
    }

    [HttpGet("ordenes-produccion")]
    public async Task<ActionResult<IEnumerable<AlmacenOrdenProduccionDto>>> BuscarOrdenesProduccion([FromQuery] string? q, [FromQuery] int limit = 30)
    {
        var query = _context.CatalogoOrdenesProduccion.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            var digits = new string(q.Where(char.IsDigit).ToArray());
            query = query.Where(x =>
                x.Numero.Contains(digits) ||
                (x.Cliente != null && x.Cliente.ToLower().Contains(term)) ||
                (x.Referencia != null && x.Referencia.ToLower().Contains(term)));
        }

        var rows = await query
            .OrderByDescending(x => x.Anio)
            .ThenByDescending(x => x.Mes)
            .ThenBy(x => x.Numero)
            .Take(Math.Clamp(limit, 1, 100))
            .ToListAsync();

        return Ok(rows.Select(x => new AlmacenOrdenProduccionDto
        {
            Id = x.Id.ToString(),
            Numero = $"OP-{x.Numero}",
            Cliente = x.Cliente ?? "",
            Referencia = x.Referencia ?? "",
        }));
    }

    [HttpGet("requisiciones")]
    public async Task<ActionResult<IEnumerable<AlmacenRequisicionDto>>> GetRequisiciones(
        [FromQuery] string? tipo,
        [FromQuery] string? estado,
        [FromQuery] string? q)
    {
        var query = _context.AlmacenRequisiciones.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(tipo))
            query = query.Where(r => r.TipoRequisicionId == tipo);
        if (!string.IsNullOrWhiteSpace(estado) && estado != "todos")
            query = query.Where(r => r.Estado == estado);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(r =>
                r.Codigo.ToLower().Contains(term) ||
                r.OrdenProduccionNumero.ToLower().Contains(term) ||
                r.Cliente.ToLower().Contains(term) ||
                r.ProductoNombre.ToLower().Contains(term) ||
                (r.Observacion != null && r.Observacion.ToLower().Contains(term)) ||
                _context.AlmacenRequisicionComentarios.Any(c =>
                    c.RequisicionId == r.Id && c.Texto.ToLower().Contains(term)));
        }

        var ids = await query
            .OrderByDescending(r => r.Id)
            .Select(r => r.Id)
            .ToListAsync();

        var result = new List<AlmacenRequisicionDto>();
        foreach (var id in ids)
        {
            var full = await _service.CargarRequisicionCompletaAsync(id);
            if (full != null) result.Add(_service.MapRequisicion(full));
        }
        await _context.SaveChangesAsync();
        return Ok(result);
    }

    [HttpGet("requisiciones/{id:int}")]
    public async Task<ActionResult<AlmacenRequisicionDto>> GetRequisicion(int id)
    {
        var entity = await _service.CargarRequisicionCompletaAsync(id);
        if (entity == null) return NotFound();
        await _context.SaveChangesAsync();
        return Ok(_service.MapRequisicion(entity));
    }

    [HttpPost("requisiciones")]
    public async Task<ActionResult<AlmacenRequisicionDto>> CreateRequisicion([FromBody] AlmacenRequisicionWriteDto dto)
    {
        try
        {
            var error = ValidarRequisicionWrite(dto);
            if (error != null) return BadRequest(new { message = error });

            var producto = await ResolverProductoAsync(dto.ProductoId);
            var op = await ResolverOrdenProduccionAsync(dto);
            var usuario = ObtenerUsuarioActual();

            var entity = new AlmacenRequisicion
            {
                Codigo = await _service.GenerarCodigoRequisicionAsync(),
                TipoRequisicionId = dto.TipoRequisicionId!.Trim(),
                FechaSolicitud = AlmacenService.ParseFecha(dto.FechaSolicitud, DateTime.UtcNow.Date),
                OrdenProduccionNumero = op.numero,
                CatalogoOpId = op.catalogoId,
                Cliente = op.cliente,
                Referencia = op.referencia,
                ProductoId = producto?.Id,
                ProductoNombre = producto?.Nombre ?? dto.ProductoId ?? "",
                Cantidad = dto.Cantidad!.Value,
                Unidad = dto.Unidad!.Trim(),
                FechaRequerida = AlmacenService.ParseFecha(dto.FechaRequerida, DateTime.UtcNow.Date),
                Observacion = string.IsNullOrWhiteSpace(dto.Observacion) ? null : dto.Observacion.Trim(),
                Estado = "Pendiente",
                FechaRegistro = DateTime.UtcNow,
                CreadoPorId = usuario.id,
                CreadoPorNombre = string.IsNullOrWhiteSpace(usuario.nombre) ? null : usuario.nombre,
            };

            _context.AlmacenRequisiciones.Add(entity);
            await _context.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(dto.Observacion))
            {
                await _service.AgregarComentarioRequisicionAsync(
                    entity.Id,
                    new AlmacenRequisicionComentarioWriteDto { Texto = dto.Observacion.Trim() },
                    usuario.id,
                    usuario.nombre);
            }

            var loaded = await _service.CargarRequisicionCompletaAsync(entity.Id);
            var mapped = _service.MapRequisicion(loaded!);
            EncolarCorreo(m => m.NotificarNuevaRequisicionAsync(mapped));
            return Ok(mapped);
        }
        catch (DbUpdateException ex)
        {
            return StatusCode(500, new { message = $"Error al guardar requisición: {ex.InnerException?.Message ?? ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al guardar requisición: {ex.Message}" });
        }
    }

    [HttpPut("requisiciones/{id:int}")]
    public async Task<ActionResult<AlmacenRequisicionDto>> UpdateRequisicion(int id, [FromBody] AlmacenRequisicionWriteDto dto)
    {
        var entity = await _context.AlmacenRequisiciones.FindAsync(id);
        if (entity == null) return NotFound();
        if (entity.Estado != "Pendiente")
            return BadRequest(new { message = "Solo se pueden editar requisiciones en estado Pendiente." });

        var error = ValidarRequisicionWrite(dto);
        if (error != null) return BadRequest(new { message = error });

        var producto = await ResolverProductoAsync(dto.ProductoId);
        var op = await ResolverOrdenProduccionAsync(dto);

        entity.TipoRequisicionId = dto.TipoRequisicionId!.Trim();
        entity.FechaSolicitud = AlmacenService.ParseFecha(dto.FechaSolicitud, entity.FechaSolicitud);
        entity.OrdenProduccionNumero = op.numero;
        entity.CatalogoOpId = op.catalogoId;
        entity.Cliente = op.cliente;
        entity.Referencia = op.referencia;
        entity.ProductoId = producto?.Id;
        entity.ProductoNombre = producto?.Nombre ?? dto.ProductoId ?? "";
        entity.Cantidad = dto.Cantidad!.Value;
        entity.Unidad = dto.Unidad!.Trim();
        entity.FechaRequerida = AlmacenService.ParseFecha(dto.FechaRequerida, entity.FechaRequerida);

        await _context.SaveChangesAsync();
        var loaded = await _service.CargarRequisicionCompletaAsync(id);
        return Ok(_service.MapRequisicion(loaded!));
    }

    [HttpGet("requisiciones/{id:int}/comentarios")]
    public async Task<ActionResult<IEnumerable<AlmacenRequisicionComentarioDto>>> GetComentariosRequisicion(int id)
    {
        var exists = await _context.AlmacenRequisiciones.AsNoTracking().AnyAsync(r => r.Id == id);
        if (!exists) return NotFound();
        var list = await _service.ListarComentariosRequisicionAsync(id);
        return Ok(list);
    }

    [HttpPost("requisiciones/{id:int}/comentarios")]
    public async Task<ActionResult<AlmacenRequisicionComentarioDto>> AgregarComentarioRequisicion(
        int id,
        [FromBody] AlmacenRequisicionComentarioWriteDto dto)
    {
        try
        {
            var usuario = ObtenerUsuarioActual();
            var comentario = await _service.AgregarComentarioRequisicionAsync(id, dto, usuario.id, usuario.nombre);
            return Ok(comentario);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("ordenes-compra")]
    public async Task<ActionResult<IEnumerable<AlmacenOrdenCompraDto>>> GetOrdenesCompra(
        [FromQuery] string? estado = null,
        [FromQuery] string? proveedorCatalogoId = null,
        [FromQuery] string? nombreProveedor = null,
        [FromQuery] string? nit = null)
    {
        int? catalogoId = null;
        if (!string.IsNullOrWhiteSpace(proveedorCatalogoId) && int.TryParse(proveedorCatalogoId, out var cid))
            catalogoId = cid;

        var list = await _service.ListarOrdenesCompraAsync(estado, catalogoId, nombreProveedor, nit);
        return Ok(list);
    }

    [HttpGet("ordenes-compra/{id:int}")]
    public async Task<ActionResult<AlmacenOrdenCompraDto>> GetOrdenCompra(int id)
    {
        var oc = await _service.CargarOrdenCompraCompletaAsync(id);
        if (oc == null) return NotFound();
        return Ok(_service.MapOrdenCompra(oc));
    }

    /// <summary>Provisional: corrige OCs asignadas al proveedor equivocado (mismo NIT, distinto nombre).</summary>
    [HttpPost("ordenes-compra/reparar-asignaciones")]
    public async Task<ActionResult<object>> RepararAsignacionesOrdenCompra()
    {
        var usuario = ObtenerUsuarioActual();
        var n = await _service.RepararOrdenesCompraProveedorMalAsignadasAsync(usuario.id, usuario.nombre);
        return Ok(new { reparados = n });
    }

    [HttpPost("ordenes-compra/consolidar")]
    public async Task<ActionResult<AlmacenConsolidarPedidoResultDto>> ConsolidarPedido(
        [FromBody] AlmacenConsolidarPedidoWriteDto dto)
    {
        try
        {
            var usuario = ObtenerUsuarioActual();
            var result = await _service.ConsolidarPedidoAsync(dto, usuario.id, usuario.nombre);

            foreach (var req in result.Requisiciones)
            {
                var copia = req;
                EncolarCorreo(m => m.NotificarPedidoAsync(copia));
            }

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return StatusCode(500, new { message = $"Error al consolidar pedido: {ex.InnerException?.Message ?? ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al consolidar pedido: {ex.Message}" });
        }
    }

    [HttpPut("requisiciones/{id:int}/pedido")]
    public async Task<ActionResult<AlmacenRequisicionDto>> GuardarPedido(int id, [FromBody] AlmacenPedidoWriteDto dto)
    {
        try
        {
            var entity = await _service.CargarRequisicionCompletaAsync(id);
            if (entity == null) return NotFound();
            if (entity.Estado == "En Almacen")
                return BadRequest(new { message = "La requisición ya está en almacén; el pedido es de solo lectura." });

            var proveedores = (dto.Proveedores ?? new List<AlmacenProveedorPedidoWriteDto>())
                .Where(p => !string.IsNullOrWhiteSpace(p.Nombre) && p.Cantidad > 0)
                .ToList();
            if (proveedores.Count == 0)
                return BadRequest(new { message = "Agregue al menos un proveedor con cantidad." });

            if (proveedores.Count > 1 && proveedores.Any(p => string.IsNullOrWhiteSpace(p.FechaEntregaEstimada)))
                return BadRequest(new { message = "Cada proveedor debe tener fecha estimada de entrega." });

            foreach (var p in proveedores)
            {
                if (p.PrecioEspecial == true && string.IsNullOrWhiteSpace(p.ComentarioPrecioEspecial))
                    return BadRequest(new { message = $"Indique el motivo del precio especial para «{p.Nombre}»." });
            }

            var existentesPorId = entity.Pedido?.Proveedores.ToDictionary(p => p.Id)
                ?? new Dictionary<int, AlmacenPedidoProveedor>();
            var usuario = ObtenerUsuarioActual();

            if (entity.Pedido == null)
            {
                entity.Pedido = new AlmacenPedido
                {
                    RequisicionId = entity.Id,
                    FechaPedido = AlmacenService.ParseFecha(dto.FechaPedido, DateTime.UtcNow.Date),
                    PrecioUnitario = dto.PrecioUnitario,
                    ProcesadoPorId = usuario.id,
                    ProcesadoPorNombre = string.IsNullOrWhiteSpace(usuario.nombre) ? null : usuario.nombre,
                };
                _context.AlmacenPedidos.Add(entity.Pedido);
            }
            else
            {
                entity.Pedido.FechaPedido = AlmacenService.ParseFecha(dto.FechaPedido, entity.Pedido.FechaPedido);
                entity.Pedido.PrecioUnitario = dto.PrecioUnitario;
                entity.Pedido.ProcesadoPorId = usuario.id;
                entity.Pedido.ProcesadoPorNombre = string.IsNullOrWhiteSpace(usuario.nombre) ? null : usuario.nombre;
            }

            var keepIds = new HashSet<int>();
            var catalogosGuardados = new List<AlmacenProveedor?>();
            var nuevosProveedores = new List<(AlmacenPedidoProveedor Prov, string? AgregarOcId)>();

            foreach (var p in proveedores)
            {
                int? catalogoIdHint = null;
                if (!string.IsNullOrWhiteSpace(p.CatalogoId) && int.TryParse(p.CatalogoId, out var cid))
                    catalogoIdHint = cid;

                var catalogoEntity = await _service.UpsertProveedorCatalogoDesdePedidoAsync(
                    p.Nombre!.Trim(),
                    p.Nit,
                    p.Telefono,
                    catalogoIdHint,
                    p.Categoria,
                    p.ResponsableIva);
                catalogosGuardados.Add(catalogoEntity);
            }

            await _context.SaveChangesAsync();

            for (var i = 0; i < proveedores.Count; i++)
            {
                var p = proveedores[i];
                var catalogoId = catalogosGuardados[i]?.Id;

                var fechaEntrega = string.IsNullOrWhiteSpace(p.FechaEntregaEstimada)
                    ? AlmacenService.ParseFecha(dto.FechaEntregaEstimada, (DateTime?)null)
                    : AlmacenService.ParseFecha(p.FechaEntregaEstimada, DateTime.UtcNow.Date);

                if (!string.IsNullOrWhiteSpace(p.Id)
                    && int.TryParse(p.Id, out var provId)
                    && existentesPorId.TryGetValue(provId, out var existente))
                {
                    existente.ProveedorCatalogoId = catalogoId;
                    existente.Nombre = p.Nombre!.Trim();
                    existente.Nit = p.Nit?.Trim();
                    existente.Telefono = p.Telefono?.Trim();
                    existente.Cantidad = p.Cantidad;
                    existente.PrecioUnitario = p.PrecioUnitario;
                    existente.PrecioEspecial = p.PrecioEspecial == true;
                    existente.ComentarioPrecioEspecial = string.IsNullOrWhiteSpace(p.ComentarioPrecioEspecial)
                        ? null
                        : p.ComentarioPrecioEspecial.Trim();
                    existente.FechaEntregaEstimada = fechaEntrega;
                    existente.Recibido = p.Recibido ?? existente.Recibido;
                    existente.ProformaUrl = string.IsNullOrWhiteSpace(p.ProformaUrl) ? null : p.ProformaUrl.Trim();
                    existente.ProformaNombre = string.IsNullOrWhiteSpace(p.ProformaNombre) ? null : p.ProformaNombre.Trim();
                    keepIds.Add(provId);
                    continue;
                }

                var nuevoProv = new AlmacenPedidoProveedor
                {
                    ProveedorCatalogoId = catalogoId,
                    Nombre = p.Nombre!.Trim(),
                    Nit = p.Nit?.Trim(),
                    Telefono = p.Telefono?.Trim(),
                    Cantidad = p.Cantidad,
                    PrecioUnitario = p.PrecioUnitario,
                    PrecioEspecial = p.PrecioEspecial == true,
                    ComentarioPrecioEspecial = string.IsNullOrWhiteSpace(p.ComentarioPrecioEspecial)
                        ? null
                        : p.ComentarioPrecioEspecial.Trim(),
                    FechaEntregaEstimada = fechaEntrega,
                    Recibido = p.Recibido ?? false,
                    ProformaUrl = string.IsNullOrWhiteSpace(p.ProformaUrl) ? null : p.ProformaUrl.Trim(),
                    ProformaNombre = string.IsNullOrWhiteSpace(p.ProformaNombre) ? null : p.ProformaNombre.Trim(),
                };
                entity.Pedido.Proveedores.Add(nuevoProv);
                nuevosProveedores.Add((nuevoProv, p.AgregarAOrdenCompraId));
            }

            foreach (var prov in entity.Pedido.Proveedores.ToList())
            {
                if (keepIds.Contains(prov.Id)) continue;
                // Proveedores recién agregados aún tienen Id temporal (0); no eliminar.
                if (prov.Id == 0) continue;
                _service.EliminarProveedorDelPedido(entity, prov);
            }

            _service.RecalcularEstadosProveedoresDesdeLineas(entity);
            _service.NormalizarFechaEntregaPedido(entity.Pedido);

            await _context.SaveChangesAsync();

            foreach (var (nuevoProv, agregarOcId) in nuevosProveedores)
            {
                var oc = await _service.ResolverOrdenCompraParaPedidoAsync(
                    agregarOcId,
                    nuevoProv.ProveedorCatalogoId,
                    nuevoProv.Nombre,
                    nuevoProv.Nit,
                    nuevoProv.Telefono,
                    entity.Pedido.FechaPedido,
                    nuevoProv.FechaEntregaEstimada,
                    usuario.id,
                    usuario.nombre);
                await _context.SaveChangesAsync();
                await _service.VincularPedidoProveedorAOrdenCompraAsync(oc, nuevoProv, entity.Id);
                _service.ActualizarFechaEntregaOrdenCompra(oc);
            }

            await _context.SaveChangesAsync();
            var loaded = await _service.CargarRequisicionCompletaAsync(id);
            var mapped = _service.MapRequisicion(loaded!);
            var esParcial = mapped.Estado == "Parcial";
            EncolarCorreo(m => esParcial ? m.NotificarPedidoParcialRestanteAsync(mapped) : m.NotificarPedidoAsync(mapped));
            return Ok(mapped);
        }
        catch (DbUpdateException ex)
        {
            return StatusCode(500, new { message = $"Error al guardar pedido: {ex.InnerException?.Message ?? ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al guardar pedido: {ex.Message}" });
        }
    }

    [HttpPost("upload-proforma")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult> UploadProforma([FromForm] FileUploadDto dto)
    {
        var file = dto.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No se recibió ningún archivo." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var permitidos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".jpg", ".jpeg", ".png", ".webp"
        };
        if (!permitidos.Contains(ext))
            return BadRequest(new { message = "Formato no permitido. Use PDF, JPG, PNG o WEBP." });

        const long maxBytes = 15 * 1024 * 1024;
        if (file.Length > maxBytes)
            return BadRequest(new { message = "El archivo supera el tamaño máximo de 15 MB." });

        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", "proformas_almacen");
        Directory.CreateDirectory(uploadsFolder);

        var uniqueFileName = Guid.NewGuid().ToString() + ext;
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(new
        {
            url = $"/uploads/proformas_almacen/{uniqueFileName}",
            nombre = file.FileName,
        });
    }

    [HttpPatch("requisiciones/{id:int}/pedido/proveedores/{proveedorId:int}/pagado")]
    public async Task<ActionResult<AlmacenRequisicionDto>> MarcarProveedorPagado(
        int id,
        int proveedorId,
        [FromBody] AlmacenMarcarPagadoDto dto)
    {
        try
        {
            var entity = await _service.CargarRequisicionCompletaAsync(id);
            if (entity?.Pedido == null) return NotFound(new { message = "No hay pedido para esta requisición." });

            var prov = entity.Pedido.Proveedores.FirstOrDefault(p => p.Id == proveedorId);
            if (prov == null) return NotFound(new { message = "Proveedor no encontrado en el pedido." });

            if (dto.Pagado)
            {
                var forma = (dto.FormaPago ?? "").Trim().ToLowerInvariant();
                if (forma is not ("credito" or "efectivo" or "contado"))
                    return BadRequest(new { message = "Indique la forma de pago: credito, efectivo o contado." });
                prov.Pagado = true;
                prov.FormaPago = forma;
            }
            else
            {
                prov.Pagado = false;
                prov.FormaPago = null;
            }
            await _context.SaveChangesAsync();

            var loaded = await _service.CargarRequisicionCompletaAsync(id);
            return Ok(_service.MapRequisicion(loaded!));
        }
        catch (DbUpdateException ex)
        {
            return StatusCode(500, new { message = $"Error al actualizar pago: {ex.InnerException?.Message ?? ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error al actualizar pago: {ex.Message}" });
        }
    }

    [HttpPost("requisiciones/{id:int}/recepciones")]
    public async Task<ActionResult<AlmacenRequisicionDto>> RegistrarRecepcion(int id, [FromBody] AlmacenRecepcionLineaWriteDto dto)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        try
        {
            return await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _context.Database.BeginTransactionAsync();

                var entity = await _context.AlmacenRequisiciones
                    .Include(r => r.Pedido!)
                        .ThenInclude(p => p.Proveedores)
                    .Include(r => r.RecepcionLineas)
                    .FirstOrDefaultAsync(r => r.Id == id);

                if (entity == null) return (ActionResult<AlmacenRequisicionDto>)NotFound();
                if (entity.Pedido == null)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "La requisición no tiene pedido registrado." });
                if (entity.Estado != "Pedido" && entity.Estado != "Parcial" && entity.Estado != "En Almacen")
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Solo se puede recibir mercancía de requisiciones en estado Pedido o Parcial." });
                if (!_service.TieneSaldoPendienteRecepcion(entity))
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Este pedido ya no tiene saldo pendiente por recibir." });

                if (!int.TryParse(dto.ProveedorId, out var proveedorPedidoId))
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Proveedor inválido." });

                var prov = entity.Pedido.Proveedores.FirstOrDefault(p => p.Id == proveedorPedidoId);
                if (prov == null || prov.Recibido)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "El proveedor no existe o ya fue recibido completamente." });

                if (string.IsNullOrWhiteSpace(dto.CodigoUsuario))
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Indique el código de recepción." });
                if (dto.CantidadRecibida <= 0)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "La cantidad recibida debe ser mayor a cero." });
                if (!dto.CalidadEsperada && string.IsNullOrWhiteSpace(dto.MotivoCalidadNo))
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Indique el motivo si la calidad no es la esperada." });
                if (!dto.FacturaEntregada && string.IsNullOrWhiteSpace(dto.MotivoFacturaNo))
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Indique el motivo si no entregó factura." });

                var codigo = dto.CodigoUsuario.Trim();
                var usuario = ObtenerUsuarioActual();
                _service.ReconciliarCantidadesPedidoOriginal(entity);
                var yaRecibido = _service.CantidadRecibidaProveedor(entity, proveedorPedidoId);
                var pedidoOriginal = _service.InferirCantidadPedidaProveedor(entity, prov);
                if (pedidoOriginal <= 0)
                    pedidoOriginal = prov.Cantidad > 0 ? prov.Cantidad : dto.CantidadPedidaEnMomento;
                var saldoPendiente = Math.Max(0, pedidoOriginal - yaRecibido);

                if (saldoPendiente <= 0)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Este proveedor ya no tiene saldo pendiente por recibir." });

                if (dto.CantidadRecibida > saldoPendiente + 0.0001m)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new
                    {
                        message = $"La cantidad recibida ({dto.CantidadRecibida}) supera el saldo pendiente ({saldoPendiente}).",
                    });

                var duplicada = entity.RecepcionLineas.Any(l =>
                    l.PedidoProveedorId == proveedorPedidoId &&
                    string.Equals(l.CodigoUsuario.Trim(), codigo, StringComparison.OrdinalIgnoreCase));
                if (duplicada)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Ya existe una recepción con ese código para este proveedor." });

                var totalTrasLinea = yaRecibido + dto.CantidadRecibida;
                // Solo marcar completo si el usuario lo indicó explícitamente (Sí = llegó todo el saldo).
                var pedidoCompletoEfectivo =
                    dto.PedidoCompleto && dto.CantidadRecibida >= saldoPendiente - 0.0001m;

                if (dto.PedidoCompleto && dto.CantidadRecibida < saldoPendiente - 0.0001m)
                    return (ActionResult<AlmacenRequisicionDto>)BadRequest(new
                    {
                        message = "Si indica llegada completa, la cantidad debe ser todo el saldo pendiente de este proveedor.",
                    });

                if (!pedidoCompletoEfectivo)
                {
                    if (string.IsNullOrWhiteSpace(dto.MotivoCantidadParcial))
                        return (ActionResult<AlmacenRequisicionDto>)BadRequest(new { message = "Indique el motivo de la cantidad parcial." });
                }

                var linea = new AlmacenRecepcionLinea
                {
                    RequisicionId = entity.Id,
                    PedidoProveedorId = proveedorPedidoId,
                    NombreProveedor = prov.Nombre,
                    CodigoUsuario = codigo,
                    RegistradoPorNombre = string.IsNullOrWhiteSpace(usuario.nombre) ? null : usuario.nombre,
                    FechaLlegada = AlmacenService.ParseFecha(dto.FechaLlegada, DateTime.UtcNow.Date),
                    CalidadEsperada = dto.CalidadEsperada,
                    MotivoCalidadNo = dto.MotivoCalidadNo?.Trim(),
                    FacturaEntregada = dto.FacturaEntregada,
                    MotivoFacturaNo = dto.MotivoFacturaNo?.Trim(),
                    CantidadRecibida = dto.CantidadRecibida,
                    CantidadPedidaEnMomento = pedidoOriginal,
                    PedidoCompleto = pedidoCompletoEfectivo,
                    MotivoCantidadParcial = pedidoCompletoEfectivo ? null : dto.MotivoCantidadParcial?.Trim(),
                    NuevaFechaEntrega = pedidoCompletoEfectivo || string.IsNullOrWhiteSpace(dto.NuevaFechaEntrega)
                        ? null
                        : AlmacenService.ParseFecha(dto.NuevaFechaEntrega, DateTime.UtcNow.Date),
                    FechaRegistro = DateTime.UtcNow,
                };

                _context.AlmacenRecepcionLineas.Add(linea);
                entity.RecepcionLineas.Add(linea);

                if (pedidoCompletoEfectivo)
                {
                    prov.Recibido = true;
                    prov.Cantidad = totalTrasLinea;
                }

                _service.AplicarFechaRestoProveedor(prov, dto.NuevaFechaEntrega, pedidoCompletoEfectivo);
                _service.RecalcularEstadosProveedoresDesdeLineas(entity);
                _service.NormalizarFechaEntregaPedido(entity.Pedido);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                var loaded = await _service.CargarRequisicionCompletaAsync(id);
                var mapped = _service.MapRequisicion(loaded!);
                var saldoTras = pedidoCompletoEfectivo
                    ? 0m
                    : Math.Max(0, pedidoOriginal - totalTrasLinea);
                var notifRecepcion = new AlmacenRecepcionNotificacionDto
                {
                    NombreProveedor = prov.Nombre,
                    CodigoRecepcion = codigo,
                    FechaLlegada = AlmacenService.FormatoFecha(linea.FechaLlegada),
                    CantidadRecibida = dto.CantidadRecibida,
                    CantidadPedida = pedidoCompletoEfectivo ? pedidoOriginal : saldoPendiente,
                    SaldoPendienteTras = saldoTras,
                    PedidoCompleto = pedidoCompletoEfectivo,
                    CalidadEsperada = dto.CalidadEsperada,
                    MotivoCalidadNo = dto.MotivoCalidadNo?.Trim(),
                    FacturaEntregada = dto.FacturaEntregada,
                    MotivoFacturaNo = dto.MotivoFacturaNo?.Trim(),
                    MotivoCantidadParcial = dto.MotivoCantidadParcial?.Trim(),
                    NuevaFechaEntrega = pedidoCompletoEfectivo
                        ? null
                        : (string.IsNullOrWhiteSpace(dto.NuevaFechaEntrega)
                            ? null
                            : AlmacenService.FormatoFecha(AlmacenService.ParseFecha(dto.NuevaFechaEntrega, DateTime.UtcNow.Date))),
                };
                EncolarCorreo(m => m.NotificarRecepcionAsync(mapped, notifRecepcion));
                return (ActionResult<AlmacenRequisicionDto>)Ok(mapped);
            });
        }
        catch (DbUpdateException ex) when (EsViolacionUnicaRecepcion(ex))
        {
            return BadRequest(new { message = "Ya existe una recepción con ese código para este proveedor." });
        }
    }

    private static bool EsViolacionUnicaRecepcion(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("IX_Almacen_RecepcionLineas_Requisicion_Prov_Codigo", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("23505");
    }

    private static string NormalizarNombreProveedor(string nombre) =>
        AlmacenCatalog.NormalizarTextoClave(nombre);

    private static string? LimpiarTextoOpcional(string? valor, int maxLen)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var t = Regex.Replace(valor.Trim(), @"\s+", " ");
        return t.Length > maxLen ? t[..maxLen] : t;
    }

    private static string TelefonoPrincipalProveedor(AlmacenProveedor p)
    {
        if (!string.IsNullOrWhiteSpace(p.TelefonoMovil)) return p.TelefonoMovil.Trim();
        if (!string.IsNullOrWhiteSpace(p.TelefonoTrabajo)) return p.TelefonoTrabajo.Trim();
        return p.Telefono?.Trim() ?? "";
    }

    private static void AplicarTelefonoPrincipal(AlmacenProveedor p) =>
        p.Telefono = TelefonoPrincipalProveedor(p);

    private static AlmacenProveedor CrearProveedorDesdeFila(FilaProveedorExcel fila)
    {
        var entity = new AlmacenProveedor
        {
            Nombre = fila.Nombre,
            Correo = fila.Correo,
            TelefonoTrabajo = fila.TelefonoTrabajo,
            TelefonoMovil = fila.TelefonoMovil,
            Nit = fila.Nit ?? "",
            Direccion = fila.Direccion,
            Activo = true,
        };
        AplicarTelefonoPrincipal(entity);
        return entity;
    }

    private static bool RellenarProveedorDesdeFila(AlmacenProveedor entity, FilaProveedorExcel fila)
    {
        var cambio = false;
        if (!string.IsNullOrWhiteSpace(fila.Correo) && entity.Correo != fila.Correo)
        {
            entity.Correo = fila.Correo;
            cambio = true;
        }
        if (!string.IsNullOrWhiteSpace(fila.TelefonoTrabajo) && entity.TelefonoTrabajo != fila.TelefonoTrabajo)
        {
            entity.TelefonoTrabajo = fila.TelefonoTrabajo;
            cambio = true;
        }
        if (!string.IsNullOrWhiteSpace(fila.TelefonoMovil) && entity.TelefonoMovil != fila.TelefonoMovil)
        {
            entity.TelefonoMovil = fila.TelefonoMovil;
            cambio = true;
        }
        if (!string.IsNullOrWhiteSpace(fila.Nit) && entity.Nit != fila.Nit)
        {
            entity.Nit = fila.Nit;
            cambio = true;
        }
        if (!string.IsNullOrWhiteSpace(fila.Direccion) && entity.Direccion != fila.Direccion)
        {
            entity.Direccion = fila.Direccion;
            cambio = true;
        }
        if (cambio)
            AplicarTelefonoPrincipal(entity);
        return cambio;
    }

    private static string? LeerCeldaProveedor(ExcelRange cell, int maxLen)
    {
        var textoVisible = cell.Text?.Trim();
        if (!string.IsNullOrWhiteSpace(textoVisible))
            return LimpiarTextoOpcional(textoVisible, maxLen);

        var valor = cell.Value;
        if (valor == null)
            return null;

        var texto = valor switch
        {
            double d => d.ToString("0", System.Globalization.CultureInfo.InvariantCulture),
            decimal dec => dec.ToString("0", System.Globalization.CultureInfo.InvariantCulture),
            long l => l.ToString(System.Globalization.CultureInfo.InvariantCulture),
            int i => i.ToString(System.Globalization.CultureInfo.InvariantCulture),
            _ => Convert.ToString(valor, System.Globalization.CultureInfo.InvariantCulture) ?? "",
        };
        return LimpiarTextoOpcional(texto, maxLen);
    }

    private static bool CoincideEncabezadoProveedor(string? valor, params string[] aliases)
    {
        var v = AlmacenCatalog.NormalizarTextoClave(valor);
        if (string.IsNullOrEmpty(v)) return false;
        return aliases.Any(a =>
        {
            var alias = AlmacenCatalog.NormalizarTextoClave(a);
            if (string.IsNullOrEmpty(alias)) return false;
            return v == alias || v.StartsWith(alias) || alias.StartsWith(v);
        });
    }

    private static bool EsEncabezadoNombreProveedor(string? valor) =>
        ClasificarEncabezadoColumnaProveedor(valor) == "nombre";

    private static string? ClasificarEncabezadoColumnaProveedor(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;

        if (CoincideEncabezadoProveedor(
                valor,
                "telefono movil",
                "telefono móvil",
                "tel movil",
                "tel. movil",
                "tel movil",
                "celular",
                "movil",
                "móvil",
                "cel"))
            return "movil";

        if (CoincideEncabezadoProveedor(
                valor,
                "telefono de trabajo",
                "telefono trabajo",
                "tel trabajo",
                "tel. trabajo",
                "telfono trabajo",
                "telefono oficina",
                "tel oficina"))
            return "trabajo";

        if (CoincideEncabezadoProveedor(
                valor,
                "correo electronico",
                "correo electrónico",
                "correo electronico",
                "e-mail",
                "e mail",
                "email",
                "mail",
                "correo"))
            return "correo";

        if (CoincideEncabezadoProveedor(
                valor,
                "nit",
                "n.i.t",
                "n° nit",
                "no nit",
                "numero nit",
                "identificacion tributaria",
                "identificacion",
                "no identificacion",
                "numero identificacion",
                "documento",
                "no documento",
                "id tributaria",
                "# documento",
                "c.c",
                "cc",
                "c.c.",
                "cedula",
                "cédula"))
            return "nit";

        if (CoincideEncabezadoProveedor(
                valor,
                "direccion",
                "dirección",
                "address",
                "dirreccion",
                "domicilio",
                "ubicacion",
                "ubicación",
                "ciudad"))
            return "direccion";

        if (CoincideEncabezadoProveedor(
                valor,
                "telefono",
                "teléfono",
                "tel",
                "tel.",
                "fono",
                "phone",
                "contacto telefonico",
                "contacto telefónico"))
            return "telefono";

        if (CoincideEncabezadoProveedor(
                valor,
                "compañía",
                "compania",
                "razon social",
                "nombre del proveedor",
                "nombre proveedor",
                "nombre tercero",
                "tercero",
                "proveedor",
                "proveedores",
                "nombre",
                "company",
                "empresa"))
            return "nombre";

        return null;
    }

    private static bool PareceEmailProveedor(string? valor) =>
        !string.IsNullOrWhiteSpace(valor) && valor.Contains('@') && valor.Contains('.');

    private static bool PareceNitProveedor(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return false;
        var digits = Regex.Replace(valor, @"\D", "");
        return digits.Length is >= 6 and <= 15;
    }

    private static bool PareceTelefonoProveedor(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor) || PareceEmailProveedor(valor)) return false;
        var digits = Regex.Replace(valor, @"\D", "");
        return digits.Length is >= 7 and <= 15;
    }

    private sealed record ColumnasProveedorExcel(
        int Nombre,
        int Correo,
        int TelefonoTrabajo,
        int TelefonoMovil,
        int Nit,
        int Direccion,
        int FilaInicio);

    private sealed record FilaProveedorExcel(
        string Nombre,
        string? Correo,
        string? TelefonoTrabajo,
        string? TelefonoMovil,
        string? Nit,
        string? Direccion);

    private static string DescribirColumnasProveedor(ColumnasProveedorExcel c) =>
        $"Nombre col {c.Nombre}, Correo col {c.Correo}, Tel. trabajo col {c.TelefonoTrabajo}, " +
        $"Tel. móvil col {c.TelefonoMovil}, NIT col {c.Nit}, Dirección col {c.Direccion}, datos desde fila {c.FilaInicio}";

    private static int ResolverColumnaLibre(
        int? detectada,
        int nombreCol,
        int offsetSugerido,
        HashSet<int> usadas,
        int colCount)
    {
        if (detectada is > 0) return detectada.Value;
        for (var delta = 0; delta <= 12; delta++)
        {
            var col = nombreCol + offsetSugerido + delta;
            if (col <= colCount && !usadas.Contains(col)) return col;
        }
        return 0;
    }

    private static void InferirColumnasProveedorPorContenido(
        ExcelWorksheet ws,
        int filaInicio,
        int colCount,
        Dictionary<string, int> map)
    {
        var usadas = new HashSet<int>(map.Values);
        var rowCount = ws.Dimension!.Rows;
        var sampleEnd = Math.Min(filaInicio + 40, rowCount);
        if (sampleEnd < filaInicio) return;

        var puntajes = new Dictionary<int, (int email, int nit, int phone, int text)>();
        for (var col = 1; col <= colCount; col++)
        {
            if (usadas.Contains(col)) continue;
            var email = 0;
            var nit = 0;
            var phone = 0;
            var text = 0;
            for (var row = filaInicio; row <= sampleEnd; row++)
            {
                var val = LeerCeldaProveedor(ws.Cells[row, col], 500) ?? "";
                if (PareceEmailProveedor(val)) email++;
                else if (PareceNitProveedor(val)) nit++;
                else if (PareceTelefonoProveedor(val)) phone++;
                else if (val.Length > 2) text++;
            }
            puntajes[col] = (email, nit, phone, text);
        }

        void AsignarSiFalta(string clave, Func<(int email, int nit, int phone, int text), int> score, int minimo)
        {
            if (map.ContainsKey(clave)) return;
            var mejor = puntajes
                .Where(kv => !usadas.Contains(kv.Key))
                .OrderByDescending(kv => score(kv.Value))
                .FirstOrDefault();
            if (mejor.Key <= 0 || score(mejor.Value) < minimo) return;
            map[clave] = mejor.Key;
            usadas.Add(mejor.Key);
            puntajes.Remove(mejor.Key);
        }

        AsignarSiFalta("nit", v => v.nit, 3);
        AsignarSiFalta("correo", v => v.email, 2);
        AsignarSiFalta("movil", v => v.phone, 3);
        if (!map.ContainsKey("trabajo"))
            AsignarSiFalta("trabajo", v => v.phone, 3);

        if (!map.ContainsKey("nombre"))
        {
            var mejorNombre = puntajes
                .Where(kv => !usadas.Contains(kv.Key))
                .OrderByDescending(kv => kv.Value.text)
                .FirstOrDefault();
            if (mejorNombre.Key > 0 && mejorNombre.Value.text >= 3)
            {
                map["nombre"] = mejorNombre.Key;
                usadas.Add(mejorNombre.Key);
            }
        }
    }

    private static ColumnasProveedorExcel? DetectarColumnasProveedor(ExcelWorksheet ws)
    {
        var rowCount = ws.Dimension!.Rows;
        var colCount = ws.Dimension.Columns;
        if (colCount < 1) return null;

        var mejorFila = 1;
        var mejorPuntaje = 0;
        for (var row = 1; row <= Math.Min(10, rowCount); row++)
        {
            var puntaje = 0;
            for (var col = 1; col <= colCount; col++)
            {
                if (ClasificarEncabezadoColumnaProveedor(ws.Cells[row, col].Text) != null)
                    puntaje++;
            }
            if (puntaje > mejorPuntaje)
            {
                mejorPuntaje = puntaje;
                mejorFila = row;
            }
        }

        var map = new Dictionary<string, int>();
        var telefonosGenericos = new List<int>();

        if (mejorPuntaje > 0)
        {
            for (var col = 1; col <= colCount; col++)
            {
                var tipo = ClasificarEncabezadoColumnaProveedor(ws.Cells[mejorFila, col].Text);
                if (tipo == null) continue;
                if (tipo == "telefono")
                    telefonosGenericos.Add(col);
                else if (!map.ContainsKey(tipo))
                    map[tipo] = col;
            }
        }

        foreach (var col in telefonosGenericos)
        {
            if (!map.ContainsKey("trabajo")) map["trabajo"] = col;
            else if (!map.ContainsKey("movil")) map["movil"] = col;
        }

        if (!map.ContainsKey("nombre"))
            map["nombre"] = 1;

        var filaInicio = mejorPuntaje > 0 ? mejorFila + 1 : 1;
        InferirColumnasProveedorPorContenido(ws, filaInicio, colCount, map);

        var nombreCol = map["nombre"];
        var correo = map.GetValueOrDefault("correo");
        var telTrabajo = map.GetValueOrDefault("trabajo");
        var telMovil = map.GetValueOrDefault("movil");
        var nit = map.GetValueOrDefault("nit");
        var direccion = map.GetValueOrDefault("direccion");

        // Solo asumir orden fijo (nombre, correo, tel…) si no hubo encabezados reconocidos.
        if (mejorPuntaje == 0 && colCount >= 6)
        {
            var usadas = new HashSet<int>(map.Values);
            if (correo <= 0) correo = ResolverColumnaLibre(null, nombreCol, 1, usadas, colCount);
            if (correo > 0) usadas.Add(correo);
            if (telTrabajo <= 0) telTrabajo = ResolverColumnaLibre(null, nombreCol, 2, usadas, colCount);
            if (telTrabajo > 0) usadas.Add(telTrabajo);
            if (telMovil <= 0) telMovil = ResolverColumnaLibre(null, nombreCol, 3, usadas, colCount);
            if (telMovil > 0) usadas.Add(telMovil);
            if (nit <= 0) nit = ResolverColumnaLibre(null, nombreCol, 4, usadas, colCount);
            if (nit > 0) usadas.Add(nit);
            if (direccion <= 0) direccion = ResolverColumnaLibre(null, nombreCol, 5, usadas, colCount);
        }

        return new ColumnasProveedorExcel(
            nombreCol,
            correo,
            telTrabajo,
            telMovil,
            nit,
            direccion,
            filaInicio);
    }

    private static List<FilaProveedorExcel> ExtraerProveedoresDesdeExcel(
        ExcelWorksheet ws,
        ColumnasProveedorExcel columnas,
        out int filasVacias,
        out int filasInvalidas)
    {
        filasVacias = 0;
        filasInvalidas = 0;
        var filas = new List<FilaProveedorExcel>();
        var rowCount = ws.Dimension!.Rows;

        for (var row = columnas.FilaInicio; row <= rowCount; row++)
        {
            var nombreRaw = ws.Cells[row, columnas.Nombre].Text?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(nombreRaw))
            {
                filasVacias++;
                continue;
            }

            if (EsEncabezadoNombreProveedor(nombreRaw))
                continue;

            var nombre = LimpiarTextoOpcional(nombreRaw, 200);
            if (string.IsNullOrWhiteSpace(nombre) || nombre.Length < 2)
            {
                filasInvalidas++;
                continue;
            }

            filas.Add(new FilaProveedorExcel(
                nombre,
                columnas.Correo > 0 ? LeerCeldaProveedor(ws.Cells[row, columnas.Correo], 200) : null,
                columnas.TelefonoTrabajo > 0 ? LeerCeldaProveedor(ws.Cells[row, columnas.TelefonoTrabajo], 50) : null,
                columnas.TelefonoMovil > 0 ? LeerCeldaProveedor(ws.Cells[row, columnas.TelefonoMovil], 50) : null,
                columnas.Nit > 0 ? LeerCeldaProveedor(ws.Cells[row, columnas.Nit], 50) : null,
                columnas.Direccion > 0 ? LeerCeldaProveedor(ws.Cells[row, columnas.Direccion], 500) : null));
        }

        return filas;
    }

    private static AlmacenProveedorDto MapProveedor(AlmacenProveedor p) => new()
    {
        Id = p.Id.ToString(),
        Nombre = p.Nombre,
        Nit = p.Nit,
        Correo = p.Correo,
        TelefonoTrabajo = p.TelefonoTrabajo,
        TelefonoMovil = p.TelefonoMovil,
        Direccion = p.Direccion,
        Categoria = p.Categoria,
        ResponsableIva = p.ResponsableIva,
        Telefono = TelefonoPrincipalProveedor(p),
    };

    private static AlmacenProductoDto MapProducto(AlmacenProducto p) => new()
    {
        Id = p.Id.ToString(),
        Nombre = p.Nombre,
        Descripcion = p.Descripcion,
        CostoEstandar = p.CostoEstandar,
        TipoRequisicion = p.TipoRequisicionId,
        UnidadSugerida = p.UnidadSugerida,
    };

    private sealed record ColumnasProductoExcel(
        int Nombre,
        int Descripcion,
        int Costo,
        int Unidad,
        int Categoria,
        int FilaInicio);

    private sealed record FilaProductoExcel(
        string Nombre,
        string? Descripcion,
        decimal? CostoEstandar,
        string? UnidadSugerida,
        string TipoRequisicionId);

    private static string NormalizarNombreProducto(string nombre) =>
        AlmacenCatalog.NormalizarTextoClave(nombre);

    private static bool CoincideEncabezadoProducto(string? valor, params string[] aliases)
    {
        var v = AlmacenCatalog.NormalizarTextoClave(valor);
        return aliases.Any(a => v == AlmacenCatalog.NormalizarTextoClave(a) || v.StartsWith(AlmacenCatalog.NormalizarTextoClave(a)));
    }

    private static ColumnasProductoExcel? DetectarColumnasProducto(ExcelWorksheet ws)
    {
        var rowCount = ws.Dimension!.Rows;
        var colCount = ws.Dimension.Columns;

        for (var row = 1; row <= Math.Min(3, rowCount); row++)
        {
            int? nombre = null, descripcion = null, costo = null, unidad = null, categoria = null;
            for (var col = 1; col <= colCount; col++)
            {
                var text = ws.Cells[row, col].Text;
                if (CoincideEncabezadoProducto(text, "nombre del producto", "nombre del prod", "nombre", "producto"))
                    nombre = col;
                else if (CoincideEncabezadoProducto(text, "descripcion", "descripción", "desc"))
                    descripcion = col;
                else if (CoincideEncabezadoProducto(text, "costo estandar", "costo estándar", "costo"))
                    costo = col;
                else if (CoincideEncabezadoProducto(text, "unidad de medida", "unidad de medi", "unidad", "medida"))
                    unidad = col;
                else if (CoincideEncabezadoProducto(text, "categoria", "categoría"))
                    categoria = col;
            }

            if (nombre.HasValue && categoria.HasValue)
            {
                return new ColumnasProductoExcel(
                    nombre.Value,
                    descripcion ?? 0,
                    costo ?? 0,
                    unidad ?? 0,
                    categoria.Value,
                    row + 1);
            }
        }

        if (colCount >= 5)
            return new ColumnasProductoExcel(1, 2, 3, 4, 5, 2);

        return null;
    }

    private static List<FilaProductoExcel> ExtraerProductosDesdeExcel(
        ExcelWorksheet ws,
        ColumnasProductoExcel columnas,
        out int filasVacias,
        out int filasInvalidas)
    {
        filasVacias = 0;
        filasInvalidas = 0;
        var filas = new List<FilaProductoExcel>();
        var rowCount = ws.Dimension!.Rows;

        for (var row = columnas.FilaInicio; row <= rowCount; row++)
        {
            var nombreRaw = ws.Cells[row, columnas.Nombre].Text?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(nombreRaw))
            {
                filasVacias++;
                continue;
            }

            if (CoincideEncabezadoProducto(nombreRaw, "nombre del producto", "nombre del prod", "nombre", "producto"))
                continue;

            var nombre = Regex.Replace(nombreRaw, @"\s+", " ").Trim();
            if (nombre.Length < 2)
            {
                filasInvalidas++;
                continue;
            }
            if (nombre.Length > 200)
                nombre = nombre[..200];

            var descripcion = columnas.Descripcion > 0
                ? Regex.Replace(ws.Cells[row, columnas.Descripcion].Text?.Trim() ?? "", @"\s+", " ").Trim()
                : "";
            if (descripcion.Length > 500)
                descripcion = descripcion[..500];
            if (string.IsNullOrWhiteSpace(descripcion))
                descripcion = nombre;

            decimal? costo = null;
            if (columnas.Costo > 0)
            {
                var cell = ws.Cells[row, columnas.Costo];
                costo = AlmacenCatalog.ParsearCostoEstandarExcel(cell.Value, cell.Text);
            }

            var unidadRaw = columnas.Unidad > 0 ? ws.Cells[row, columnas.Unidad].Text : null;
            var unidad = AlmacenCatalog.NormalizarUnidadMedidaProducto(unidadRaw);

            var categoriaExcel = columnas.Categoria > 0 ? ws.Cells[row, columnas.Categoria].Text : null;
            var tipoRequisicion = AlmacenCatalog.MapearCategoriaExcelATipoRequisicion(categoriaExcel);

            filas.Add(new FilaProductoExcel(nombre, descripcion, costo, unidad, tipoRequisicion));
        }

        return filas;
    }

    private static string? ValidarRequisicionWrite(AlmacenRequisicionWriteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.TipoRequisicionId)) return "Seleccione el tipo de requisición.";
        if (string.IsNullOrWhiteSpace(dto.OrdenProduccionNumero) && string.IsNullOrWhiteSpace(dto.OrdenProduccionId))
            return "Seleccione la orden de producción.";
        if (string.IsNullOrWhiteSpace(dto.ProductoId)) return "Seleccione el producto.";
        if (string.IsNullOrWhiteSpace(dto.Referencia)) return "Indique la referencia.";
        if (string.IsNullOrWhiteSpace(dto.FechaSolicitud)) return "Indique la fecha de solicitud.";
        if (!dto.Cantidad.HasValue || dto.Cantidad <= 0) return "Indique una cantidad válida.";
        if (string.IsNullOrWhiteSpace(dto.Unidad)) return "Indique la unidad.";
        if (string.IsNullOrWhiteSpace(dto.FechaRequerida)) return "Indique la fecha requerida.";
        return null;
    }

    private async Task<AlmacenProducto?> ResolverProductoAsync(string? productoId)
    {
        if (string.IsNullOrWhiteSpace(productoId)) return null;
        if (int.TryParse(productoId, out var pid))
            return await _context.AlmacenProductos.FindAsync(pid);
        return await _context.AlmacenProductos.FirstOrDefaultAsync(p => p.Nombre == productoId);
    }

    private async Task<(string numero, string cliente, string referencia, int? catalogoId)> ResolverOrdenProduccionAsync(AlmacenRequisicionWriteDto dto)
    {
        var numero = dto.OrdenProduccionNumero?.Trim() ?? "";
        if (numero.Contains('|') || numero.Contains(',') || numero.Contains(';'))
            return (numero, dto.Cliente?.Trim() ?? "", dto.Referencia?.Trim() ?? "", null);

        if (!string.IsNullOrWhiteSpace(dto.OrdenProduccionId) && int.TryParse(dto.OrdenProduccionId, out var opId))
        {
            var cat = await _context.CatalogoOrdenesProduccion.FindAsync(opId);
            if (cat != null)
                return ($"OP-{cat.Numero}", cat.Cliente ?? dto.Cliente ?? "", cat.Referencia ?? dto.Referencia ?? "", cat.Id);
        }

        if (!string.IsNullOrWhiteSpace(numero))
        {
            var digits = new string(numero.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(digits))
            {
                var cat = await _context.CatalogoOrdenesProduccion
                    .Where(x => x.Numero == digits)
                    .OrderByDescending(x => x.Anio)
                    .ThenByDescending(x => x.Mes)
                    .FirstOrDefaultAsync();
                if (cat != null)
                    return ($"OP-{cat.Numero}", cat.Cliente ?? dto.Cliente ?? "", cat.Referencia ?? dto.Referencia ?? "", cat.Id);
            }
        }

        return (numero, dto.Cliente?.Trim() ?? "", dto.Referencia?.Trim() ?? "", null);
    }

    private async Task SincronizarProveedorEnPedidosAsync(int catalogoId, AlmacenProveedor entity)
    {
        var refs = await _context.AlmacenPedidoProveedores
            .Where(p => p.ProveedorCatalogoId == catalogoId)
            .ToListAsync();
        foreach (var p in refs)
        {
            p.Nombre = entity.Nombre;
            p.Nit = entity.Nit;
            p.Telefono = entity.Telefono;
        }
    }

    /// <summary>Provisional: quita el pedido y deja la requisición en Pendiente.</summary>
    [HttpDelete("requisiciones/{id:int}/pedido")]
    public async Task<ActionResult<AlmacenRequisicionDto>> RevertirPedido(int id)
    {
        try
        {
            var ok = await _service.RevertirPedidoRequisicionAsync(id);
            if (!ok) return NotFound();
            var loaded = await _service.CargarRequisicionCompletaAsync(id);
            return Ok(_service.MapRequisicion(loaded!));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Provisional: borra una requisición y todo lo asociado (pedido, recepciones).</summary>
    [HttpDelete("requisiciones/{id:int}")]
    public async Task<IActionResult> DeleteRequisicion(int id)
    {
        var eliminada = await _service.EliminarRequisicionCompletaAsync(id);
        if (!eliminada) return NotFound();
        return NoContent();
    }

    /// <summary>Provisional: vacía requisiciones/pedidos/recepciones y reinicia IDs autoincrementales.</summary>
    [HttpDelete("pruebas/reset")]
    public async Task<IActionResult> ResetDatosPruebas()
    {
        await _service.ResetDatosPruebasAsync();
        return Ok(new { message = "Datos operativos de almacén eliminados. Los IDs vuelven a iniciar en 1." });
    }
}
