using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models
{
    public class CronogramaActividad
    {
        public int Id { get; set; }
        
        [Required]
        public string Operacion { get; set; } = string.Empty;
        
        // Permite agrupar o filtrar si en el futuro hay muchas
        public string Categoria { get; set; } = "General"; 
        
        public bool Activo { get; set; } = true;
    }
}
