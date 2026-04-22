using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using TiempoProcesos.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using OfficeOpenXml;
using System.Security.Claims;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CalidadTalleresController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public CalidadTalleresController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<EncuestaCalidadTallerResumenDto>>> GetEncuestas()
    {
        return await _context.EncuestasCalidadTalleres
            .Include(e => e.Taller)
            .Include(e => e.AdminUsuario)
            .OrderByDescending(e => e.FechaCreacion)
            .Select(e => new EncuestaCalidadTallerResumenDto
            {
                Id = e.Id,
                TallerId = e.TallerId,
                TallerNombre = e.Taller != null ? e.Taller.Nombre : "N/A",
                OrdenProduccion = e.OrdenProduccion,
                EstadoProceso = e.EstadoProceso,
                Inspector = e.AdminUsuario != null ? (!string.IsNullOrEmpty(e.AdminUsuario.NombreMostrar) ? e.AdminUsuario.NombreMostrar : e.AdminUsuario.Username) : "N/A",
                FechaCreacion = e.FechaCreacion
            })
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EncuestaCalidadTallerDetalleDto>> GetEncuesta(int id)
    {
        var e = await _context.EncuestasCalidadTalleres
            .Include(x => x.Taller)
            .Include(x => x.AdminUsuario)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (e == null) return NotFound();

        return new EncuestaCalidadTallerDetalleDto
        {
            Id = e.Id,
            TallerId = e.TallerId,
            TallerNombre = e.Taller?.Nombre ?? "N/A",
            HoraLlegada = e.HoraLlegada,
            HoraSalida = e.HoraSalida,
            OrdenProduccion = e.OrdenProduccion,
            NumeroRemision = e.NumeroRemision,
            CantidadProducir = e.CantidadProducir,
            CantidadEvaluada = e.CantidadEvaluada,
            EstadoProceso = e.EstadoProceso,
            TieneMuestra = e.TieneMuestra,
            TipoProducto = e.TipoProducto,
            ConoceFormaEmpaque = e.ConoceFormaEmpaque,
            TieneRemision = e.TieneRemision,
            TieneInsumosCompletos = e.TieneInsumosCompletos,
            VariacionTono = e.VariacionTono,
            FotoVariacionTono = e.FotoVariacionTono,
            QuebradoArrugado = e.QuebradoArrugado,
            FotoQuebradoArrugado = e.FotoQuebradoArrugado,
            EsquinaDefectuosa = e.EsquinaDefectuosa,
            FotoEsquinaDefectuosa = e.FotoEsquinaDefectuosa,
            PresenciaPestanas = e.PresenciaPestanas,
            FotoPresenciaPestanas = e.FotoPresenciaPestanas,
            DesgasteImpresion = e.DesgasteImpresion,
            FotoDesgasteImpresion = e.FotoDesgasteImpresion,
            Manchas = e.Manchas,
            FotoManchas = e.FotoManchas,
            ReservaPega = e.ReservaPega,
            FotoReservaPega = e.FotoReservaPega,
            GrafadoRoto = e.GrafadoRoto,
            FotoGrafadoRoto = e.FotoGrafadoRoto,
            NovedadBPM = e.NovedadBPM,
            FotoNovedadBPM = e.FotoNovedadBPM,
            UsaCofia = e.UsaCofia,
            FotoUsaCofia = e.FotoUsaCofia,
            InsumosPendientes = e.InsumosPendientes,
            TipoInsumosPendientes = e.TipoInsumosPendientes,
            FotoInsumosPendientes = e.FotoInsumosPendientes,
            Observaciones = e.Observaciones,
            Inspector = !string.IsNullOrEmpty(e.AdminUsuario?.NombreMostrar) ? e.AdminUsuario.NombreMostrar : (e.AdminUsuario?.Username ?? "N/A"),
            FechaCreacion = e.FechaCreacion
        };
    }

    [HttpPost]
    public async Task<ActionResult<EncuestaCalidadTaller>> PostEncuesta(CrearEncuestaCalidadTallerDto dto)
    {
        var userIdClaim = User.FindFirst("Id") ?? User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null) return Unauthorized("No se pudo identificar al usuario.");
        int usuarioId = int.Parse(userIdClaim.Value);

        int tallerId = dto.TallerId;
        if (tallerId == 0 && !string.IsNullOrEmpty(dto.NombreTallerNuevo))
        {
            var nuevoTaller = new TallerExterno { Nombre = dto.NombreTallerNuevo.ToUpper() };
            _context.TalleresExternos.Add(nuevoTaller);
            await _context.SaveChangesAsync();
            tallerId = nuevoTaller.Id;
        }

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
            UsuarioId = usuarioId,
            FechaCreacion = DateTime.Now
        };

        // Process photos
        encuesta.FotoVariacionTono = await ProcessMultiplePhotos(dto.FotoVariacionTonoBase64);
        encuesta.FotoQuebradoArrugado = await ProcessMultiplePhotos(dto.FotoQuebradoArrugadoBase64);
        encuesta.FotoEsquinaDefectuosa = await ProcessMultiplePhotos(dto.FotoEsquinaDefectuosaBase64);
        encuesta.FotoPresenciaPestanas = await ProcessMultiplePhotos(dto.FotoPresenciaPestanasBase64);
        encuesta.FotoDesgasteImpresion = await ProcessMultiplePhotos(dto.FotoDesgasteImpresionBase64);
        encuesta.FotoManchas = await ProcessMultiplePhotos(dto.FotoManchasBase64);
        encuesta.FotoReservaPega = await ProcessMultiplePhotos(dto.FotoReservaPegaBase64);
        encuesta.FotoGrafadoRoto = await ProcessMultiplePhotos(dto.FotoGrafadoRotoBase64);
        encuesta.FotoNovedadBPM = await ProcessMultiplePhotos(dto.FotoNovedadBPMBase64);
        encuesta.FotoUsaCofia = await ProcessMultiplePhotos(dto.FotoUsaCofiaBase64);
        encuesta.FotoInsumosPendientes = await ProcessMultiplePhotos(dto.FotoInsumosPendientesBase64);

        _context.EncuestasCalidadTalleres.Add(encuesta);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetEncuesta), new { id = encuesta.Id }, encuesta);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEncuesta(int id)
    {
        var encuesta = await _context.EncuestasCalidadTalleres.FindAsync(id);
        if (encuesta == null) return NotFound();

        _context.EncuestasCalidadTalleres.Remove(encuesta);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    
    
    [HttpPut("{id}")]
    public async Task<IActionResult> PutEncuesta(int id, CrearEncuestaCalidadTallerDto dto)
    {
        var encuesta = await _context.EncuestasCalidadTalleres.FindAsync(id);
        if (encuesta == null) return NotFound();

        int tallerId = dto.TallerId;
        if (tallerId == 0 && !string.IsNullOrEmpty(dto.NombreTallerNuevo))
        {
            var nuevoTaller = new TallerExterno { Nombre = dto.NombreTallerNuevo.ToUpper() };
            _context.TalleresExternos.Add(nuevoTaller);
            await _context.SaveChangesAsync();
            tallerId = nuevoTaller.Id;
        }

        encuesta.TallerId = tallerId;
        encuesta.HoraLlegada = dto.HoraLlegada;
        encuesta.HoraSalida = dto.HoraSalida;
        encuesta.OrdenProduccion = dto.OrdenProduccion;
        encuesta.NumeroRemision = dto.NumeroRemision;
        encuesta.CantidadProducir = dto.CantidadProducir;
        encuesta.CantidadEvaluada = dto.CantidadEvaluada;
        encuesta.EstadoProceso = dto.EstadoProceso;
        encuesta.TieneMuestra = dto.TieneMuestra;
        encuesta.TipoProducto = dto.TipoProducto;
        encuesta.ConoceFormaEmpaque = dto.ConoceFormaEmpaque;
        encuesta.TieneRemision = dto.TieneRemision;
        encuesta.TieneInsumosCompletos = dto.TieneInsumosCompletos;
        encuesta.VariacionTono = dto.VariacionTono;
        encuesta.QuebradoArrugado = dto.QuebradoArrugado;
        encuesta.EsquinaDefectuosa = dto.EsquinaDefectuosa;
        encuesta.PresenciaPestanas = dto.PresenciaPestanas;
        encuesta.DesgasteImpresion = dto.DesgasteImpresion;
        encuesta.Manchas = dto.Manchas;
        encuesta.ReservaPega = dto.ReservaPega;
        encuesta.GrafadoRoto = dto.GrafadoRoto;
        encuesta.NovedadBPM = dto.NovedadBPM;
        encuesta.UsaCofia = dto.UsaCofia;
        encuesta.InsumosPendientes = dto.InsumosPendientes;
        encuesta.TipoInsumosPendientes = dto.TipoInsumosPendientes;
        encuesta.Observaciones = dto.Observaciones;

        encuesta.FotoVariacionTono = await ProcessMultiplePhotos(dto.FotoVariacionTonoBase64);
        encuesta.FotoQuebradoArrugado = await ProcessMultiplePhotos(dto.FotoQuebradoArrugadoBase64);
        encuesta.FotoEsquinaDefectuosa = await ProcessMultiplePhotos(dto.FotoEsquinaDefectuosaBase64);
        encuesta.FotoPresenciaPestanas = await ProcessMultiplePhotos(dto.FotoPresenciaPestanasBase64);
        encuesta.FotoDesgasteImpresion = await ProcessMultiplePhotos(dto.FotoDesgasteImpresionBase64);
        encuesta.FotoManchas = await ProcessMultiplePhotos(dto.FotoManchasBase64);
        encuesta.FotoReservaPega = await ProcessMultiplePhotos(dto.FotoReservaPegaBase64);
        encuesta.FotoGrafadoRoto = await ProcessMultiplePhotos(dto.FotoGrafadoRotoBase64);
        encuesta.FotoNovedadBPM = await ProcessMultiplePhotos(dto.FotoNovedadBPMBase64);
        encuesta.FotoUsaCofia = await ProcessMultiplePhotos(dto.FotoUsaCofiaBase64);
        encuesta.FotoInsumosPendientes = await ProcessMultiplePhotos(dto.FotoInsumosPendientesBase64);

        await _context.SaveChangesAsync();
        return NoContent();
    }



    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var query = _context.EncuestasCalidadTalleres
            .Include(e => e.Taller)
            .Include(e => e.AdminUsuario)
            .AsQueryable();

        if (startDate.HasValue) query = query.Where(e => e.FechaCreacion >= startDate.Value);
        if (endDate.HasValue) query = query.Where(e => e.FechaCreacion <= endDate.Value.AddDays(1));

        var data = await query.OrderByDescending(e => e.FechaCreacion).ToListAsync();

        using (var package = new ExcelPackage())
        {
            var sheet = package.Workbook.Worksheets.Add("Calidad Talleres");
            string[] headers = { "Fecha", "Taller", "OP", "Remision", "Cant. Producir", "Cant. Eval.", "Estado", "Inspector", "Tono", "Quebrado", "Esquinas", "Pestanas", "Impresion", "Manchas", "Reserva", "Grafado", "BPM", "Cofia" };
            
            for (int i = 0; i < headers.Length; i++) sheet.Cells[1, i + 1].Value = headers[i];

            int row = 2;
            foreach (var e in data)
            {
                sheet.Cells[row, 1].Value = e.FechaCreacion.ToString("yyyy-MM-dd HH:mm");
                sheet.Cells[row, 2].Value = e.Taller?.Nombre ?? "N/A";
                sheet.Cells[row, 3].Value = e.OrdenProduccion;
                sheet.Cells[row, 4].Value = e.NumeroRemision;
                sheet.Cells[row, 5].Value = e.CantidadProducir;
                sheet.Cells[row, 6].Value = e.CantidadEvaluada;
                sheet.Cells[row, 7].Value = e.EstadoProceso;
                sheet.Cells[row, 8].Value = !string.IsNullOrEmpty(e.AdminUsuario?.NombreMostrar) ? e.AdminUsuario.NombreMostrar : (e.AdminUsuario?.Username ?? "N/A");
                sheet.Cells[row, 9].Value = e.VariacionTono ? "SI" : "NO";
                sheet.Cells[row, 10].Value = e.QuebradoArrugado ? "SI" : "NO";
                sheet.Cells[row, 11].Value = e.EsquinaDefectuosa ? "SI" : "NO";
                sheet.Cells[row, 12].Value = e.PresenciaPestanas ? "SI" : "NO";
                sheet.Cells[row, 13].Value = e.DesgasteImpresion ? "SI" : "NO";
                sheet.Cells[row, 14].Value = e.Manchas ? "SI" : "NO";
                sheet.Cells[row, 15].Value = e.ReservaPega ? "SI" : "NO";
                sheet.Cells[row, 16].Value = e.GrafadoRoto ? "SI" : "NO";
                sheet.Cells[row, 17].Value = e.NovedadBPM ? "SI" : "NO";
                sheet.Cells[row, 18].Value = e.UsaCofia ? "SI" : "NO";
                row++;
            }
            sheet.Cells.AutoFitColumns();
            return File(package.GetAsByteArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"CalidadTalleres_{DateTime.Now:yyyyMMdd}.xlsx");
        }
    }

    [HttpGet("talleres")]
    public async Task<ActionResult<IEnumerable<TallerExterno>>> GetTalleres()
    {
        return await _context.TalleresExternos.OrderBy(t => t.Nombre).ToListAsync();
    }

    
    private async Task<string?> ProcessMultiplePhotos(string? base64String)
    {
        if (string.IsNullOrEmpty(base64String)) return null;

        // Split by '|||' (frontend separator that avoids conflict with ';' in data: URLs)
        var parts = base64String.Split(new[] { "|||" }, StringSplitOptions.RemoveEmptyEntries);
        var urls = new List<string>();

        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("data:image"))
            {
                string? newUrl = await GuardarFoto(trimmed, "FotoExt");
                if (newUrl != null) urls.Add(newUrl);
            }
            else if (trimmed.StartsWith("/uploads"))
            {
                // Already saved path — preserve it
                urls.Add(trimmed);
            }
        }

        return urls.Count > 0 ? string.Join("|||", urls) : null;
    }

    
    
    private async Task<string?> GuardarFoto(string? base64, string prefijo)
    {
        if (string.IsNullOrEmpty(base64)) return null;
        try
        {
            string rootPath = _env.WebRootPath;
            if (string.IsNullOrEmpty(rootPath)) {
                rootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            }
            
            string folderPath = Path.Combine(rootPath, "uploads", "talleres-externos");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);

            string fileName = (prefijo + "_" + Guid.NewGuid().ToString() + ".jpg");
            string filePath = Path.Combine(folderPath, fileName);

            string base64Data = base64.Contains(",") ? base64.Split(',')[1] : base64;
            byte[] imageBytes = Convert.FromBase64String(base64Data);
            await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);

            return ("/uploads/talleres-externos/" + fileName);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error guardando foto: " + ex.Message);
            return null;
        }
}}
