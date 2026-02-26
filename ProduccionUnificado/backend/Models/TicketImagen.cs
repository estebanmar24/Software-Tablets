using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models
{
    public class TicketImagen
    {
        [Key]
        public int Id { get; set; }

        public int TicketId { get; set; }

        [Required]
        [MaxLength(500)]
        public string ImagenUrl { get; set; } = string.Empty;

        public DateTime FechaSubida { get; set; } = DateTime.UtcNow;

        [JsonIgnore]
        [ForeignKey("TicketId")]
        public Ticket? Ticket { get; set; }
    }
}
