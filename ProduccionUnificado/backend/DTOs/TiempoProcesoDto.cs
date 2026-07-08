namespace TiempoProcesos.API.DTOs;

public class ActividadDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public bool EsProductiva { get; set; }
    public string? Observaciones { get; set; }
}

public class UsuarioDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
}

public class MaquinaDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int MetaRendimiento { get; set; }
    public decimal ValorPorTiro { get; set; }
    public decimal Importancia { get; set; }
    public int Meta100Porciento { get; set; }
}

public class OrdenProduccionDto
{
    public int Id { get; set; }
    public string Numero { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
}

public class TiempoProcesoDto
{
    public long Id { get; set; }
    public DateTime Fecha { get; set; }
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public string Duracion { get; set; } = string.Empty;
    public int UsuarioId { get; set; }
    public string? UsuarioNombre { get; set; }
    public int MaquinaId { get; set; }
    public string? MaquinaNombre { get; set; }
    public int? OrdenProduccionId { get; set; }
    public string? OrdenProduccionNumero { get; set; }
    public int ActividadId { get; set; }
    public string? ActividadNombre { get; set; }
    public string? ActividadCodigo { get; set; }
    public int Tiros { get; set; }
    public int Desperdicio { get; set; }
    public string? Observaciones { get; set; }
    public string? SubCodigoActividad { get; set; }
    public string? SubCodigoDetalle { get; set; }
    /// <summary>'EnProgreso' | 'Pausado' | 'Finalizado'.</summary>
    public string Estado { get; set; } = "Finalizado";
    public DateTime? PausadoEn { get; set; }
    public long TiempoPausadoSegundos { get; set; }

    /// <summary>
    /// Snapshot de la meta de la máquina (tiros al 100% en jornada de 8 horas).
    /// Se utiliza en el frontend para calcular el rendimiento del día por
    /// operario en la pantalla de Historial sin necesidad de cargar el catálogo
    /// completo de máquinas.
    /// </summary>
    public int MaquinaMeta100Porciento { get; set; }

    /// <summary>
    /// Indica si la actividad asociada al registro es productiva (cuenta tiros).
    /// Permite al frontend distinguir entre tiempos productivos y no productivos
    /// al calcular indicadores.
    /// </summary>
    public bool ActividadEsProductiva { get; set; }
}

public class RegistrarTiempoRequest
{
    public DateTime Fecha { get; set; }
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public string Duracion { get; set; } = string.Empty;
    public int UsuarioId { get; set; }
    public int MaquinaId { get; set; }
    public int? OrdenProduccionId { get; set; }
    public string? ReferenciaOP { get; set; }
    public int ActividadId { get; set; }
    public int Tiros { get; set; }
    public int Desperdicio { get; set; }
    public string? Observaciones { get; set; }
    public string? SubCodigoActividad { get; set; }
    public string? SubCodigoDetalle { get; set; }
    public int? HorarioId { get; set; }  // Turno de trabajo
}

public class ProduccionDiaDto
{
    public int TirosTotales { get; set; }
    public int DesperdicioTotal { get; set; }
    public List<TiempoProcesoDto> Historial { get; set; } = new();
}

/// <summary>
/// Corrección administrativa de un registro de tiempo (Historial / Administración).
/// </summary>
public class AjustarTiempoRequest
{
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public int? Tiros { get; set; }
    public int? Desperdicio { get; set; }
    public string? Observaciones { get; set; }
    public int? ActividadId { get; set; }
    public int? OrdenProduccionId { get; set; }
    /// <summary>Número de OP (si no se envía OrdenProduccionId). Vacío quita la OP.</summary>
    public string? ReferenciaOP { get; set; }
    /// <summary>Si true, marca el registro como Finalizado y recalcula la duración.</summary>
    public bool Finalizar { get; set; }
}
