# Descarga idioma español para OCR (Tesseract). Ejecutar una vez en el servidor de desarrollo.
$tessDir = Join-Path $PSScriptRoot "..\tessdata"
New-Item -ItemType Directory -Force -Path $tessDir | Out-Null
$spa = Join-Path $tessDir "spa.traineddata"
if (-not (Test-Path $spa)) {
    Write-Host "Descargando spa.traineddata (~8 MB)..."
    Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/spa.traineddata" -OutFile $spa -UseBasicParsing
}
$eng = Join-Path $tessDir "eng.traineddata"
if (-not (Test-Path $eng)) {
    Write-Host "Descargando eng.traineddata..."
    Invoke-WebRequest -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata" -OutFile $eng -UseBasicParsing
}
Write-Host "Listo: $tessDir"
