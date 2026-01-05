# Script para exportar todos los datos de SQL Server a formato SQL
# Este script genera archivos SQL con INSERT statements para cada tabla

$ServerInstance = "localhost\SQLEXPRESS"
$Database = "TiemposProcesos"
$Username = "Esteban"
$Password = "@L3PH2025%"
$OutputDir = "C:\Users\Desarrollo3\Desktop\Software-Tablets\ProduccionUnificado\backend\DatabaseExport"

# Crear directorio de salida si no existe
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "Iniciando exportación de datos..." -ForegroundColor Green

# Lista de tablas en orden de dependencias (tablas sin FK primero)
$tables = @(
    "Usuarios",
    "Maquinas",
    "Actividades",
    "OrdenesProduccion",
    "AdminUsuarios",
    "TiempoProcesos",
    "ProduccionDiaria",
    "CalificacionesMensuales",
    "RendimientoOperariosMensual",
    "EncuestasCalidad",
    "EncuestaNovedades"
)

foreach ($table in $tables) {
    Write-Host "Exportando tabla: $table..." -ForegroundColor Cyan
    
    $outputFile = Join-Path $OutputDir "$table.sql"
    
    # Obtener conteo de registros
    $countQuery = "SELECT COUNT(*) AS Total FROM $table"
    $count = sqlcmd -S $ServerInstance -U $Username -P $Password -d $Database -Q $countQuery -h -1 -W
    
    Write-Host "  -> $count registros encontrados" -ForegroundColor Yellow
    
    if ($count -gt 0) {
        # Exportar datos
        $query = @"
SET NOCOUNT ON;
SELECT * FROM $table;
"@
        
        # Ejecutar query y generar INSERT statements
        $data = sqlcmd -S $ServerInstance -U $Username -P $Password -d $Database -Q $query -s "," -W
        
        # Guardar en archivo
        "-- Datos de tabla: $table" | Out-File -FilePath $outputFile -Encoding UTF8
        "-- Total registros: $count" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        "" | Out-File -FilePath $outputFile -Append -Encoding UTF8
        $data | Out-File -FilePath $outputFile -Append -Encoding UTF8
        
        Write-Host "  -> Exportado a: $outputFile" -ForegroundColor Green
    } else {
        Write-Host "  -> Tabla vacía, omitida" -ForegroundColor Gray
    }
}

Write-Host "`nExportación completada!" -ForegroundColor Green
Write-Host "Archivos guardados en: $OutputDir" -ForegroundColor Green
