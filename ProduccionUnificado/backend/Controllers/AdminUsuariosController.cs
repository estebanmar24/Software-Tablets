using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;

namespace TiempoProcesos.API.Controllers;

[Authorize(Roles = "Admin,develop")]
[ApiController]
[Route("api/[controller]")]
public class AdminUsuariosController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdminUsuariosController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetUsers()
    {
        return await _context.AdminUsuarios
            .Select(u => new 
            {
                u.Id,
                u.Username,
                u.Role,
                u.NombreMostrar,
                u.Area,
                u.Email,
                u.Activo,
                u.Permissions
                // Do not return PasswordHash
            })
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<AdminUsuario>> CreateUser([FromBody] CreateUserDto dto)
    {
        if (await _context.AdminUsuarios.AnyAsync(u => u.Username == dto.Username))
        {
            return BadRequest(new { message = "El nombre de usuario ya existe" });
        }

        var newUser = new AdminUsuario
        {
            Username = dto.Username,
            Role = dto.Role,
            NombreMostrar = dto.NombreMostrar,
            Area = dto.Area ?? string.Empty,
            Email = dto.Email ?? string.Empty,
            Permissions = dto.Permissions ?? string.Empty,
            Activo = dto.Activo,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
        };

        _context.AdminUsuarios.Add(newUser);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUsers), new { id = newUser.Id }, new { id = newUser.Id, username = newUser.Username });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var user = await _context.AdminUsuarios.FindAsync(id);
        if (user == null) return NotFound();

        user.Role = dto.Role;
        user.NombreMostrar = dto.NombreMostrar;
        user.Area = dto.Area ?? string.Empty;
        user.Email = dto.Email ?? string.Empty;
        if (dto.Permissions != null)
        {
            user.Permissions = dto.Permissions;
        }
        user.Activo = dto.Activo;

        if (!string.IsNullOrEmpty(dto.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.AdminUsuarios.FindAsync(id);
        if (user == null) return NotFound();

        // Prevent deleting the last develop or admin might be a good idea, 
        // but for now we just allow it (user be careful).
        if (user.Username.ToLower() == "develop") 
        {
             return BadRequest(new { message = "No se puede eliminar el usuario principal de desarrollo" });
        }

        _context.AdminUsuarios.Remove(user);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateUserDto
{
    public string Username { get; set; }
    public string Password { get; set; }
    public string Role { get; set; }
    public string NombreMostrar { get; set; }
    public string? Area { get; set; }
    public string? Email { get; set; }
    public string? Permissions { get; set; }
    public bool Activo { get; set; } = true;
}

public class UpdateUserDto
{
    public string Role { get; set; }
    public string NombreMostrar { get; set; }
    public string? Area { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; } // Opcional
    public string? Permissions { get; set; }
    public bool Activo { get; set; } = true;
}
