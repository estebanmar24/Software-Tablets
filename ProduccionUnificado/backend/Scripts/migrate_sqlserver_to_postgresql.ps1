# Script de Migración de Datos: SQL Server → PostgreSQL
# Migra todos los datos de la base de datos TiemposProcesos

param(
    [string]$SqlServerInstance = "localhost\SQLEXPRESS",
    [string]$SqlServerUser = "Esteban",
    [string]$SqlServerPassword = "@L3PH2025%",
    [string]$PostgresUser = "postgres",
    [string]$PostgresPassword = "@L3ph2026",
    [string]$PostgresHost = "localhost",
    [string]$PostgresPort = "5432",
    [string]$DatabaseName = "TiemposProcesos"
)

$ErrorActionPreference = "Continue"
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "MIGRACIÓN DE DATOS: SQL Server → PostgreSQL" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Configurar variable de entorno para password de PostgreSQL
$env:PGPASSWORD = $PostgresPassword

# Orden de tablas (respetando dependencias de FK)
$tablesToMigrate = @(
    @{Name="Usuarios"; HasIdentity=$true},
    @{Name="Maquinas"; HasIdentity=$true},
    @{Name="Actividades"; HasIdentity=$true},
    @{Name="OrdenesProduccion"; HasIdentity=$true},
    @{Name="AdminUsuarios"; HasIdentity=$true},
    @{Name="TiempoProcesos"; HasIdentity=$true},
    @{Name="ProduccionDiaria"; HasIdentity=$true},
    @{Name="CalificacionesMensuales"; HasIdentity=$true},
    @{Name="RendimientoOperariosMensual"; HasIdentity=$true},
    @{Name="EncuestasCalidad"; HasIdentity=$true},
    @{Name="EncuestaNovedades"; HasIdentity=$true}
)

$totalMigrated = 0

foreach ($table in $tablesToMigrate) {
    $tableName = $table.Name
    $hasIdentity = $table.HasIdentity
    
    Write-Host "`n[$tableName]" -ForegroundColor Green
    Write-Host "  → Consultando SQL Server..." -ForegroundColor Gray
    
    # Contar registros
    $countQuery = "SET NOCOUNT ON; SELECT COUNT(*) FROM $tableName"
    $count = sqlcmd -S $SqlServerInstance -U $SqlServerUser -P $SqlServerPassword -d $DatabaseName -Q $countQuery -h -1 -W 2>$null
    $count = [int]($count.Trim())
    
    if ($count -eq 0) {
        Write-Host "  → Tabla vacía, omitida" -ForegroundColor Gray
        continue
    }
    
    Write-Host "  → Encontrados $count registros" -ForegroundColor Yellow
    
    # Exportar datos a CSV
    $csvFile = ".\migration_$tableName.csv"
    $query = "SET NOCOUNT ON; SELECT * FROM $tableName"
    
    sqlcmd -S $SqlServerInstance -U $SqlServerUser -P $SqlServerPassword -d $DatabaseName -Q $query -s "," -W -o $csvFile 2>$null
    
    if (-not (Test-Path $csvFile)) {
        Write-Host "  ✗ Error exportando datos" -ForegroundColor Red
        continue
    }
    
    # Leer CSV y generar INSERT statements
    Write-Host "  → Generando INSERT statements..." -ForegroundColor Gray
    
    $content = Get-Content $csvFile
    if ($content.Length -lt 3) {
        Write-Host "  → Sin datos para migrar" -ForegroundColor Gray
        Remove-Item $csvFile -Force
        continue
    }
    
    # Primera línea tiene los nombres de columnas
    $headers = $content[0] -split ","
    $headers = $headers | ForEach-Object { $_.Trim() }
    
    # Skip primera línea (headers) y última línea (affected rows)
    $dataLines = $content[2..($content.Length-3)]
    
    $sqlFile = ".\migration_$tableName.sql"
    "" > $sqlFile
    
    $insertedCount = 0
    foreach ($line in $dataLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        
        $values = $line -split ","
        $values = $values | ForEach-Object { 
            $val = $_.Trim()
            if ($val -eq "NULL" -or $val -eq "") {
                "NULL"
            } else {
                # Escapar comillas simples
                $val = $val.Replace("'", "''")
                "'$val'"
            }
        }
        
        $columnList = ($headers | ForEach-Object { "`"$_`"" }) -join ", "
        $valueList = $values -join ", "
        
        "INSERT INTO `"$tableName`" ($columnList) VALUES ($valueList);" >> $sqlFile
        $insertedCount++
    }
    
    Write-Host "  → Insertando en PostgreSQL..." -ForegroundColor Gray
    
    # Importar a PostgreSQL
    & $psqlPath -U $PostgresUser -h $PostgresHost -p $PostgresPort -d $DatabaseName -f $sqlFile 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Migrados $insertedCount registros" -ForegroundColor Green
        $totalMigrated += $insertedCount
    } else {
        Write-Host "  ✗ Error insertando datos" -ForegroundColor Red
    }
    
    # Limpiar archivos temporales
    Remove-Item $csvFile -Force -ErrorAction SilentlyContinue
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
}

# Limpiar variable de entorno
Remove-Item Env:\PGPASSWORD

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "MIGRACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Total de registros migrados: $totalMigrated" -ForegroundColor White
Write-Host ""
