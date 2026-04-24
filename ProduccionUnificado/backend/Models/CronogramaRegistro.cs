using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    public class CronogramaRegistro
    {
        public int Id { get; set; }

        public int HojaVidaId { get; set; }
        
        public int ActividadId { get; set; }

        public int Anio { get; set; }
        
        public int Mes { get; set; } // 1 a 12
        
        public int Dia { get; set; } = 0; // 0 = Registro mensual (por defecto), 1-31 = Registro diario
        public int Estado { get; set; } = 0; 
        
        public string? Nota { get; set; }

        [ForeignKey("HojaVidaId")]
        public HojaVidaMaquina? Maquina { get; set; }

        [ForeignKey("ActividadId")]
        public CronogramaActividad? Actividad { get; set; }
    }
}
