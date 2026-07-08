using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    [Table("PlanAccionObservaciones")]
    public class PlanAccionObservacion
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PlanAccionId { get; set; }

        [Required]
        public string Texto { get; set; } = string.Empty;

        public string? Usuario { get; set; }

        public DateTime FechaRegistro { get; set; } = DateTime.Now;

        [ForeignKey("PlanAccionId")]
        public virtual PlanAccion? PlanAccion { get; set; }
    }
}
