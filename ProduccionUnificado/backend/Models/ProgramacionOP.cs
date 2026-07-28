namespace TiempoProcesos.API.Models;

public class ProgramacionOP
{
    public int Id { get; set; }
    public string NumeroOP { get; set; } = string.Empty;
    public int? OrdenProduccionId { get; set; }
    public OrdenProduccion? OrdenProduccion { get; set; }
    public string? NumeroOT { get; set; }
    /// <summary>O. compra cliente (OCR OP).</summary>
    public string? OrdenCompra { get; set; }
    /// <summary>Fecha entrega/despacho (OCR OP).</summary>
    public string? FechaEntrega { get; set; }
    /// <summary>JSON del paso cálculo de horas al programar.</summary>
    public string? CalculoJson { get; set; }
    public string? LineaTroquel { get; set; }
    public string? Referencia { get; set; }
    public string Cliente { get; set; } = string.Empty;
    public int MetaTiros { get; set; }
    /// <summary>Valor/precio de la OP para facturación del planeador.</summary>
    public decimal Precio { get; set; }
    public string? Color { get; set; }
    /// <summary>pendiente | programado | en_ejecucion | finalizado | cancelado</summary>
    public string EstadoGeneral { get; set; } = "programado";
    public bool EsUrgencia { get; set; }
    /// <summary>op | capacitacion | limpieza</summary>
    public string TipoActividad { get; set; } = "op";
    public string? Observaciones { get; set; }
    public string? UsuarioCreador { get; set; }
    public string? UsuarioModificador { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.Now;
    public DateTime? FechaModificacion { get; set; }

    public List<ProgramacionOPProceso> Procesos { get; set; } = new();
}

public class ProgramacionOPProceso
{
    public int Id { get; set; }
    public int ProgramacionOPId { get; set; }
    public ProgramacionOP? ProgramacionOP { get; set; }
    public string Proceso { get; set; } = string.Empty;
    public int? MaquinaId { get; set; }
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public decimal? HorasEstimadas { get; set; }
    public string? TiemposAuxiliaresJson { get; set; }
    public string? Observaciones { get; set; }
    public int OrdenSecuencia { get; set; }
}
