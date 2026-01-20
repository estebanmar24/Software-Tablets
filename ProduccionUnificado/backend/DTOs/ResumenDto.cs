namespace TiempoProcesos.API.DTOs;

public class ResumenMensualDto
{
    public List<ResumenOperarioDto> ResumenOperarios { get; set; } = new();
    public List<ResumenMaquinaDto> ResumenMaquinas { get; set; } = new();
    public List<ResumenDiarioDto> TendenciaDiaria { get; set; } = new();
    
    // Calificación Total de la Planta (suma de calificaciones de todas las máquinas)
    public decimal CalificacionTotalPlanta { get; set; }
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
    public decimal ValorAPagarBonificable { get; set; } // Solo tiros dentro del horario laboral
    public int TirosBonificables { get; set; } // Tiros dentro del horario laboral
    
    // Fields for reporting
    public int DiasLaborados { get; set; }
    public decimal MetaBonificacion { get; set; } // Meta 75%
    public decimal Meta100Porciento { get; set; } // Meta 100%
    public decimal Eficiencia { get; set; }
    public decimal PorcentajeRendimiento75 { get; set; } // Porcentaje vs meta 75%
    public decimal PorcentajeRendimiento100 { get; set; } // Porcentaje vs meta 100%
    public string SemaforoColor { get; set; } = "Gris"; // Semáforo 75%
    public string SemaforoColor100 { get; set; } = "Gris"; // Semáforo 100%
}

public class ResumenMaquinaDto
{
    public int MaquinaId { get; set; }
    public string Maquina { get; set; } = string.Empty;
    public decimal TirosTotales { get; set; }
    public decimal RendimientoEsperado { get; set; }
    public decimal Meta75Porciento { get; set; } // Meta 75%
    public decimal Meta100Porciento { get; set; } // Meta 100%
    public decimal PorcentajeRendimiento { get; set; }
    public string SemaforoColor { get; set; } = "Gris";
    public decimal TotalTiemposMuertos { get; set; } 
    public decimal TotalTiempoReparacion { get; set; }
    public decimal TotalTiempoFaltaTrabajo { get; set; }
    public decimal TotalTiempoOtro { get; set; }
    
    // Campos para Calificación de la Planta
    public decimal Importancia { get; set; } // % de importancia de la máquina (suma 100% entre todas)
    public decimal PorcentajeRendimiento100 { get; set; } // Sem 100% (TirosTotales / Meta100)
    public decimal Calificacion { get; set; } // PorcentajeRendimiento100 * (Importancia / 100)
}

public class ResumenDiarioDto
{
    public DateTime Fecha { get; set; }
    public decimal Tiros { get; set; }
    public decimal Desperdicio { get; set; }
}
