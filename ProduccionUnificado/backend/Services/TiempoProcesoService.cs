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
    Task<List<HorarioDto>> GetHorariosAsync();
    Task<ProduccionDiaDto> GetProduccionDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId);
    Task<TiempoProcesoDto> RegistrarTiempoAsync(RegistrarTiempoRequest request);
    Task<bool> LimpiarDatosDelDiaAsync(DateTime fecha, int? maquinaId, int? usuarioId);
    Task<List<TiempoProcesoDto>> GetHistorialDetalladoAsync(DateTime fechaInicio, DateTime fechaFin, int? maquinaId, int? usuarioId);
    Task RecalcularProduccionMesAsync(int anio, int mes);
    Task<TiempoProcesoDto> FinalizarTiempoAsync(long id, RegistrarTiempoRequest request);
    Task<TiempoProcesoDto> PausarTiempoAsync(long id);
    Task<TiempoProcesoDto> ReanudarTiempoAsync(long id);
    Task<TiempoProcesoDto?> ActualizarProgresoAsync(long id, ActualizarProgresoRequest request);
    Task<TiempoProcesoDto> AjustarTiempoAsync(long id, AjustarTiempoRequest request);
    Task<int> RepararProcesosAbiertosAsync(DateTime fecha, int? maquinaId, int? usuarioId);
}

public class TiempoProcesoService : ITiempoProcesoService
{
// ... existing impl ...

    // public async Task<TiempoProcesoDto> FinalizarTiempoAsync(long id, RegistrarTiempoRequest request)

    private readonly AppDbContext _context;
    private readonly IProgramacionEjecucionService _programacionEjecucion;

    public TiempoProcesoService(AppDbContext context, IProgramacionEjecucionService programacionEjecucion)
    {
        _context = context;
        _programacionEjecucion = programacionEjecucion;
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
                Nombre = u.Nombre,
                Area = u.Area ?? ""
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

    public async Task<List<HorarioDto>> GetHorariosAsync()
    {
        return await _context.Horarios
            .Where(h => h.Activo)
            .OrderBy(h => h.Id)
            .Select(h => new HorarioDto
            {
                Id = h.Id,
                Codigo = h.Codigo,
                Nombre = h.Nombre
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
                Observaciones = t.Observaciones,
                SubCodigoActividad = t.SubCodigoActividad,
                SubCodigoDetalle = t.SubCodigoDetalle,
                Estado = t.Estado,
                PausadoEn = t.PausadoEn,
                TiempoPausadoSegundos = t.TiempoPausadoSegundos
            }).ToList()
        };
    }

    public async Task<List<TiempoProcesoDto>> GetHistorialDetalladoAsync(DateTime fechaInicio, DateTime fechaFin, int? maquinaId, int? usuarioId)
    {
        // Consultar TiemposProceso para obtener el detalle REAL de todas las actividades
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

        var data = await query
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.HoraInicio)
            .ToListAsync();

        return data.Select(t => new TiempoProcesoDto
        {
            Id = t.Id,
            Fecha = t.Fecha,
            HoraInicio = t.HoraInicio.ToString("HH:mm:ss"),
            HoraFin = t.HoraFin.ToString("HH:mm:ss"),
            Duracion = TimeSpan.FromTicks(t.Duracion).ToString(@"hh\:mm\:ss"),
            UsuarioId = t.UsuarioId,
            UsuarioNombre = t.Usuario?.Nombre ?? string.Empty,
            MaquinaId = t.MaquinaId,
            MaquinaNombre = t.Maquina?.Nombre ?? string.Empty,
            OrdenProduccionId = t.OrdenProduccionId,
            OrdenProduccionNumero = t.OrdenProduccion?.Numero ?? string.Empty,
            ActividadId = t.ActividadId,
            ActividadNombre = t.Actividad?.Nombre ?? "Desconocida", 
            ActividadCodigo = t.Actividad?.Codigo ?? "",
            Tiros = t.Tiros,
            Desperdicio = t.Desperdicio,
            Observaciones = t.Observaciones ?? string.Empty,
            SubCodigoActividad = t.SubCodigoActividad,
            SubCodigoDetalle = t.SubCodigoDetalle,
            Estado = t.Estado,
            PausadoEn = t.PausadoEn,
            TiempoPausadoSegundos = t.TiempoPausadoSegundos,
            MaquinaMeta100Porciento = t.Maquina?.Meta100Porciento ?? 0,
            ActividadEsProductiva = t.Actividad?.EsProductiva ?? false
        }).ToList();
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

        // Si horaInicio == horaFin y duracion = 0, el registro se está abriendo "en curso" desde la tablet.
        var estaEnCurso = request.HoraInicio == request.HoraFin
            && (string.IsNullOrEmpty(request.Duracion) || request.Duracion == "00:00:00");

