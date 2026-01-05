using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.DTOs;
using TiempoProcesos.API.Models;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto login)
    {
        var user = await _context.AdminUsuarios
            .FirstOrDefaultAsync(u => u.Username.ToLower() == login.Username.ToLower());

        if (user == null)
        {
            return Unauthorized(new { message = "Usuario o contraseña incorrectos" });
        }

        bool isPasswordValid = BCrypt.Net.BCrypt.Verify(login.Password, user.PasswordHash);

        if (!isPasswordValid)
        {
            return Unauthorized(new { message = "Usuario o contraseña incorrectos" });
        }

        // En un escenario real, aquí generaríamos un JWT
        // Por ahora generamos un token de sesión simple
        var token = Guid.NewGuid().ToString();

        return Ok(new LoginResponseDto
        {
            Token = token,
            Role = user.Role,
            Username = user.Username,
            NombreMostrar = user.NombreMostrar
        });
    }
}
