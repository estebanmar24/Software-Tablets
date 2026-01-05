# Convertir CSVs a SQL para PostgreSQL (Fixed Encoding)
$sourceDir = ".\MigrationTemp"
$outputDir = ".\Scripts"

# Asegurar directorio de salida
if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

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
    
    if ($content.Count -lt 3) {
        Write-Host "  -> Archivo vacio o sin datos."
        continue
    }

    # Headers en linea 0. Trim spaces.
    $headers = $content[0].Split(',') | ForEach-Object { $_.Trim() }
    
    # Datos desde linea 2 hasta Count-1 (ignorando todo lo que empiece ( )
    $dataLines = $content[2..($content.Count-1)]
    
    $sqlFile = Join-Path $outputDir "insert_$table.sql"
    
    # Usar StringBuilder para armar el contenido en memoria y guardarlo de un golpe en UTF8
    $sb = New-Object System.Text.StringBuilder
    
    # TRUNCATE para asegurar limpieza
    [void]$sb.AppendLine("TRUNCATE TABLE `"$table`" RESTART IDENTITY CASCADE;")
    
    $count = 0
    foreach ($line in $dataLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line.Trim().StartsWith("(")) { continue } # Skip (X rows affected)
        
        $parts = $line.Split(',')
        $values = @()
        
        foreach ($part in $parts) {
            $val = $part.Trim()
            if ($val -eq "" -or $val -eq "NULL") {
                $values += "NULL"
            } else {
                $val = $val.Replace("'", "''")
                $values += "'$val'"
            }
        }
        
        # Validacion simple
        if ($values.Count -eq $headers.Count) {
             # Construir INSERT
             $colsStr = ($headers | ForEach-Object { "`"$_`"" }) -join ", "
             $valsStr = $values -join ", "
             [void]$sb.AppendLine("INSERT INTO `"$table`" ($colsStr) VALUES ($valsStr);")
             $count++
        }
    }
    
    # Reset sequence
    [void]$sb.AppendLine("SELECT setval('`"$($table)_Id_seq`"', (SELECT COALESCE(MAX(`"Id`"), 1) FROM `"$table`") + 1, false);")
    
    # Guardar con UTF8 No BOM (o UTF8)
    [System.IO.File]::WriteAllText($sqlFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
    
    Write-Host "  -> Generado $sqlFile con $count registros." -ForegroundColor Green
}
