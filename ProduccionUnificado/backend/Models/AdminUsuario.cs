using System.ComponentModel.DataAnnotations;

namespace TiempoProcesos.API.Models;

public class AdminUsuario
{
    public int Id { get; set; }

    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;

    public string NombreMostrar { get; set; } = string.Empty;
}
