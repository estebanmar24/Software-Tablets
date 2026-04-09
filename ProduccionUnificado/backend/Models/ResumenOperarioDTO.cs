namespace TiempoProcesos.API.Models
{
    public class ResumenOperarioDTO
    {
        public int UsuarioId { get; set; }
        public int? MaquinaId { get; set; }
        public string Operario { get; set; } = string.Empty;
        public string Maquina { get; set; } = string.Empty;
        public int TirosReportados { get; set; }
        public int TirosEquivalentes { get; set; }
        public int TotalCambios { get; set; }
        public int TotalTiros { get; set; }
        public int TirosBonificables { get; set; }
        public decimal TotalHorasProductivas { get; set; }
        public decimal TotalHorasAuxiliares { get; set; }
        public decimal PromedioHoraProductiva { get; set; }
        public decimal TotalHoras { get; set; }
        public decimal ValorAPagar { get; set; }
        public decimal ValorAPagarBonificable { get; set; }
        public decimal ValorBonifPotencial { get; set; }
        public int DiasLaborados { get; set; }
        public decimal MetaBonificacion { get; set; }
        public decimal Meta100Porciento { get; set; }
        public decimal Eficiencia { get; set; }
        public decimal PorcentajeRendimiento75 { get; set; }
        public decimal PorcentajeRendimiento100 { get; set; }
        public string SemaforoColor { get; set; } = "Rojo";
        public string SemaforoColor100 { get; set; } = "Rojo";
        public string UltimaFecha { get; set; } = string.Empty;
    }
}
