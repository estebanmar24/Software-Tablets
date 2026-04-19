using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    [Table("PlanesAccion")]
    public class PlanAccion
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Proceso { get; set; } = string.Empty;

        [Required]
        public string Hallazgo { get; set; } = string.Empty;

        [Required]
        public string CausaRaiz { get; set; } = string.Empty;

        [Required]
        public string AccionCorrectiva { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Responsable { get; set; } = string.Empty;

        [Required]
        public DateTime FechaInicio { get; set; }

        [Required]
        public DateTime FechaCompromiso { get; set; }

        [Required]
        [StringLength(50)]
        public string Estado { get; set; } = "pendiente";

        [Required]
        [StringLength(50)]
        public string TipoTrabajo { get; set; } = "Nuevo";

        [Range(0, 100)]
        public int PorcentajeAvance { get; set; } = 0;

        public virtual ICollection<PlanAccionEvidencia> Evidencias { get; set; } = new List<PlanAccionEvidencia>();

        public string? Observaciones { get; set; }

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    }
}
