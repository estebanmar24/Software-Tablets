using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models
{
    [Table("Contabilidad_Ingresos")]
    public class Contabilidad_Ingreso
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string MotivoIngreso { get; set; } = string.Empty;

        [Column(TypeName = "numeric(18,2)")]
        public decimal Cantidad { get; set; }

        public DateTime Fecha { get; set; }

        [MaxLength(500)]
        public string? PdfUrl { get; set; }

        public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
    }
}
