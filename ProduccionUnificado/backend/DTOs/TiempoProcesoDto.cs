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
}

public class ProduccionDiaDto
{
    public int TirosTotales { get; set; }
    public int DesperdicioTotal { get; set; }
    public List<TiempoProcesoDto> Historial { get; set; } = new();
}