        if (estaEnCurso)
        {
            var horaCorte = request.Fecha.Date.Add(TimeSpan.Parse(request.HoraInicio));
            await CerrarProcesosAbiertosAnterioresAsync(
                request.UsuarioId, request.MaquinaId, request.Fecha.Date, horaCorte);
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
            Observaciones = request.Observaciones,
            SubCodigoActividad = request.SubCodigoActividad,
            SubCodigoDetalle = request.SubCodigoDetalle,
            HorarioId = request.HorarioId,
            Estado = estaEnCurso ? "EnProgreso" : "Finalizado",
            TiempoPausadoSegundos = 0,
            PausadoEn = null
        };

        try {
             System.IO.File.AppendAllText("debug_log.txt", $"[{DateTime.Now}] RegistrarTiempo - HorarioId Request: {request.HorarioId}, Maquina: {request.MaquinaId}\n");
        } catch {}

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
            Observaciones = tiempoProceso.Observaciones,
            SubCodigoActividad = tiempoProceso.SubCodigoActividad,
            SubCodigoDetalle = tiempoProceso.SubCodigoDetalle,
            Estado = tiempoProceso.Estado,
            PausadoEn = tiempoProceso.PausadoEn,
            TiempoPausadoSegundos = tiempoProceso.TiempoPausadoSegundos
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
            await _context.SaveChangesAsync(); // FORCE ID GENERATION
        }

        // 2. Obtener todos los tiempos del día para recálculo
        var tiempos = await _context.TiemposProceso
            .Include(t => t.Actividad)
            .Include(t => t.Usuario) // ADDED for logging
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
            
            // Obtener el HorarioId del primer registro que tenga uno asignado
            var primerHorario = tiempos.FirstOrDefault(t => t.HorarioId.HasValue);
            
            try {
                var logMsg = $"[{DateTime.Now}] UpdateProdDiaria - Fecha: {fecha}, Maq: {maquinaId}, Usu: {usuarioId}, Tiempos: {tiempos.Count}, PrimerHorario: {primerHorario?.HorarioId}\n";
                System.IO.File.AppendAllText("debug_log.txt", logMsg);
            } catch {}

            if (primerHorario != null)
            {
                diario.HorarioId = primerHorario.HorarioId;
                try {
                    System.IO.File.AppendAllText("debug_log.txt", $"[{DateTime.Now}] Asignando HorarioId {diario.HorarioId} a ProduccionDiaria\n");
                } catch {}
            }
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

        // 3.1 Calcular Cambios de OP (Nueva Lógica: Puesta a Punto + Cambio de OP)
        // REGLAS:
        // 1. Considerar eventos de Puesta a Punto (01) y Producción (02)
        // 2. Solo contar como cambio si es "Puesta a Punto" (01) Y la OP es diferente a la anterior
        // 3. La OP 460 NO cuenta
        
        // Filtrar tiempos relevantes (01 y 02)
        var tiemposRelevantes = tiempos
            .Where(t => t.OrdenProduccion != null && (t.Actividad?.Codigo == "01" || t.Actividad?.Codigo == "02"))
            .OrderBy(t => t.HoraInicio)
            .ToList();

        // Obtener la última OP del día anterior (01 o 02, no 460)
        // CAMBIO: Busca el último registro con Fecha < fecha actual.
        var ultimoRegistroAyer = await _context.TiemposProceso
            .Include(t => t.OrdenProduccion)
            .Include(t => t.Actividad)
            .Where(t => t.Fecha < fecha 
                        && t.MaquinaId == maquinaId 
                        // && t.UsuarioId == usuarioId  <-- History is Machine-wide
                        && t.OrdenProduccionId.HasValue
                        && t.OrdenProduccion != null // Guard against broken FK
                        && t.Actividad != null       // Guard against broken FK
                        && (t.Actividad.Codigo == "01" || t.Actividad.Codigo == "02")
                        && t.OrdenProduccion.Numero != "460")
            .OrderByDescending(t => t.Fecha)
            .ThenByDescending(t => t.HoraFin)
            .FirstOrDefaultAsync();
        
        int cambios = 0;
        // Inicializar con la OP de ayer para comparar el inicio del turno
        int? opAnteriorId = ultimoRegistroAyer?.OrdenProduccionId;
        
        foreach (var t in tiemposRelevantes)
        {
            // Si la OP actual es 460, ignorar
            if (t.OrdenProduccion!.Numero == "460") continue;

            // Chequear cambio
            // Si no hay OP anterior (primera vez o hueco histórico), asumimos cambio (setup inicial).
            // Si hay OP anterior, solo cuenta si es diferente.
            if (!opAnteriorId.HasValue || t.OrdenProduccionId != opAnteriorId)
            {
                 cambios++;
            }
            
            // Actualizamos la posteridad siempre (sea 01 o 02) para detectar cambios futuros
            // Ejemplo: Prod A -> Prod B (No cuenta) -> Setup B (No cambio) -> Setup C (Cuenta)
            opAnteriorId = t.OrdenProduccionId;
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
            
            // Meta base: El reporte usa Meta100Porciento * 0.75 como umbral de bonificación.
            decimal meta100Base = maquina.Meta100Porciento > 0 ? (decimal)maquina.Meta100Porciento : 
                (maquina.MetaRendimiento > 0 ? (decimal)maquina.MetaRendimiento / 0.75m : 0);
            var meta75 = meta100Base * 0.75m;
            
            // Tiros equivalentes por cambios (se suman tanto al total como al bonificable)
            var tirosEquivalentes = diario.Cambios * maquina.TirosReferencia;

            // 1. ValorAPagar TOTAL (Todas las horas)
            var tirosNetosTotales = (diario.TirosDiarios + tirosEquivalentes) - diario.Desperdicio;
            var tirosExtraTotales = Math.Max(0, tirosNetosTotales - meta75);
            diario.ValorAPagar = tirosExtraTotales * diario.ValorTiroSnapshot;
            
            // 2. ValorAPagar BONIFICABLE (Prorrateado por horas trabajadas)
            // Lógica ajustada para coincidir con el Frontend: La meta se ajusta a las horas trabajadas.
            // Si trabajó 4 horas, la meta es el 50% de la diaria. Si trabajó 12 horas, es el 150%.
            // Misma base que el cuadro de captura: productivas + mantenimiento + otros aux (sin descanso ni tiempos muertos)
            decimal horasParaMeta = Math.Round(diario.TotalHorasProductivas, 2) +
                                   Math.Round(diario.HorasMantenimiento, 2) +
                                   Math.Round(diario.HorasOtrosAux, 2);

            decimal factorProrrateo = horasParaMeta > 0 ? (horasParaMeta / 8.0m) : 0;
            decimal meta100Prorrateada = meta100Base * factorProrrateo;
            decimal meta75Prorrateada = meta100Prorrateada * 0.75m;

            var tirosNetosBonif = (diario.TirosBonificables + tirosEquivalentes) - diario.DesperdicioBonificable;
            
            // Usar la meta prorrateada para el cálculo de bonificación
            var tirosExtraBonif = Math.Max(0, tirosNetosBonif - meta75Prorrateada);
            diario.ValorAPagarBonificable = tirosExtraBonif * diario.ValorTiroSnapshot;
        }
        
        // Marcar si hay tiros bonificables
        diario.EsHorarioLaboral = diario.TirosBonificables > 0;

        // 6. Sincronizar ProduccionDiariaDetalles (Sincronización en Tiempo Real con Día Detallado)
        // Eliminamos detalles existentes para esta cabecera y repoblamos desde TiemposProceso
        var detallesViejos = await _context.ProduccionDiariaDetalles
            .Where(d => d.ProduccionDiariaId == diario.Id)
            .ToListAsync();
        _context.ProduccionDiariaDetalles.RemoveRange(detallesViejos);

        foreach (var t in tiempos.OrderBy(t => t.HoraInicio))
        {
            var nuevoDetalle = new ProduccionDiariaDetalle
            {
                ProduccionDiariaId = diario.Id,
                ProduccionDiaria = diario, // Use navigation property for robustness
                HoraInicio = t.HoraInicio.TimeOfDay,
                HoraFin = t.HoraFin.TimeOfDay,
                ActividadId = t.ActividadId,
                Tiros = t.Tiros,
                Desperdicio = t.Desperdicio,
                ReferenciaOP = t.OrdenProduccion?.Numero ?? "",
                Observaciones = t.Observaciones
            };
            _context.ProduccionDiariaDetalles.Add(nuevoDetalle);
        }

        await _context.SaveChangesAsync();
    }

    public async Task RecalcularProduccionMesAsync(int anio, int mes)
    {
        // 1. Obtener todos los registros de ProduccionDiaria para el mes (incluye manuales/huérfanos)
        var resumenes = await _context.ProduccionDiaria
            .Include(p => p.Maquina)
            .Include(p => p.Usuario) // Include user for logging
            .Where(p => p.Fecha.Year == anio && p.Fecha.Month == mes)
            .ToListAsync();

        foreach (var diario in resumenes)
        {
            // Verificar si existen TiemposProceso asociados
            var existenTiempos = await _context.TiemposProceso
                .AnyAsync(t => t.Fecha == diario.Fecha && t.MaquinaId == diario.MaquinaId && t.UsuarioId == diario.UsuarioId);

            if (existenTiempos)
            {
                // Flujo normal: Reconstruir desde TiemposProceso
                await ActualizarProduccionDiaria(diario.Fecha, diario.MaquinaId, diario.UsuarioId);
            }
            else
            {
                // NEW: Use ProduccionDiariaDetalles as fallback if TiempoProcesos is empty (Modern architecture)
                var detalles = await _context.ProduccionDiariaDetalles
                    .Include(d => d.Actividad)
                    .Where(d => d.ProduccionDiariaId == diario.Id)
                    .ToListAsync();

                // Reset counters for recalculation
                diario.TiempoPuestaPunto = 0;
                diario.HorasOperativas = 0;
                diario.TirosDiarios = 0;
                diario.Desperdicio = 0;
                diario.TiempoReparacion = 0;
                diario.HorasDescanso = 0;
                diario.TiempoOtroMuerto = 0;
                diario.HorasMantenimiento = 0;
                diario.TiempoFaltaTrabajo = 0;
                diario.HorasOtrosAux = 0;
                diario.TirosBonificables = 0;
                diario.DesperdicioBonificable = 0;
                diario.ValorAPagar = 0;
                diario.ValorAPagarBonificable = 0;
                diario.TotalHorasProductivas = 0;
                diario.TotalHorasAuxiliares = 0;
                diario.TotalTiemposMuertos = 0;
                diario.TotalHoras = 0;
                diario.PromedioHoraProductiva = 0;
                diario.EsHorarioLaboral = false;

                if (detalles.Any())
                {
                    // Recalculate from detail rows
                    foreach (var d in detalles)
                    {
                        decimal horas = 0;
                        if (d.HoraFin > d.HoraInicio)
                            horas = (decimal)(d.HoraFin - d.HoraInicio).TotalHours;

                        string codigo = d.Actividad?.Codigo ?? "";

                        switch (d.ActividadId)
                        {
                            case 1: // Puesta a Punto
                                diario.TiempoPuestaPunto += horas;
                                diario.TirosDiarios += d.Tiros;
                                diario.Desperdicio += d.Desperdicio;
                                if (HorarioLaboralHelper.EsRegistroBonificable(diario.Fecha, d.HoraInicio, d.HoraFin))
                                {
                                    diario.TirosBonificables += d.Tiros;
                                    diario.DesperdicioBonificable += d.Desperdicio;
                                }
                                break;
                            case 2: // Producción
                                diario.HorasOperativas += horas;
                                diario.TirosDiarios += d.Tiros;
                                diario.Desperdicio += d.Desperdicio;

                                if (HorarioLaboralHelper.EsRegistroBonificable(diario.Fecha, d.HoraInicio, d.HoraFin))
                                {
                                    diario.TirosBonificables += d.Tiros;
                                    diario.DesperdicioBonificable += d.Desperdicio;
                                }
                                break;
                            case 3: diario.TiempoReparacion += horas; break;
                            case 4: diario.HorasDescanso += horas; break;
                            case 5: diario.TiempoOtroMuerto += horas; break;
                            case 6: diario.HorasMantenimiento += horas; break;
                            case 13: diario.TiempoFaltaTrabajo += horas; break;
                            case 14: diario.HorasOtrosAux += horas; break;
                            default: diario.HorasOtrosAux += horas; break;
                        }
                    }

                    diario.TotalHorasProductivas = diario.HorasOperativas + diario.TiempoPuestaPunto;
                    diario.TotalHorasAuxiliares = diario.HorasMantenimiento + diario.HorasDescanso + diario.HorasOtrosAux;
                    diario.TotalTiemposMuertos = diario.TiempoFaltaTrabajo + diario.TiempoReparacion + diario.TiempoOtroMuerto;
                    
                    // -----------------------------------------
                    // LOGICA DE BONIFICACION (Match Frontend)
                    if (diario.Maquina != null)
                    {
                        diario.ValorTiroSnapshot = diario.Maquina.ValorPorTiro;

                        // Meta base: El reporte usa Meta100Porciento * 0.75 como umbral de bonificación.
                        decimal meta100Base = diario.Maquina.Meta100Porciento > 0 ? (decimal)diario.Maquina.Meta100Porciento : 
                            (diario.Maquina.MetaRendimiento > 0 ? (decimal)diario.Maquina.MetaRendimiento / 0.75m : 0);
                        var meta75 = meta100Base * 0.75m;

                        // Tiros equivalentes por cambios
                        var tirosEquivalentes = diario.Cambios * diario.Maquina.TirosReferencia;

                        // 1. ValorAPagar TOTAL
                        // NO SOBREESCRIBIR: El Cuadro (frontend) ya guarda el valor correcto.
                        // El reporte debe usar exactamente el mismo valor que muestra el Cuadro.
                        // var tirosNetosTotales = (diario.TirosDiarios + tirosEquivalentes) - diario.Desperdicio;
                        // var tirosExtraTotales = Math.Max(0, tirosNetosTotales - meta75);
                        // diario.ValorAPagar = tirosExtraTotales * diario.ValorTiroSnapshot;

                        // 2. ValorAPagar BONIFICABLE (Prorrateado) — misma base de horas que captura mensual
                        decimal horasParaMeta = Math.Round(diario.TotalHorasProductivas, 2) +
                                               Math.Round(diario.HorasMantenimiento, 2) +
                                               Math.Round(diario.HorasOtrosAux, 2);

                        decimal factorProrrateo = horasParaMeta > 0 ? (horasParaMeta / 8.0m) : 0;
                        decimal meta100Prorrateada = meta100Base * factorProrrateo;
                        decimal meta75Prorrateada = meta100Prorrateada * 0.75m;

                        var tirosNetosBonif = (diario.TirosBonificables + tirosEquivalentes) - diario.DesperdicioBonificable;
                        var tirosExtraBonif = Math.Max(0, tirosNetosBonif - meta75Prorrateada);
                        
                        // NO SOBREESCRIBIR: El Cuadro (frontend) ya guarda el valor correcto.
                        // diario.ValorAPagarBonificable = Math.Round(tirosExtraBonif * diario.ValorTiroSnapshot, 0, MidpointRounding.AwayFromZero);
                        
                        diario.EsHorarioLaboral = diario.TirosBonificables > 0;
                        
                        // Sincronizar TotalHoras para que coincida con el reporte
                        diario.TotalHoras = diario.TotalHorasProductivas + diario.HorasMantenimiento + diario.HorasDescanso + diario.HorasOtrosAux + diario.TiempoFaltaTrabajo + diario.TiempoReparacion + diario.TiempoOtroMuerto;
                    }
                    // -----------------------------------------

                    await _context.SaveChangesAsync();
                }
                else
                {
                    // No details either - just recalculate bonification from existing totals
                    await RecalcularDesdeResumen(diario);
                }
            }
        }
    }

    private async Task RecalcularDesdeResumen(ProduccionDiaria diario)
    {
        if (diario.Maquina == null) return;

        // Validar bonificación (Reglas relajadas: Lunes-Sábado todo el día)
        bool esBonificable = HorarioLaboralHelper.EsDentroHorarioLaboral(diario.Fecha, TimeSpan.Zero); // Hora no importa para Lunes-Sabado

        // Actualizar flags y contadores bonificables basados en totales
        if (esBonificable)
        {
            diario.TirosBonificables = diario.TirosDiarios;
            diario.DesperdicioBonificable = diario.Desperdicio;
        }
        else
        {
            diario.TirosBonificables = 0;
            diario.DesperdicioBonificable = 0;
        }

        diario.ValorTiroSnapshot = diario.Maquina.ValorPorTiro;

        // Meta base: El reporte usa Meta100Porciento * 0.75 como umbral de bonificación.
        decimal meta100Base = diario.Maquina.Meta100Porciento > 0 ? (decimal)diario.Maquina.Meta100Porciento : 
            (diario.Maquina.MetaRendimiento > 0 ? (decimal)diario.Maquina.MetaRendimiento / 0.75m : 0);
        var meta75 = meta100Base * 0.75m;
        
        // Incluir cambios en el total de tiros para pago
        var tirosEquivalentes = diario.Cambios * diario.Maquina.TirosReferencia;
        
        // NO SOBREESCRIBIR: El Cuadro (frontend) ya guarda ValorAPagar y ValorAPagarBonificable.
        // El reporte debe usar exactamente el mismo valor que muestra el Cuadro.
        // var tirosNetosTotales = (diario.TirosDiarios + tirosEquivalentes) - diario.Desperdicio;
        // var tirosExtraTotales = Math.Max(0, tirosNetosTotales - meta75);
        // diario.ValorAPagar = tirosExtraTotales * diario.ValorTiroSnapshot;
        // var tirosNetosBonif = (diario.TirosBonificables + tirosEquivalentes) - diario.DesperdicioBonificable;
        // var tirosExtraBonif = Math.Max(0, tirosNetosBonif - meta75);
        // diario.ValorAPagarBonificable = tirosExtraBonif * diario.ValorTiroSnapshot;

        await _context.SaveChangesAsync();
    }

    public async Task<TiempoProcesoDto> FinalizarTiempoAsync(long id, RegistrarTiempoRequest request)
    {
        var tiempo = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tiempo == null) throw new Exception("Registro no encontrado");

        // Si estaba pausado al pulsar Stop, contabilizamos el lapso de pausa final para no
        // perderlo (acumulado total se mantiene aunque el tiempo lo gestione el frontend).
        // Usamos DateTime.Now (hora local del servidor) para que sea consistente con
        // HoraInicio/HoraFin y los timestamps que ve el frontend.
        if (tiempo.Estado == "Pausado" && tiempo.PausadoEn.HasValue)
        {
            var pausadoEnLocal = NormalizarFechaLocal(tiempo.PausadoEn.Value);
            var lapsoSeg = (long)Math.Max(0, (DateTime.Now - pausadoEnLocal).TotalSeconds);
            tiempo.TiempoPausadoSegundos += lapsoSeg;
            tiempo.PausadoEn = null;
        }

        tiempo.HoraFin = request.Fecha.Date.Add(TimeSpan.Parse(request.HoraFin));
        tiempo.Duracion = TimeSpan.Parse(request.Duracion).Ticks;

        tiempo.Tiros = request.Tiros;
        tiempo.Desperdicio = request.Desperdicio;
        if (!string.IsNullOrEmpty(request.Observaciones))
            tiempo.Observaciones = request.Observaciones;
        tiempo.SubCodigoActividad = request.SubCodigoActividad;
        tiempo.SubCodigoDetalle = request.SubCodigoDetalle;
        tiempo.Estado = "Finalizado";

        await _context.SaveChangesAsync();
        await ActualizarProduccionDiaria(tiempo.Fecha, tiempo.MaquinaId, tiempo.UsuarioId);

        try
        {
            await _programacionEjecucion.OnTiempoFinalizadoAsync(tiempo);
        }
        catch
        {
            // No bloquear la finalización del operario si falla el ajuste del planeador.
        }

        return new TiempoProcesoDto
        {
            Id = tiempo.Id,
            Fecha = tiempo.Fecha,
            HoraInicio = tiempo.HoraInicio.ToString("HH:mm:ss"),
            HoraFin = tiempo.HoraFin.ToString("HH:mm:ss"),
            Duracion = TimeSpan.FromTicks(tiempo.Duracion).ToString(@"hh\:mm\:ss"),
            UsuarioId = tiempo.UsuarioId,
            UsuarioNombre = tiempo.Usuario?.Nombre ?? "",
            MaquinaId = tiempo.MaquinaId,
            MaquinaNombre = tiempo.Maquina?.Nombre ?? "",
            OrdenProduccionId = tiempo.OrdenProduccionId,
            OrdenProduccionNumero = tiempo.OrdenProduccion?.Numero,
            ActividadId = tiempo.ActividadId,
            ActividadNombre = tiempo.Actividad?.Nombre ?? "",
            ActividadCodigo = tiempo.Actividad?.Codigo ?? "",
            Tiros = tiempo.Tiros,
            Desperdicio = tiempo.Desperdicio,
            Observaciones = tiempo.Observaciones,
            SubCodigoActividad = tiempo.SubCodigoActividad,
            SubCodigoDetalle = tiempo.SubCodigoDetalle,
            Estado = tiempo.Estado,
            PausadoEn = tiempo.PausadoEn,
            TiempoPausadoSegundos = tiempo.TiempoPausadoSegundos
        };
    }

    public async Task<TiempoProcesoDto> PausarTiempoAsync(long id)
    {
        var tiempo = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tiempo == null) throw new Exception("Registro no encontrado");
        if (tiempo.Estado == "Finalizado")
            throw new Exception("El proceso ya está finalizado");

        // Pausar es idempotente: si ya estaba pausado, no movemos PausadoEn.
        // Guardamos en hora local del servidor (igual que HoraInicio/HoraFin)
        // para evitar desfase de zona horaria al mostrarse en el cliente.
        if (tiempo.Estado != "Pausado")
        {
            tiempo.Estado = "Pausado";
            tiempo.PausadoEn = DateTime.Now;
            await _context.SaveChangesAsync();
        }

        return ToDto(tiempo);
    }

    public async Task<TiempoProcesoDto> ReanudarTiempoAsync(long id)
    {
        var tiempo = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tiempo == null) throw new Exception("Registro no encontrado");
        if (tiempo.Estado == "Finalizado")
            throw new Exception("El proceso ya está finalizado");

        if (tiempo.Estado == "Pausado" && tiempo.PausadoEn.HasValue)
        {
            // Aseguramos que el cálculo se haga siempre en hora local del servidor,
            // tolerando registros antiguos que pudieran haberse guardado en UTC.
            var pausadoEnLocal = NormalizarFechaLocal(tiempo.PausadoEn.Value);
            var lapsoSeg = (long)Math.Max(0, (DateTime.Now - pausadoEnLocal).TotalSeconds);
            tiempo.TiempoPausadoSegundos += lapsoSeg;
            tiempo.PausadoEn = null;
            tiempo.Estado = "EnProgreso";
            await _context.SaveChangesAsync();
        }

        return ToDto(tiempo);
    }

    public async Task<TiempoProcesoDto?> ActualizarProgresoAsync(long id, ActualizarProgresoRequest request)
    {
        var tiempo = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tiempo == null || tiempo.Estado == "Finalizado") return null;

        tiempo.Tiros = Math.Max(0, request.Tiros);
        tiempo.Desperdicio = Math.Max(0, request.Desperdicio);
        await _context.SaveChangesAsync();
        return ToDto(tiempo);
    }

    public async Task<TiempoProcesoDto> AjustarTiempoAsync(long id, AjustarTiempoRequest request)
    {
        var tiempo = await _context.TiemposProceso
            .Include(t => t.Usuario)
            .Include(t => t.Maquina)
            .Include(t => t.Actividad)
            .Include(t => t.OrdenProduccion)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tiempo == null) throw new Exception("Registro no encontrado");

        if (!string.IsNullOrWhiteSpace(request.HoraInicio))
            tiempo.HoraInicio = tiempo.Fecha.Date.Add(TimeSpan.Parse(request.HoraInicio));

        if (!string.IsNullOrWhiteSpace(request.HoraFin))
            tiempo.HoraFin = tiempo.Fecha.Date.Add(TimeSpan.Parse(request.HoraFin));

        if (request.Tiros.HasValue) tiempo.Tiros = request.Tiros.Value;
        if (request.Desperdicio.HasValue) tiempo.Desperdicio = request.Desperdicio.Value;
        if (request.Observaciones != null) tiempo.Observaciones = request.Observaciones;

        if (request.ActividadId.HasValue && request.ActividadId.Value > 0)
        {
            var actividad = await _context.Actividades.FindAsync(request.ActividadId.Value);
            if (actividad == null) throw new Exception("Actividad no válida");
            tiempo.ActividadId = actividad.Id;
        }

        if (request.OrdenProduccionId.HasValue)
        {
            tiempo.OrdenProduccionId = request.OrdenProduccionId.Value <= 0
                ? null
                : request.OrdenProduccionId.Value;
        }
        else if (request.ReferenciaOP != null)
        {
            var refOp = request.ReferenciaOP.Trim();
            if (string.IsNullOrEmpty(refOp))
            {
                tiempo.OrdenProduccionId = null;
            }
            else
            {
                var existingOp = await _context.OrdenesProduccion
                    .FirstOrDefaultAsync(op => op.Numero == refOp);
                if (existingOp != null)
                {
                    tiempo.OrdenProduccionId = existingOp.Id;
                }
                else
                {
                    var newOp = new OrdenProduccion
                    {
                        Numero = refOp,
                        Descripcion = "Generada Automáticamente",
                        Estado = "EnProceso",
                        FechaCreacion = DateTime.Now
                    };
                    _context.OrdenesProduccion.Add(newOp);
                    await _context.SaveChangesAsync();
                    tiempo.OrdenProduccionId = newOp.Id;
                }
            }
        }

        var debeFinalizar = request.Finalizar
            || (tiempo.Estado != "Finalizado" && tiempo.HoraFin > tiempo.HoraInicio);

        if (debeFinalizar)
        {
            if (tiempo.Estado == "Pausado" && tiempo.PausadoEn.HasValue)
            {
                var pausadoEnLocal = NormalizarFechaLocal(tiempo.PausadoEn.Value);
                tiempo.TiempoPausadoSegundos += (long)Math.Max(0, (tiempo.HoraFin - pausadoEnLocal).TotalSeconds);
                tiempo.PausadoEn = null;
            }

            var inicio = NormalizarFechaLocal(tiempo.HoraInicio);
            var fin = NormalizarFechaLocal(tiempo.HoraFin);
            var seg = (long)Math.Max(0, (fin - inicio).TotalSeconds - tiempo.TiempoPausadoSegundos);
            tiempo.Duracion = TimeSpan.FromSeconds(seg).Ticks;
            tiempo.Estado = "Finalizado";
        }

        await _context.SaveChangesAsync();
        await _context.Entry(tiempo).Reference(t => t.Actividad).LoadAsync();
        await _context.Entry(tiempo).Reference(t => t.OrdenProduccion).LoadAsync();
        await ActualizarProduccionDiaria(tiempo.Fecha, tiempo.MaquinaId, tiempo.UsuarioId);
        return ToDto(tiempo);
    }

    public async Task<int> RepararProcesosAbiertosAsync(DateTime fecha, int? maquinaId, int? usuarioId)
    {
        var query = _context.TiemposProceso
            .Where(t => t.Fecha.Date == fecha.Date
                && (t.Estado == "EnProgreso" || t.Estado == "Pausado"));

        if (maquinaId.HasValue) query = query.Where(t => t.MaquinaId == maquinaId.Value);
        if (usuarioId.HasValue) query = query.Where(t => t.UsuarioId == usuarioId.Value);

        var abiertos = await query.OrderBy(t => t.HoraInicio).ToListAsync();
        var grupos = abiertos.GroupBy(t => new { t.UsuarioId, t.MaquinaId });
        var cerrados = 0;

        foreach (var grupo in grupos)
        {
            var lista = grupo.OrderBy(t => t.HoraInicio).ToList();
            if (lista.Count <= 1) continue;

            for (var i = 0; i < lista.Count - 1; i++)
            {
                var corte = lista[i + 1].HoraInicio;
                await FinalizarRegistroEnCorteAsync(lista[i], corte);
                cerrados++;
            }
        }

        if (cerrados > 0)
            await _context.SaveChangesAsync();

        var pares = abiertos.Select(t => new { t.MaquinaId, t.UsuarioId }).Distinct();
        foreach (var p in pares)
            await ActualizarProduccionDiaria(fecha.Date, p.MaquinaId, p.UsuarioId);

        return cerrados;
    }

    private async Task CerrarProcesosAbiertosAnterioresAsync(
        int usuarioId, int maquinaId, DateTime fecha, DateTime horaCorte)
    {
        var abiertos = await _context.TiemposProceso
            .Where(t => t.UsuarioId == usuarioId
                && t.MaquinaId == maquinaId
                && t.Fecha.Date == fecha.Date
                && (t.Estado == "EnProgreso" || t.Estado == "Pausado"))
            .ToListAsync();

        foreach (var t in abiertos)
            await FinalizarRegistroEnCorteAsync(t, horaCorte);

        if (abiertos.Count > 0)
            await _context.SaveChangesAsync();
    }

    private Task FinalizarRegistroEnCorteAsync(TiempoProceso tiempo, DateTime horaCorte)
    {
        if (tiempo.Estado == "Pausado" && tiempo.PausadoEn.HasValue)
        {
            var pausadoEnLocal = NormalizarFechaLocal(tiempo.PausadoEn.Value);
            tiempo.TiempoPausadoSegundos += (long)Math.Max(0, (horaCorte - pausadoEnLocal).TotalSeconds);
            tiempo.PausadoEn = null;
        }

        tiempo.HoraFin = horaCorte;
        var inicio = NormalizarFechaLocal(tiempo.HoraInicio);
        var seg = (long)Math.Max(0, (horaCorte - inicio).TotalSeconds - tiempo.TiempoPausadoSegundos);
        tiempo.Duracion = TimeSpan.FromSeconds(seg).Ticks;
        tiempo.Estado = "Finalizado";
        return Task.CompletedTask;
    }

    /// <summary>
    /// Devuelve la fecha en hora local. Si el <see cref="DateTime.Kind"/> es <c>Utc</c>
    /// la convierte a local; si es <c>Unspecified</c> asume que ya viene en local
    /// (caso típico al leer columnas <c>timestamp without time zone</c>).
    /// </summary>
    private static DateTime NormalizarFechaLocal(DateTime fecha)
    {
        return fecha.Kind switch
        {
            DateTimeKind.Utc => fecha.ToLocalTime(),
            _ => fecha
        };
    }

    private static TiempoProcesoDto ToDto(TiempoProceso t)
    {
        return new TiempoProcesoDto
        {
            Id = t.Id,
            Fecha = t.Fecha,
            HoraInicio = t.HoraInicio.ToString("HH:mm:ss"),
            HoraFin = t.HoraFin.ToString("HH:mm:ss"),
            Duracion = TimeSpan.FromTicks(t.Duracion).ToString(@"hh\:mm\:ss"),
            UsuarioId = t.UsuarioId,
            UsuarioNombre = t.Usuario?.Nombre ?? string.Empty,
            MaquinaId = t.MaquinaId,
            MaquinaNombre = t.Maquina?.Nombre ?? string.Empty,
            OrdenProduccionId = t.OrdenProduccionId,
            OrdenProduccionNumero = t.OrdenProduccion?.Numero,
            ActividadId = t.ActividadId,
            ActividadNombre = t.Actividad?.Nombre ?? string.Empty,
            ActividadCodigo = t.Actividad?.Codigo ?? string.Empty,
            Tiros = t.Tiros,
            Desperdicio = t.Desperdicio,
            Observaciones = t.Observaciones,
            SubCodigoActividad = t.SubCodigoActividad,
            SubCodigoDetalle = t.SubCodigoDetalle,
            Estado = t.Estado,
            PausadoEn = t.PausadoEn,
            TiempoPausadoSegundos = t.TiempoPausadoSegundos
        };
    }
}
