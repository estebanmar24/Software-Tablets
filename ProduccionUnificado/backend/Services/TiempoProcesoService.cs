using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.Helpers;

namespace TiempoProcesos.API.Services;

public interface ITiempoProcesoService
{
    Task<List<ActividadDto>> GetActividadesAsync();
    Task<List<UsuarioDto>> GetUsuariosAsync();
    Task<List<MaquinaDto>> GetMaquinasAsync();
    Task<List<OrdenProduccionDto>> GetOrdenesProduccionAsync();
    Task<ProduccionDiaDto> GetProduccionDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId);
    Task<TiempoProcesoDto> RegistrarTiempoAsync(RegistrarTiempoRequest request);
    Task<bool> LimpiarDatosDelDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId);
    Task<List<TiempoProcesoDto>> GetHistorialDetalladoAsync(DateTime fechaInicio, DateTime fechaFin, int? maquinaId, int? usuarioId);
}

public class TiempoProcesoService : ITiempoProcesoService
{
    private readonly AppDbContext _context;

    public TiempoProcesoService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<ActividadDto>> GetActividadesAsync()
    {
        return await _context.Actividades
            .OrderBy(a => a.Orden)
            .Select(a => new ActividadDto
            {
                Id = a.Id,
                Codigo = a.Codigo,
                Nombre = a.Nombre,
                EsProductiva = a.EsProductiva,
                Observaciones = a.Observaciones
            })
            .ToListAsync();
    }

    public async Task<List<UsuarioDto>> GetUsuariosAsync()
    {
        return await _context.Usuarios
            .Where(u => u.Activo)
            .OrderBy(u => u.Nombre)
            .Select(u => new UsuarioDto
            {
                Id = u.Id,
                Nombre = u.Nombre
            })
            .ToListAsync();
    }

    public async Task<List<MaquinaDto>> GetMaquinasAsync()
    {
        return await _context.Maquinas
            .Where(m => m.Activo)
            .OrderBy(m => m.Nombre)
            .Select(m => new MaquinaDto
            {
                Id = m.Id,
                Nombre = m.Nombre,
                MetaRendimiento = m.MetaRendimiento,
                ValorPorTiro = m.ValorPorTiro,
                Importancia = m.Importancia,
                Meta100Porciento = m.Meta100Porciento
            })
            .ToListAsync();
    }

    public async Task<List<OrdenProduccionDto>> GetOrdenesProduccionAsync()
    {
        return await _context.OrdenesProduccion
            .Where(op => op.Estado != "Completada")
            .OrderByDescending(op => op.FechaCreacion)
            .Select(op => new OrdenProduccionDto
            {
                Id = op.Id,
                Numero = op.Numero,
                Descripcion = op.Descripcion,
                Estado = op.Estado
            })
            .ToListAsync();
    }

