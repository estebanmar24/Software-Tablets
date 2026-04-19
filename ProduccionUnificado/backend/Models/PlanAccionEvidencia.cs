using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    [Table("PlanAccionEvidencias")]
    public class PlanAccionEvidencia
    {
        [Key]
        public int Id { get; set; }

        public int PlanAccionId { get; set; }

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string FileType { get; set; } = "Photo"; // Photo or Pdf

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        [ForeignKey("PlanAccionId")]
        public virtual PlanAccion? PlanAccion { get; set; }
    }
}
