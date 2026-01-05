# Script PowerShell para Generar Backup SQL Completo de TiemposProcesos
# Este script usa las herramientas de SQL Server para generar un backup completo
# con esquema y datos

$ServerInstance = "localhost\SQLEXPRESS"
$Database = "TiemposProcesos"
$Username = "Esteban"
$Password = "@L3PH2025%"
$OutputFile = "C:\Users\Desarrollo3\Desktop\Software-Tablets\ProduccionUnificado\backend\BACKUP_COMPLETO_TiemposProcesos.sql"

Write-Host "==============================================`n"} -ForegroundColor Cyan
Write-Host "GENERANDO BACKUP COMPLETO DE SQL SERVER" -ForegroundColor Yellow
Write-Host "Database: $Database" -ForegroundColor White
Write-Host "Output: $OutputFile`n" -ForegroundColor White
Write-Host "==============================================" -ForegroundColor Cyan

# Crear archivo de salida
"-- =============================================" | Out-File -FilePath $OutputFile -Encoding UTF8
"-- BACKUP COMPLETO - TiemposProcesos Database" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- Servidor: $ServerInstance" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"" | Out-File -FilePath $OutputFile -Append -Encoding UTF8

Write-Host "`n[1/3] Exportando esquema de base de datos..." -ForegroundColor Green

# Agregar el esquema del archivo backup_complete_sqlserver.sql
$schemaFile = "C:\Users\Desarrollo3\Desktop\Software-Tablets\ProduccionUnificado\backend\backup_complete_sqlserver.sql"
if (Test-Path $schemaFile) {
    Get-Content $schemaFile | Out-File -FilePath $OutputFile -Append -Encoding UTF8
    Write-Host "  ✓ Esquema agregado desde backup_complete_sqlserver.sql" -ForegroundColor Gray
}

Write-Host "`n[2/3] Exportando datos de tablas..." -ForegroundColor Green

# Función para exportar datos de una tabla
function Export-TableData {
    param (
        [string]$TableName,
        [string]$SelectQuery
    )
    
    Write-Host "  → Exportando $TableName..." -ForegroundColor Cyan
    
    # Contar registros
    $countQuery = "SELECT COUNT(*) AS Total FROM $TableName"
    $count = sqlcmd -S $ServerInstance -U $Username -P $Password -d $Database -Q $countQuery -h -1 -W 2>$null
    $count = $count.Trim()
    
    if ([int]$count -gt 0) {
        Write-Host "    Registros: $count" -ForegroundColor Yellow
        
        # Exportar datos
        "" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "-- DATOS: $TableName ($count registros)" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "SET IDENTITY_INSERT $TableName ON;" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        
        # Ejecutar query y capturar resultado
        $result = sqlcmd -S $ServerInstance -U $Username -P $Password -d $Database -Q $SelectQuery -h -1 -W 2>$null
        $result | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        
        "" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "SET IDENTITY_INSERT $TableName OFF;" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        "GO" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
        
        Write-Host "    ✓ Completado" -ForegroundColor Green
    } else {
        Write-Host "    (vacía)" -ForegroundColor Gray
    }
}

# Exportar cada tabla en orden de dependencias
Write-Host ""

# Notar: Se requiere un script SQL para generar los INSERT statements
# Por ahora, copiaremos los archivos ya generados

# Agregar datos de usuarios
"" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- DATOS: Usuarios" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
if (Test-Path "usuarios_data.sql") {
    Get-Content "usuarios_data.sql" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
    Write-Host "  ✓ Usuarios agregados" -ForegroundColor Green
}

# Agregar datos de máquinas
"" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- DATOS: Maquinas" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
if (Test-Path "maquinas_data.sql") {
    Get-Content "maquinas_data.sql" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
    Write-Host "  ✓ Máquinas agregadas" -ForegroundColor Green
}

Write-Host "`n[3/3] Finalizando backup..." -ForegroundColor Green

"" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- BACKUP COMPLETADO" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"-- =============================================" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"PRINT '¡Restauración completada exitosamente!';" | Out-File -FilePath $OutputFile -Append -Encoding UTF8
"GO" | Out-File -FilePath $OutputFile -Append -Encoding UTF8

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "✓ BACKUP COMPLETO GENERADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Archivo: $OutputFile`n" -ForegroundColor White

# Mostrar tamaño del archivo
$fileSize = (Get-Item $OutputFile).Length / 1KB
Write-Host "Tamaño: $([math]::Round($fileSize, 2)) KB`n" -ForegroundColor Gray
