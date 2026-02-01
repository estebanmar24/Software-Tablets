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
    [HttpGet("debug-data")]
    public async Task<IActionResult> GetDebugData()
    {
        try
        {
            var sql = @"
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Usuarios' AND column_name = 'EsPorHoras') THEN 
                        ALTER TABLE ""Usuarios"" ADD COLUMN ""EsPorHoras"" BOOLEAN DEFAULT FALSE; 
                    END IF; 
                END $$;
                SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Usuarios';
            ";

            var result = new List<Dictionary<string, object>>();
            using (var command = _context.Database.GetDbConnection().CreateCommand())
            {
                command.CommandText = sql;
                _context.Database.OpenConnection();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var row = new Dictionary<string, object>();
                        for (var i = 0; i < reader.FieldCount; i++)
                        {
                            row[reader.GetName(i)] = reader.GetValue(i);
                        }
                        result.Add(row);
                    }
                }
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
