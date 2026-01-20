using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models
{
    public class EquipoFoto
    {
        [Key]
        public int Id { get; set; }

        public int EquipoId { get; set; }

        [Required]
        [MaxLength(500)]
        public string FotoUrl { get; set; } = string.Empty;

        public DateTime FechaSubida { get; set; } = DateTime.Now;

        [JsonIgnore]
        [ForeignKey("EquipoId")]
        public Equipo? Equipo { get; set; }
    }
}