    public async Task<ProduccionDiaDto> GetProduccionDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId)
    {
        var query = _context.TiemposProceso
            .Include(t => t.Actividad)
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha.Date == fecha.Date);

        if (maquinaId.HasValue)
            query = query.Where(t => t.MaquinaId == maquinaId.Value);

        if (usuarioId.HasValue)
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        var registros = await query
            .OrderByDescending(t => t.HoraFin)
            .ToListAsync();

        return new ProduccionDiaDto
        {
            TirosTotales = registros.Sum(r => r.Tiros),
            DesperdicioTotal = registros.Sum(r => r.Desperdicio),
            Historial = registros.Select(t => new TiempoProcesoDto
            {
                Id = t.Id,
                Fecha = t.Fecha,
                HoraInicio = t.HoraInicio.ToString("HH:mm:ss"), // Use standard format
                HoraFin = t.HoraFin.ToString("HH:mm:ss"),
                Duracion = TimeSpan.FromTicks(t.Duracion).ToString(@"hh\:mm\:ss"),
                UsuarioId = t.UsuarioId,
                UsuarioNombre = t.Usuario?.Nombre,
                MaquinaId = t.MaquinaId,
                MaquinaNombre = t.Maquina?.Nombre,
                OrdenProduccionId = t.OrdenProduccionId,
                OrdenProduccionNumero = t.OrdenProduccion?.Numero,
                ActividadId = t.ActividadId,
                ActividadNombre = t.Actividad?.Nombre,
                ActividadCodigo = t.Actividad?.Codigo,
                Tiros = t.Tiros,
                Desperdicio = t.Desperdicio,
                Observaciones = t.Observaciones
            }).ToList()
        };
    }

    public async Task<List<TiempoProcesoDto>> GetHistorialDetalladoAsync(DateTime fechaInicio, DateTime fechaFin, int? maquinaId, int? usuarioId)
    {
        var query = _context.TiemposProceso
            .Include(t => t.Actividad)
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.OrdenProduccion)
            .Where(t => t.Fecha.Date >= fechaInicio.Date && t.Fecha.Date <= fechaFin.Date);

        if (maquinaId.HasValue)
            query = query.Where(t => t.MaquinaId == maquinaId.Value);

        if (usuarioId.HasValue)
            query = query.Where(t => t.UsuarioId == usuarioId.Value);

        return await query
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.HoraInicio)
            .Select(t => new TiempoProcesoDto
            {
                Id = t.Id,
                Fecha = t.Fecha,
                HoraInicio = t.HoraInicio.ToString("HH:mm:ss"),
                HoraFin = t.HoraFin.ToString("HH:mm:ss"),
                Duracion = TimeSpan.FromTicks(t.Duracion).ToString(@"hh\:mm\:ss"),
                UsuarioId = t.UsuarioId,
                UsuarioNombre = t.Usuario == null ? string.Empty : t.Usuario.Nombre,
                MaquinaId = t.MaquinaId,
                MaquinaNombre = t.Maquina == null ? string.Empty : t.Maquina.Nombre,
                OrdenProduccionId = t.OrdenProduccionId,
                OrdenProduccionNumero = t.OrdenProduccion == null ? string.Empty : t.OrdenProduccion.Numero,
                ActividadId = t.ActividadId,
                ActividadNombre = t.Actividad == null ? string.Empty : t.Actividad.Nombre,
                ActividadCodigo = t.Actividad == null ? string.Empty : t.Actividad.Codigo,
                Tiros = t.Tiros,
                Desperdicio = t.Desperdicio,
                Observaciones = t.Observaciones
            })
            .ToListAsync();
    }

    public async Task<TiempoProcesoDto> RegistrarTiempoAsync(RegistrarTiempoRequest request)
    {
        // Lógica para manejar OP por referencia (Si no viene ID pero viene Texto)
        if (!request.OrdenProduccionId.HasValue && !string.IsNullOrWhiteSpace(request.ReferenciaOP))
        {
            // Buscar si existe por Numero
            var existingOp = await _context.OrdenesProduccion
                .FirstOrDefaultAsync(op => op.Numero == request.ReferenciaOP);

            if (existingOp != null)
            {
                request.OrdenProduccionId = existingOp.Id;
            }
            else
            {
                // Crear nueva OP
                var newOp = new OrdenProduccion
                {
                    Numero = request.ReferenciaOP,
                    Descripcion = "Generada Automáticamente",
                    Estado = "EnProceso",
                    FechaCreacion = DateTime.Now
                };
                _context.OrdenesProduccion.Add(newOp);
                await _context.SaveChangesAsync();
                request.OrdenProduccionId = newOp.Id;
            }
        }

        var tiempoProceso = new TiempoProceso
        {
            Fecha = request.Fecha.Date,
            HoraInicio = request.Fecha.Date.Add(TimeSpan.Parse(request.HoraInicio)),
            HoraFin = request.Fecha.Date.Add(TimeSpan.Parse(request.HoraFin)),
            Duracion = TimeSpan.Parse(request.Duracion).Ticks,
            UsuarioId = request.UsuarioId,
            MaquinaId = request.MaquinaId,
            OrdenProduccionId = request.OrdenProduccionId,
            ActividadId = request.ActividadId,
            Tiros = request.Tiros,
            Desperdicio = request.Desperdicio,
            Observaciones = request.Observaciones // Mapear observaciones si vienen en el request (aunque no estaba en el DTO original, debo checar)
        };

        _context.TiemposProceso.Add(tiempoProceso);
        await _context.SaveChangesAsync();

        // Actualizar la tabla acumulada ProduccionDiaria
        await ActualizarProduccionDiaria(tiempoProceso.Fecha, tiempoProceso.MaquinaId, tiempoProceso.UsuarioId);

        // Cargar las relaciones
        await _context.Entry(tiempoProceso).Reference(t => t.Actividad).LoadAsync();
        await _context.Entry(tiempoProceso).Reference(t => t.Usuario).LoadAsync();
        await _context.Entry(tiempoProceso).Reference(t => t.Maquina).LoadAsync();
        if (tiempoProceso.OrdenProduccionId.HasValue)
            await _context.Entry(tiempoProceso).Reference(t => t.OrdenProduccion).LoadAsync();

        return new TiempoProcesoDto
        {
            Id = tiempoProceso.Id,
            Fecha = tiempoProceso.Fecha,
            HoraInicio = tiempoProceso.HoraInicio.ToString("HH:mm:ss"),
            HoraFin = tiempoProceso.HoraFin.ToString("HH:mm:ss"),
            Duracion = TimeSpan.FromTicks(tiempoProceso.Duracion).ToString(@"hh\:mm\:ss"),
            UsuarioId = tiempoProceso.UsuarioId,
            UsuarioNombre = tiempoProceso.Usuario?.Nombre,
            MaquinaId = tiempoProceso.MaquinaId,
            MaquinaNombre = tiempoProceso.Maquina?.Nombre,
            OrdenProduccionId = tiempoProceso.OrdenProduccionId,
            OrdenProduccionNumero = tiempoProceso.OrdenProduccion?.Numero,
            ActividadId = tiempoProceso.ActividadId,
            ActividadNombre = tiempoProceso.Actividad?.Nombre,
            ActividadCodigo = tiempoProceso.Actividad?.Codigo,
            Tiros = tiempoProceso.Tiros,
            Desperdicio = tiempoProceso.Desperdicio,
            Observaciones = tiempoProceso.Observaciones
        };
    }

    public async Task<bool> LimpiarDatosDelDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId)
    {
        bool seEliminoAlgo = false;

        // 1. Eliminar de TiempoProcesos (historial individual)
        var queryTiempos = _context.TiemposProceso.Where(t => t.Fecha.Date == fecha.Date);

        if (maquinaId.HasValue)
            queryTiempos = queryTiempos.Where(t => t.MaquinaId == maquinaId.Value);

        if (usuarioId.HasValue)
            queryTiempos = queryTiempos.Where(t => t.UsuarioId == usuarioId.Value);

        var registrosTiempos = await queryTiempos.ToListAsync();
        
        if (registrosTiempos.Any())
        {
            _context.TiemposProceso.RemoveRange(registrosTiempos);
            seEliminoAlgo = true;
        }

        // 2. Eliminar de ProduccionDiaria (resumen diario)
        var queryProduccion = _context.ProduccionDiaria.Where(p => p.Fecha == fecha.Date);

        if (maquinaId.HasValue)
            queryProduccion = queryProduccion.Where(p => p.MaquinaId == maquinaId.Value);

        if (usuarioId.HasValue)
            queryProduccion = queryProduccion.Where(p => p.UsuarioId == usuarioId.Value);

        var registrosProduccion = await queryProduccion.ToListAsync();
        
        if (registrosProduccion.Any())
        {
            _context.ProduccionDiaria.RemoveRange(registrosProduccion);
            seEliminoAlgo = true;
        }

        if (seEliminoAlgo)
        {
            await _context.SaveChangesAsync();
        }

        return seEliminoAlgo;
    }

    private async Task ActualizarProduccionDiaria(DateTime fecha, int maquinaId, int usuarioId)
    {
        // 1. Obtener o crear el registro diario
        var diario = await _context.ProduccionDiaria
            .FirstOrDefaultAsync(p => p.Fecha == fecha && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId);

        if (diario == null)
        {
            diario = new ProduccionDiaria
            {
                Fecha = fecha,
                MaquinaId = maquinaId,
                UsuarioId = usuarioId,
                HoraInicio = new TimeSpan(6, 0, 0), // Default inicio turno
                HoraFin = new TimeSpan(14, 0, 0) // Default fin turno
            };
            _context.ProduccionDiaria.Add(diario);
        }

        // 2. Obtener todos los tiempos del día para recálculo
        var tiempos = await _context.TiemposProceso
            .Include(t => t.Actividad)
            .Include(t => t.Maquina)
            .Include(t => t.OrdenProduccion) // Necessary for aggregation
            .Where(t => t.Fecha == fecha && t.MaquinaId == maquinaId && t.UsuarioId == usuarioId)
            .ToListAsync();

        if (!tiempos.Any()) return;

        // Calcular ReferenciaOP concatenada (Ej: "7077-7075")
        var ops = tiempos
            .Where(t => t.OrdenProduccion != null)
            .Select(t => t.OrdenProduccion!.Numero)
            .Distinct()
            .ToList();
            
        if (ops.Any())
        {
            diario.ReferenciaOP = string.Join("-", ops);
        }

        // Calcular Novedades concatenadas (Observaciones)
        var observaciones = tiempos
            .Where(t => !string.IsNullOrWhiteSpace(t.Observaciones))
            .Select(t => t.Observaciones)
            .Distinct()
            .ToList();

        if (observaciones.Any())
        {
            diario.Novedades = string.Join(" | ", observaciones);
        }

        // Actualizar Hora Inicio y Hora Fin del turno basado en actividades
        if (tiempos.Any())
        {
            // Revert back using TimeOfDay since properties are DateTime
            diario.HoraInicio = tiempos.Min(t => t.HoraInicio).TimeOfDay;
            diario.HoraFin = tiempos.Max(t => t.HoraFin).TimeOfDay;
        }

        // 3. Reiniciar contadores
        diario.TiempoPuestaPunto = 0;
        diario.HorasOperativas = 0;  // Tiempo de producción (02)
        diario.TotalHorasProductivas = 0;
        diario.TirosDiarios = 0;
        diario.Desperdicio = 0;
        diario.TiempoReparacion = 0;
        diario.HorasDescanso = 0;
        diario.TiempoOtroMuerto = 0;
        diario.HorasMantenimiento = 0;
        diario.TiempoFaltaTrabajo = 0;
        diario.HorasOtrosAux = 0;
        diario.ValorAPagar = 0;
        diario.ValorTiroSnapshot = 0;
        diario.RendimientoFinal = 0;
        // Contadores bonificables
        diario.TirosBonificables = 0;
        diario.DesperdicioBonificable = 0;
        diario.ValorAPagarBonificable = 0;
        diario.EsHorarioLaboral = false;

        // 3.1 Calcular Cambios de OP (cuenta transiciones entre diferentes OPs)
        // Incluye comparación con la última OP del día anterior
        // Ejemplo: Si ayer terminó con 7075 y hoy empieza con 7076, cuenta como 1 cambio
        var tiemposOrdenados = tiempos
            .Where(t => t.OrdenProduccionId.HasValue)
            .OrderBy(t => t.HoraInicio)
            .ToList();
        
        int cambios = 0;
        
        // Buscar la última OP del día anterior para este operario/máquina
        var fechaAyer = fecha.AddDays(-1);
        var ultimoRegistroAyer = await _context.TiemposProceso
            .Where(t => t.Fecha == fechaAyer && t.MaquinaId == maquinaId && t.UsuarioId == usuarioId && t.OrdenProduccionId.HasValue)
            .OrderByDescending(t => t.HoraFin)
            .FirstOrDefaultAsync();
        
        int? opAnterior = ultimoRegistroAyer?.OrdenProduccionId;
        
        foreach (var t in tiemposOrdenados)
        {
            if (opAnterior.HasValue && t.OrdenProduccionId != opAnterior)
            {
                cambios++;
            }
            opAnterior = t.OrdenProduccionId;
        }
        diario.Cambios = cambios;

        decimal horasProd = 0;

        // 4. Iterar y sumar
        foreach (var t in tiempos)
        {
            decimal horas = (decimal)TimeSpan.FromTicks(t.Duracion).TotalHours;
            string codigo = t.Actividad?.Codigo ?? "";
            
            // Validar si el registro está dentro del horario laboral bonificable
            bool esBonificable = HorarioLaboralHelper.EsRegistroBonificable(
                t.Fecha, 
                t.HoraInicio.TimeOfDay, 
                t.HoraFin.TimeOfDay);

            switch (codigo)
            {
                case "01": diario.TiempoPuestaPunto += horas; break;
                case "02": 
                    diario.HorasOperativas += horas;  // Tiempo de producción va a HorasOperativas
                    diario.TirosDiarios += t.Tiros;
                    diario.Desperdicio += t.Desperdicio;
                    horasProd += horas;
                    
                    // Solo agregar a bonificables si está dentro del horario laboral
                    if (esBonificable)
                    {
                        diario.TirosBonificables += t.Tiros;
                        diario.DesperdicioBonificable += t.Desperdicio;
                    }
                    break;
                case "03": diario.TiempoReparacion += horas; break;
                case "04": diario.HorasDescanso += horas; break;
                case "08": diario.TiempoOtroMuerto += horas; break;
                case "10": diario.HorasMantenimiento += horas; break;
                case "13": diario.TiempoFaltaTrabajo += horas; break;
                case "14": diario.HorasOtrosAux += horas; break;
                default: diario.HorasOtrosAux += horas; break;
            }
        }

        // 5. Cálculos derivados
        // TotalHorasProductivas = Suma de HorasOperativas (Producción) + TiempoPuestaPunto
        diario.TotalHorasProductivas = diario.HorasOperativas + diario.TiempoPuestaPunto;
        diario.TotalHorasAuxiliares = diario.HorasMantenimiento + diario.HorasDescanso + diario.HorasOtrosAux;
        diario.TotalTiemposMuertos = diario.TiempoFaltaTrabajo + diario.TiempoReparacion + diario.TiempoOtroMuerto;
        diario.TotalHoras = diario.TotalHorasProductivas + diario.TotalHorasAuxiliares + diario.TotalTiemposMuertos;

        if (diario.HorasOperativas > 0)
        {
            // RendimientoFinal = TirosDiarios (valor bruto ingresado, R.Final)
            diario.RendimientoFinal = diario.TirosDiarios;
            // PromedioHoraProductiva = Tiros / Horas (promedio por hora)
            diario.PromedioHoraProductiva = diario.TirosDiarios / diario.HorasOperativas;
        }
        else
        {
            diario.RendimientoFinal = diario.TirosDiarios;
            diario.PromedioHoraProductiva = 0;
        }

        var maquina = tiempos.First().Maquina;
        if (maquina != null)
        {
            diario.ValorTiroSnapshot = maquina.ValorPorTiro;
            // ValorAPagar total - considera tiros por encima de la meta
            var tirosNetosTotales = diario.TirosDiarios - diario.Desperdicio;
            var tirosExtraTotales = Math.Max(0, tirosNetosTotales - (decimal)maquina.MetaRendimiento);
            diario.ValorAPagar = tirosExtraTotales * diario.ValorTiroSnapshot;
            // ValorAPagarBonificable - solo tiros extra dentro del horario laboral
            var tirosNetosBonif = diario.TirosBonificables - diario.DesperdicioBonificable;
            var tirosExtraBonif = Math.Max(0, tirosNetosBonif - (decimal)maquina.MetaRendimiento);
            diario.ValorAPagarBonificable = tirosExtraBonif * diario.ValorTiroSnapshot;
        }
        
        // Marcar si hay tiros bonificables
        diario.EsHorarioLaboral = diario.TirosBonificables > 0;

        await _context.SaveChangesAsync();
    }
}
