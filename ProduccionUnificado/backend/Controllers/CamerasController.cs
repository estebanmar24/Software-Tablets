using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TiempoProcesos.API.Services;

namespace TiempoProcesos.API.Controllers;

[Authorize]
[ApiController]
[Route("api/cameras")]
public class CamerasController : ControllerBase
{
    private readonly HikvisionCameraService _cameras;

    public CamerasController(HikvisionCameraService cameras)
    {
        _cameras = cameras;
    }

    [HttpGet]
    public ActionResult<IEnumerable<object>> Listar()
    {
        return Ok(_cameras.ListarCameras());
    }

    [HttpGet("{id}/snapshot")]
    public async Task<IActionResult> Snapshot(string id, CancellationToken ct)
    {
        var snap = await _cameras.ObtenerSnapshotAsync(id, ct);
        if (snap == null || snap.Data.Length == 0)
            return NotFound(new { message = "No se pudo obtener imagen de la cámara. Verifique red, credenciales y puerto HTTP." });

        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        return File(snap.Data, snap.ContentType);
    }
}
