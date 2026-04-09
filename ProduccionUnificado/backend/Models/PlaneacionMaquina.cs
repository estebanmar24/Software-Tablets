using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    public class PlaneacionMaquina
    {
        [Key]
        public int Id { get; set; }

        public int MaquinaId { get; set; }
        
        [ForeignKey("MaquinaId")]
        public Maquina? Maquina { get; set; }

        public int OrdenProduccionId { get; set; }
        
        [ForeignKey("OrdenProduccionId")]
        public OrdenProduccion? OrdenProduccion { get; set; }

        public DateTime FechaInicio { get; set; }
        public DateTime FechaFin { get; set; }

        public int MetaTiros { get; set; }
        public string? Referencia { get; set; }
    }
}
