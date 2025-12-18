namespace TiempoProcesos.API.DTOs;

public class ResumenMensualDto
{
    public List<ResumenOperarioDto> ResumenOperarios { get; set; } = new();
    public List<ResumenMaquinaDto> ResumenMaquinas { get; set; } = new();
    public List<ResumenDiarioDto> TendenciaDiaria { get; set; } = new();
}

public class ResumenOperarioDto
{
    public int UsuarioId { get; set; }
    public int MaquinaId { get; set; }
    public string Operario { get; set; } = string.Empty;
    public string Maquina { get; set; } = string.Empty;
    public decimal TotalTiros { get; set; }
    public decimal TotalHorasProductivas { get; set; }
    public decimal PromedioHoraProductiva { get; set; }
    public decimal TotalHoras { get; set; }
    public decimal ValorAPagar { get; set; }
    
    // Fields for reporting
    public int DiasLaborados { get; set; }
    public decimal MetaBonificacion { get; set; }
    public decimal Eficiencia { get; set; }
    public string SemaforoColor { get; set; } = "Gris";
}

public class ResumenMaquinaDto
{
    public int MaquinaId { get; set; }
    public string Maquina { get; set; } = string.Empty;
    public decimal TirosTotales { get; set; }
    public decimal RendimientoEsperado { get; set; }
    public decimal PorcentajeRendimiento { get; set; }
    public string SemaforoColor { get; set; } = "Gris";
    public decimal TotalTiemposMuertos { get; set; } 
    public decimal TotalTiempoReparacion { get; set; }
    public decimal TotalTiempoFaltaTrabajo { get; set; }
    public decimal TotalTiempoOtro { get; set; }
}

public class ResumenDiarioDto
{
    public DateTime Fecha { get; set; }
    public decimal Tiros { get; set; }
    public decimal Desperdicio { get; set; }
}
