# Convertir CSVs a SQL para PostgreSQL
$sourceDir = ".\MigrationTemp"
$outputDir = ".\Scripts"

$tables = @(
    "Maquinas", "Actividades", "AdminUsuarios", "OrdenesProduccion",
    "TiempoProcesos", "ProduccionDiaria", "CalificacionesMensuales",
    "RendimientoOperariosMensual", "EncuestasCalidad", "EncuestaNovedades"
)

foreach ($table in $tables) {
    $csvPath = Join-Path $sourceDir "$table.csv"
    if (-not (Test-Path $csvPath)) {
        Write-Host "Advertencia: No se encuentra $csvPath" -ForegroundColor Yellow
        continue
    }

    Write-Host "Procesando $table..."
    $content = Get-Content $csvPath
    
    # sqlcmd genera headers con --- en la segunda linea, y footer con (rows affected)
    # Validamos que tenga datos
    if ($content.Count -lt 3) {
        Write-Host "  -> Archivo vacio o sin datos suficientes."
        continue
    }

    $headers = $content[0].Split(',') | ForEach-Object { $_.Trim() }
    
    # Filtrar lineas de datos (saltar header(0), separador(1), y footer(ultimo))
    # El footer suele estar en las ultimas 2 lineas si hay newline
    $dataLines = $content[2..($content.Count-3)]
    
    $sqlFile = Join-Path $outputDir "insert_$table.sql"
    "" > $sqlFile
    
    "TRUNCATE TABLE `"$table``" RESTART IDENTITY CASCADE;" >> $sqlFile
    
    $count = 0
    foreach ($line in $dataLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        
        $parts = $line.Split(',')
        $values = @()
        
        foreach ($part in $parts) {
            $val = $part.Trim()
            if ($val -eq "" -or $val -eq "NULL") {
                $values += "NULL"
            } else {
                # Escapar comillas simples
                $val = $val.Replace("'", "''")
                $values += "'$val'"
            }
        }
        
        # Validar columnas vs valores
        if ($values.Count -ne $headers.Count) {
             # Intento simple de recuperación si hay comas en los datos (no perfecto pero mejor)
             # En este caso asumimos que sqlcmd exportó correctamente sin comillas envolventes conflictivas
             # Si falla, logueamos
             # Write-Host "   Mismatch cols/vals en linea"
        }

        $cols = $headers | ForEach-Object { "`"$_`"" }
        $colsStr = $cols -join ", "
        $valsStr = $values -join ", "
        
        "INSERT INTO `"$table``" ($colsStr) VALUES ($valsStr);" >> $sqlFile
        $count++
    }
    
    # Ajustar secuencia
    "SELECT setval('`"$($table)_Id_seq`"', (SELECT MAX(`"Id`") FROM `"$table``") + 1, false);" >> $sqlFile
    
    Write-Host "  -> Generado $sqlFile con $count registros."
}
