# Backend Auto-Restart Script (Ultra-Defensive Version)
$backendDir = "G:\Proyecto-Tablets\ProduccionUnificado\backend"
$logFile = Join-Path $backendDir "backend_live.log"

Write-Host "[STARTUP] Backend watcher iniciado. Ver backend_live.log para detalles." -ForegroundColor Cyan

function Stop-BackendProcesses {
    Write-Host "[CLEANUP] Matando procesos persistentes..." -ForegroundColor Gray
    Get-Process -Name "dotnet", "TiempoProcesos.API" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
}

while ($true) {
    Stop-BackendProcesses

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Iniciando backend..." -ForegroundColor Green
    Add-Content $logFile "`n--- INICIO BACKEND [$(Get-Date)] ---`n"

    # Use dotnet run with --no-launch-profile to avoid browser popups if any
    # and 2>&1 to merge output
    dotnet run --project "$backendDir\TiempoProcesos.API.csproj" --no-build 2>&1 | Tee-Object -FilePath $logFile -Append

    $exitCode = $LASTEXITCODE
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Backend detenido con codigo $exitCode. Reiniciando en 5s..." -ForegroundColor Yellow
    Add-Content $logFile "`n--- FIN BACKEND [$(Get-Date)] Código: $exitCode ---`n"

    if ($exitCode -eq 0) {
        # If it was a clean exit, maybe we don't want to loop forever? 
        # But for a watcher, we usually do.
    }

    Start-Sleep -Seconds 5
}
