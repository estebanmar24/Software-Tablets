
    // =================================================================================================
    // MISSING ENDPOINTS FOR CAPTURE GRID SCREEN
    // These deal with ProduccionDiaria table directly for the "Cuadro Master" functionality
    // =================================================================================================

    /// <summary>
    /// Get list of machines that have data for a specific month
    /// Used for initial filtering in CaptureGridScreen
    /// </summary>
    [HttpGet("maquinas-con-datos")]
    public async Task<ActionResult<List<object>>> GetMaquinasConDatos(int mes, int anio)
    {
        var data = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Select(p => new { p.MaquinaId, p.Maquina.Nombre })
            .Distinct()
            .ToListAsync();
            
        return Ok(data);
    }

    /// <summary>
    /// Get list of operators that have data for a specific month
    /// </summary>
    [HttpGet("operarios-con-datos")]
    public async Task<ActionResult<List<object>>> GetOperariosConDatos(int mes, int anio)
    {
        var data = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio)
            .Select(p => new { p.UsuarioId, p.Usuario.Nombre })
            .Distinct()
            .ToListAsync();
            
        return Ok(data);
    }

    /// <summary>
    /// Get specific production details (rows) for the grid
    /// Filtered by Machine AND Operator (Specific Load)
    /// </summary>
    [HttpGet("detalles")]
    public async Task<ActionResult<List<ProduccionDiaria>>> GetProduccionDetalles(int mes, int anio, int maquinaId, int usuarioId)
    {
        // Avoid caching issues
        var data = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId && p.UsuarioId == usuarioId)
            .ToListAsync();

        return Ok(data);
    }

    /// <summary>
    /// Get specific production details (rows) for the grid
    /// Filtered by Machine ONLY (Machine Load)
    /// </summary>
    [HttpGet("detalles-maquina")]
    public async Task<ActionResult<List<ProduccionDiaria>>> GetProduccionPorMaquina(int mes, int anio, int maquinaId)
    {
        var data = await _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId)
            .OrderBy(p => p.Fecha)
            .ToListAsync();

        return Ok(data);
    }
    
    /// <summary>
    /// Get available periods (Month/Year) that have data
    /// Used for Export Modal
    /// </summary>
    [HttpGet("periodos-disponibles")]
    public async Task<ActionResult<List<object>>> GetPeriodosDisponibles()
    {
        var data = await _context.ProduccionDiaria
            .Select(p => new { p.Fecha.Year, p.Fecha.Month })
            .Distinct()
            .OrderByDescending(x => x.Year)
            .ThenByDescending(x => x.Month)
            .ToListAsync();
            
        var mapped = data.Select(x => new {
            anio = x.Year,
            mes = x.Month,
            nombre = new DateTime(x.Year, x.Month, 1).ToString("MMMM yyyy", new System.Globalization.CultureInfo("es-CO"))
        }).ToList();
        
        return Ok(mapped);
    }

    /// <summary>
    /// Save full month data for a machine (Bulk Upsert/Replace)
    /// This is used when saving the grid. It syncs the frontend grid state to DB.
    /// </summary>
    [HttpPost("mensual")]
    public async Task<ActionResult> SaveProduccionMensual([FromBody] List<ProduccionDiaria> registros)
    {
        if (registros == null || registros.Count == 0) return Ok();

        // 1. Identify context (Month/Year/Machine) from first record
        var first = registros.First();
        var mes = first.Fecha.Month;
        var anio = first.Fecha.Year;
        var maquinaId = first.MaquinaId;

        using var transaction = _context.Database.BeginTransaction();
        try
        {
            // 2. Delete existing records for this machine/month to ensure sync (handle deletions in grid)
            // Strategy: Verify if we should delete strictly by machine or user?
            // "CaptureGridScreen" operates on selected Machine. 
            // When saving, it sends ALL rows for that machine for that month.
            // So we should clear data for that machine/month before inserting new state.
            
            var existing = _context.ProduccionDiaria
                .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio && p.MaquinaId == maquinaId);
            
            _context.ProduccionDiaria.RemoveRange(existing);
            await _context.SaveChangesAsync();

            // 3. Insert new records
            // Reset IDs to 0 to ensure EF treats them as new insertions
            foreach (var r in registros)
            {
                r.Id = 0; 
                // Ensure dependent entities are not tracked/created if only IDs provided
                r.Maquina = null;
                r.Usuario = null;
                r.Horario = null;
            }
            
            _context.ProduccionDiaria.AddRange(registros);
            await _context.SaveChangesAsync();
            
            await transaction.CommitAsync();
            return Ok();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine(ex);
            return BadRequest("Error saving monthly data: " + ex.Message);
        }
    }

    /// <summary>
    /// Delete all production data for a specific context
    /// </summary>
    [HttpDelete("borrar")]
    public async Task<ActionResult> BorrarProduccion(int mes, int anio, int? maquinaId, int? usuarioId)
    {
        var query = _context.ProduccionDiaria
            .Where(p => p.Fecha.Month == mes && p.Fecha.Year == anio);

        if (maquinaId.HasValue) query = query.Where(p => p.MaquinaId == maquinaId.Value);
        if (usuarioId.HasValue) query = query.Where(p => p.UsuarioId == usuarioId.Value);

        _context.ProduccionDiaria.RemoveRange(query);
        await _context.SaveChangesAsync();

        return Ok();
    }
