# Convertir CSVs a SQL para PostgreSQL (Fixed)
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
    
    # Datos desde linea 2 hasta Count-3 (ignorando dashes y rows affected)
    # Ajuste: A veces SQLCMD deja mas lineas al final. Vamos a filtrar lineas vacías o que empiezan con '('
    $dataLines = $content[2..($content.Count-1)]
    
    $sqlFile = Join-Path $outputDir "insert_$table.sql"
    "" > $sqlFile
    
    # TRUNCATE para asegurar limpieza
    "TRUNCATE TABLE `"$table`" RESTART IDENTITY CASCADE;" >> $sqlFile
    
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
        
        # Simple validacion de columnas
        if ($values.Count -eq $headers.Count) {
             # Construir INSERT
             $colsStr = ($headers | ForEach-Object { "`"$_`"" }) -join ", "
             $valsStr = $values -join ", "
             "INSERT INTO `"$table`" ($colsStr) VALUES ($valsStr);" >> $sqlFile
             $count++
        }
    }
    
    # Reset sequence
    "SELECT setval('`"$($table)_Id_seq`"', (SELECT COALESCE(MAX(`"Id`"), 1) FROM `"$table`") + 1, false);" >> $sqlFile
    
    Write-Host "  -> Generado $sqlFile con $count registros." -ForegroundColor Green
}
