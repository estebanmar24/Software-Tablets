# Script Automático de Migración Completa
# Migra TODAS las tablas de SQL Server a PostgreSQL

$tables = @(
    @{Name="Maquinas"; Query="SELECT * FROM Maquinas ORDER BY Id"},
    @{Name="Actividades"; Query="SELECT * FROM Actividades ORDER BY Id"},
    @{Name="OrdenesProduccion"; Query="SELECT * FROM OrdenesProduccion ORDER BY Id"},
    @{Name="AdminUsuarios"; Query="SELECT * FROM AdminUsuarios ORDER BY Id"},
    @{Name="TiempoProcesos"; Query="SELECT * FROM TiempoProcesos ORDER BY Id"},
    @{Name="ProduccionDiaria"; Query="SELECT * FROM ProduccionDiaria ORDER BY Id"},
    @{Name="CalificacionesMensuales"; Query="SELECT * FROM CalificacionesMensuales ORDER BY Id"},
    @{Name="RendimientoOperariosMensual"; Query="SELECT * FROM RendimientoOperariosMensual ORDER BY Id"},
    @{Name="EncuestasCalidad"; Query="SELECT * FROM EncuestasCalidad ORDER BY Id"},
    @{Name="EncuestaNovedades"; Query="SELECT * FROM EncuestaNovedades ORDER BY Id"}
)

$sqlServer = "localhost\SQLEXPRESS"
$sqlUser = "Esteban"
$sqlPass = "@L3PH2025%"
$database = "TiemposProcesos"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$pgPass = "@L3ph2026"

Write-Host "==============================================`n" -ForegroundColor Cyan
Write-Host "MIGRACIÓN AUTOMÁTICA DE DATOS`n" -ForegroundColor Yellow
Write-Host "==============================================`n" -ForegroundColor Cyan

$totalMigrated = 0

foreach ($table in $tables) {
    $tableName = $table.Name
    $query = $table.Query
    
    Write-Host "[$tableName]" -ForegroundColor Green
    
    # Contar registros
    $count = sqlcmd -S $sqlServer -U $sqlUser -P $sqlPass -d $database -Q "SELECT COUNT(*) FROM $tableName" -h -1 -W 2>$null
    $count = [int]($count.Trim())
    
    if ($count -eq 0) {
        Write-Host "  → Vacía, omitida`n" -ForegroundColor Gray
        continue
    }
    
    Write-Host "  → $count registros encontrados" -ForegroundColor Yellow
    
    # Exportar a archivo temporal
    $tempFile = "temp_$tableName.txt"
    sqlcmd -S $sqlServer -U $sqlUser -P $sqlPass -d $database -Q $query -s "|" -W -o $tempFile 2>$null
    
    if (-not (Test-Path $tempFile)) {
        Write-Host "  ✗ Error exportando`n" -ForegroundColor Red
        continue
    }
    
    # Generar SQL para PostgreSQL
    $content = Get-Content $tempFile
    $sqlFile = "insert_$tableName.sql"
    
    # Analizar y crear INSERTs
    if ($content.Length -gt 2) {
        $headers = ($content[0] -split '\|') | ForEach-Object { $_.Trim() }
        $dataLines = $content[2..($content.Length-3)]
        
        "" > $sqlFile
        
        foreach ($line in $dataLines) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            
            $values = ($line -split '\|') | ForEach-Object {
                $val = $_.Trim()
                if ($val -eq "" -or $val -eq "NULL") { "NULL" }
                else { "'$($val.Replace("'","''"))'" }
            }
            
            $cols = ($headers | ForEach-Object { "`"$_`"" }) -join ", "
            $vals = $values -join ", "
            
            "INSERT INTO `"$tableName`" ($cols) VALUES ($vals);" >> $sqlFile
        }
        
        # Ejecutar en PostgreSQL
        Write-Host "  → Insertando..." -ForegroundColor Gray
        $env:PGPASSWORD = $pgPass
        & $psqlPath -U postgres -d $database -f $sqlFile -q 2>$null
        Remove-Item Env:\PGPASSWORD
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Migrados $count registros`n" -ForegroundColor Green
            $totalMigrated += $count
        } else {
            Write-Host "  ✗ Error insertando`n" -ForegroundColor Red
        }
    }
    
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
}

Write-Host "==============================================`n" -ForegroundColor Cyan
Write-Host "✓ COMPLETADO - $totalMigrated registros migrados`n" -ForegroundColor Green
Write-Host "==============================================`n" -ForegroundColor Cyan
