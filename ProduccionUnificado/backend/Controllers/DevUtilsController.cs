using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;

namespace TiempoProcesos.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevUtilsController : ControllerBase
{
    private readonly AppDbContext _context;

    public DevUtilsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("fix-develop-password")]
    public async Task<IActionResult> FixDevelopPassword()
    {
        var devUser = await _context.AdminUsuarios
            .FirstOrDefaultAsync(u => u.Username == "develop");
        
        if (devUser == null)
        {
            return NotFound(new { message = "Usuario develop no encontrado" });
        }

        var correctPassword = "@L3ph2026";
        var newHash = BCrypt.Net.BCrypt.HashPassword(correctPassword);
        
        devUser.PasswordHash = newHash;
        await _context.SaveChangesAsync();

        return Ok(new 
        { 
            message = "Password actualizado correctamente",
            username = "develop",
            password = correctPassword,
            hash = newHash
        });
    }
}
