
# Script de Verificación API CRUD
$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5144/api/Produccion"

Write-Host ">>> INICIO DE PRUEBA API CRUD <<<" -ForegroundColor Cyan

# 1. CREAR
Write-Host "1. CREAR (POST)..." -NoNewline
$body = @{
    UsuarioId = 1
    MaquinaId = 1
    Fecha = "2030-01-01T00:00:00"
    TirosConEquivalencia = 100
    HoraInicio = "08:00"
    HoraFin = "10:00"
    TotalHorasProductivas = 2
    ProduccionKilos = 5
    Desperdicio = 0
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "application/json"
    Write-Host " OK." -ForegroundColor Green
    Write-Host "   Respuesta ID/Msg: $($res.id)"
} catch {
    Write-Host " FALLÓ." -ForegroundColor Red
    Write-Error $_
}

# 2. LEER
Write-Host "2. LEER (GET)..." -NoNewline
try {
    $url = "$baseUrl/detalles?mes=1&anio=2030&maquinaId=1&usuarioId=1"
    $res = Invoke-RestMethod -Uri $url -Method Get
    
    if ($res.Count -gt 0) {
        Write-Host " OK. Tienes $($res.Count) registro(s)." -ForegroundColor Green
        Write-Host "   Tiros: $($res[0].tirosConEquivalencia)"
    } else {
        Write-Host " VACÍO (Ups)." -ForegroundColor Yellow
    }
} catch {
    Write-Host " FALLÓ." -ForegroundColor Red
    Write-Error $_
}

# 3. ACTUALIZAR
Write-Host "3. ACTUALIZAR (POST Upsert)..." -NoNewline
$bodyUpd = @{
    UsuarioId = 1
    MaquinaId = 1
    Fecha = "2030-01-01T00:00:00"
    TirosConEquivalencia = 999 
    HoraInicio = "08:00"
    HoraFin = "12:00"
    TotalHorasProductivas = 4
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $bodyUpd -ContentType "application/json"
    
    # Verificar
    $url = "$baseUrl/detalles?mes=1&anio=2030&maquinaId=1&usuarioId=1"
    $res2 = Invoke-RestMethod -Uri $url -Method Get
    
    if ($res2[0].tirosConEquivalencia -eq 999) {
        Write-Host " OK. Actualizado a 999." -ForegroundColor Green
    } else {
        Write-Host " FALLO. Sigue en $($res2[0].tirosConEquivalencia)." -ForegroundColor Red
    }
} catch {
    Write-Host " FALLÓ." -ForegroundColor Red
    Write-Error $_
}

# 4. ELIMINAR
Write-Host "4. ELIMINAR (DELETE)..." -NoNewline
try {
    $urlDel = "$baseUrl/borrar?mes=1&anio=2030&usuarioId=1&maquinaId=1"
    $res = Invoke-RestMethod -Uri $urlDel -Method Delete
    Write-Host " OK." -ForegroundColor Green
    
    # Confirmar
    $url = "$baseUrl/detalles?mes=1&anio=2030&maquinaId=1&usuarioId=1"
    $check = Invoke-RestMethod -Uri $url -Method Get
    if ($check.Count -eq 0) {
        Write-Host "   Confirmado: Datos borrados." -ForegroundColor Green
    } else {
        Write-Host "   Error: Datos siguen ahí." -ForegroundColor Red
    }
} catch {
    Write-Host " FALLÓ." -ForegroundColor Red
    Write-Error $_
}

Write-Host ">>> FIN <<<" -ForegroundColor Cyan
