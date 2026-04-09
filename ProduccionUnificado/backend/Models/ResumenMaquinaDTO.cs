namespace TiempoProcesos.API.Models
{
    public class ResumenMaquinaDTO
    {
        public int MaquinaId { get; set; }
        public string Maquina { get; set; } = string.Empty;
        public int TirosReportados { get; set; }
        public int TirosEquivalentes { get; set; }
        public int TotalCambios { get; set; }
        public decimal TotalTiempoPuestaPunto { get; set; }
        public decimal TotalHorasDescanso { get; set; }
        public decimal TotalHorasProductivas { get; set; }
        public decimal TotalHorasAuxiliares { get; set; }
        public int TirosTotales { get; set; }
        public decimal RendimientoEsperado { get; set; }
        public decimal Meta75Porciento { get; set; }
        public decimal Meta100Porciento { get; set; }
        public decimal PorcentajeRendimiento { get; set; }
        public decimal PorcentajeRendimiento100 { get; set; }
        public string SemaforoColor { get; set; } = "Rojo";
        public decimal TotalTiemposMuertos { get; set; }
        public decimal TotalTiempoReparacion { get; set; }
        public decimal TotalTiempoFaltaTrabajo { get; set; }
        public decimal TotalTiempoOtro { get; set; }
        public decimal TotalHoras { get; set; }
        public decimal Importancia { get; set; }
        public decimal Calificacion { get; set; }
        public int DiasLaborados { get; set; }
        public string UltimaFecha { get; set; } = string.Empty;
        public decimal Tarifa { get; set; }
        public decimal MetaDiariaBase { get; set; }
    }
}
