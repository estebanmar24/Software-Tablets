namespace TiempoProcesos.API.DTOs;

public class TiempoAuxiliarDto
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Horas { get; set; }
}

public class ProgramacionProcesoInputDto
{
    public string Proceso { get; set; } = string.Empty;
    public int? MaquinaId { get; set; }
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public List<TiempoAuxiliarDto> TiemposAuxiliares { get; set; } = new();
}

public class CrearProgramacionOPDto
{
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public string? NumeroOT { get; set; }
    public string? OrdenCompra { get; set; }
    public string? FechaEntrega { get; set; }
    public string? CalculoJson { get; set; }
    public string? LineaTroquel { get; set; }
    public string? Referencia { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    public decimal Precio { get; set; }
    public string? Color { get; set; }
    public string? EstadoGeneral { get; set; }
    public bool EsUrgencia { get; set; }
    public string? TipoActividad { get; set; }
    public string? Observaciones { get; set; }
    public List<ProgramacionProcesoInputDto> Procesos { get; set; } = new();
}

public class ProgramacionProcesoProgresoDto
{
    public int Id { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public int? MaquinaId { get; set; }
    public string? MaquinaNombre { get; set; }
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public List<TiempoAuxiliarDto> TiemposAuxiliares { get; set; } = new();
    public string Estado { get; set; } = "pendiente";
    public decimal CantidadProducida { get; set; }
    public int PorcentajeTiempo { get; set; }
}

public class ProgramacionOPDetalleDto
{
    public int Id { get; set; }
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public string? NumeroOT { get; set; }
    public string? OrdenCompra { get; set; }
    public string? FechaEntrega { get; set; }
    public string? CalculoJson { get; set; }
    public string? LineaTroquel { get; set; }
    public string? Referencia { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    public decimal Precio { get; set; }
    public string? Color { get; set; }
    public string EstadoGeneral { get; set; } = "programado";
    public bool EsUrgencia { get; set; }
    public string TipoActividad { get; set; } = "op";
    public string? Observaciones { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }
    public List<ProgramacionProcesoProgresoDto> Procesos { get; set; } = new();
    public int ProgresoGeneral { get; set; }
}

public class MetaFacturacionMesDto
{
    public int Anio { get; set; }
    public int Mes { get; set; }
    public decimal Meta { get; set; }
}

public class OpDisponibleProgramacionDto
{
    public string Numero { get; set; } = string.Empty;
    public bool TieneFicha { get; set; }
    public bool TieneOp { get; set; }
    public bool TieneLineaTroquel { get; set; }
    public bool YaProgramada { get; set; }
    public string? Cliente { get; set; }
    public string? Referencia { get; set; }
    public int? MetaTiros { get; set; }
}

public class DatosOpProgramacionDto
{
    public string Numero { get; set; } = string.Empty;
    public bool TieneFicha { get; set; }
    public bool TieneOp { get; set; }
    public bool TieneLineaTroquel { get; set; }
    public bool ListoParaProgramar { get; set; }
    /// <summary>True si ya existe una programación OP (no urgencia) para este número.</summary>
    public bool YaProgramada { get; set; }
    /// <summary>Id de la programación existente, si YaProgramada.</summary>
    public int? ProgramacionId { get; set; }
    public string? NumeroOT { get; set; }
    /// <summary>O. compra Cliente del documento OP (no es la OT).</summary>
    public string? OrdenCompra { get; set; }
    public string? LineaTroquel { get; set; }
    public string? Cliente { get; set; }
    public string? Referencia { get; set; }
    public int MetaTiros { get; set; }
    public List<string> ProcesosSugeridos { get; set; } = new();
    public string? Mensaje { get; set; }

    // Campos para cálculo de horas (Convertidora / OCR)
    public string? FechaEntrega { get; set; }
    public string? Sustrato { get; set; }
    public string? Calibre { get; set; }
    public string? Gramaje { get; set; }
    public string? AnchoRollo { get; set; }
    public string? LargoCorte { get; set; }
    public string? Hojas { get; set; }
    public string? Cabidad { get; set; }
    public string? Largo { get; set; }
    public string? Ancho { get; set; }
    public string? TamanoFinal { get; set; }
    public int? CantidadTinta { get; set; }
    public string? Colores { get; set; }
    public string? TipoTrabajoHint { get; set; }
    public int CantidadSolicitada { get; set; }
    public int TirosRegistrados { get; set; }
    public int CantidadPiezas { get; set; }
    public bool MultiPieza { get; set; }
    public List<OpPiezaDto> Piezas { get; set; } = new();
}

public class ParametrosCalculoMaquinaDto
{
    public int MaquinaId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int MetaTirosTurno { get; set; }
    public decimal EstandarPorHora { get; set; }
    public decimal HorasAlistamiento { get; set; }
    public decimal HorasLavada { get; set; }
}

public class ProcesoGanttDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Orden { get; set; }
}

public class ProcesoGanttInputDto
{
    public string Nombre { get; set; } = string.Empty;
}

public class ReordenarProcesosDto
{
    public List<int> Ids { get; set; } = new();
}

public class AjusteProgramacionShiftDto
{
    public int Id { get; set; }
    public List<ProgramacionProcesoInputDto> Procesos { get; set; } = new();
}

public class CrearUrgenciaProgramacionDto
{
    public CrearProgramacionOPDto Urgencia { get; set; } = new();
    public List<AjusteProgramacionShiftDto> Ajustes { get; set; } = new();
}

public class CrearAuxiliarProgramacionDto
{
    public CrearProgramacionOPDto Actividad { get; set; } = new();
    public List<AjusteProgramacionShiftDto> Ajustes { get; set; } = new();
}
