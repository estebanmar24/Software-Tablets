using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.AspNetCore.Authorization;
using TiempoProcesos.API.DTOs;
using System.Security.Claims;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CalidadTalleresController : ControllerBase
{
    private readonly AppDbContext _context;

    public CalidadTalleresController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("talleres")]
    public async Task<ActionResult<IEnumerable<TallerExterno>>> GetTalleres()
    {
        return await _context.TalleresExternos.OrderBy(t => t.Nombre).ToListAsync();
    }

    [HttpGet("encuestas")]
    public async Task<ActionResult<IEnumerable<EncuestaCalidadTallerResumenDto>>> GetEncuestas()
    {
        return await _context.EncuestasCalidadTalleres
            .Include(e => e.Taller)
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new EncuestaCalidadTallerResumenDto
            {
                Id = e.Id,
                TallerId = e.TallerId,
                TallerNombre = e.Taller!.Nombre,
                OrdenProduccion = e.OrdenProduccion,
                EstadoProceso = e.EstadoProceso,
                FechaCreacion = e.FechaCreacion
            })
            .ToListAsync();
    }

    [HttpGet("encuestas/{id}")]
    public async Task<ActionResult<EncuestaCalidadTallerDetalleDto>> GetEncuesta(int id)
    {
        var encuesta = await _context.EncuestasCalidadTalleres
            .Include(e => e.Taller)
            .Include(e => e.Usuario)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (encuesta == null) return NotFound();

        return Ok(new EncuestaCalidadTallerDetalleDto
        {
            Id = encuesta.Id,
            TallerId = encuesta.TallerId,
            TallerNombre = encuesta.Taller!.Nombre,
            HoraLlegada = encuesta.HoraLlegada,
            HoraSalida = encuesta.HoraSalida,
            OrdenProduccion = encuesta.OrdenProduccion,
            NumeroRemision = encuesta.NumeroRemision,
            CantidadProducir = encuesta.CantidadProducir,
            CantidadEvaluada = encuesta.CantidadEvaluada,
            EstadoProceso = encuesta.EstadoProceso,
            TieneMuestra = encuesta.TieneMuestra,
            TipoProducto = encuesta.TipoProducto,
            ConoceFormaEmpaque = encuesta.ConoceFormaEmpaque,
            TieneRemision = encuesta.TieneRemision,
            TieneInsumosCompletos = encuesta.TieneInsumosCompletos,
            VariacionTono = encuesta.VariacionTono,
            QuebradoArrugado = encuesta.QuebradoArrugado,
            EsquinaDefectuosa = encuesta.EsquinaDefectuosa,
            PresenciaPestanas = encuesta.PresenciaPestanas,
            DesgasteImpresion = encuesta.DesgasteImpresion,
            Manchas = encuesta.Manchas,
            ReservaPega = encuesta.ReservaPega,
            GrafadoRoto = encuesta.GrafadoRoto,
            NovedadBPM = encuesta.NovedadBPM,
            UsaCofia = encuesta.UsaCofia,
            InsumosPendientes = encuesta.InsumosPendientes,
            TipoInsumosPendientes = encuesta.TipoInsumosPendientes,
            Observaciones = encuesta.Observaciones,
            Inspector = encuesta.Usuario?.Nombre ?? "N/A",
            FechaCreacion = encuesta.FechaCreacion
        });
    }

    [HttpPost("encuestas")]
    public async Task<ActionResult> CrearEncuesta([FromBody] CrearEncuestaCalidadTallerDto dto)
    {
        try
        {
            int tallerId = dto.TallerId;

            // Lógica para Taller Nuevo ("Otro...")
            if (tallerId == 0 && !string.IsNullOrEmpty(dto.NombreTallerNuevo))
            {
                var nombreNormalizado = dto.NombreTallerNuevo.Trim().ToUpper();
                var tallerExistente = await _context.TalleresExternos
                    .FirstOrDefaultAsync(t => t.Nombre.ToUpper() == nombreNormalizado);

                if (tallerExistente != null)
                {
                    tallerId = tallerExistente.Id;
                }
                else
                {
                    var nuevoTaller = new TallerExterno { Nombre = dto.NombreTallerNuevo.Trim() };
                    _context.TalleresExternos.Add(nuevoTaller);
                    await _context.SaveChangesAsync();
                    tallerId = nuevoTaller.Id;
                }
            }

            if (tallerId <= 0)
            {
                return BadRequest("Debe seleccionar un taller válido o ingresar uno nuevo.");
            }

            // El UsuarioId se puede sacar del Token si estuviera autenticado, 
            // pero por simplicidad para estos módulos de Tablet muchas veces se pasa manual o se usa un usuario default.
            // Para mantener consistencia con otros módulos, buscaremos el primer usuario con rol calidad_talleres si no hay auth.
            
            var encuesta = new EncuestaCalidadTaller
            {
                TallerId = tallerId,
                HoraLlegada = dto.HoraLlegada,
                HoraSalida = dto.HoraSalida,
                OrdenProduccion = dto.OrdenProduccion,
                NumeroRemision = dto.NumeroRemision,
                CantidadProducir = dto.CantidadProducir,
                CantidadEvaluada = dto.CantidadEvaluada,
                EstadoProceso = dto.EstadoProceso,
                TieneMuestra = dto.TieneMuestra,
                TipoProducto = dto.TipoProducto,
                ConoceFormaEmpaque = dto.ConoceFormaEmpaque,
                TieneRemision = dto.TieneRemision,
                TieneInsumosCompletos = dto.TieneInsumosCompletos,
                VariacionTono = dto.VariacionTono,
                QuebradoArrugado = dto.QuebradoArrugado,
                EsquinaDefectuosa = dto.EsquinaDefectuosa,
                PresenciaPestanas = dto.PresenciaPestanas,
                DesgasteImpresion = dto.DesgasteImpresion,
                Manchas = dto.Manchas,
                ReservaPega = dto.ReservaPega,
                GrafadoRoto = dto.GrafadoRoto,
                NovedadBPM = dto.NovedadBPM,
                UsaCofia = dto.UsaCofia,
                InsumosPendientes = dto.InsumosPendientes,
                TipoInsumosPendientes = dto.TipoInsumosPendientes,
                Observaciones = dto.Observaciones,
                UsuarioId = 1, // Placeholder: Debería ser dinámico.
                FechaCreacion = DateTime.Now
            };

            _context.EncuestasCalidadTalleres.Add(encuesta);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Encuesta guardada con éxito", id = encuesta.Id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al guardar encuesta", error = ex.Message });
        }
    }
}
