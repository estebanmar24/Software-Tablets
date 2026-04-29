# Script de Despliegue Seguro - ProduccionUnificado
# Este script actualiza el frontend sin borrar las fotos o archivos subidos por los usuarios.

$source = "g:\Proyecto-Tablets\ProduccionUnificado\frontend\dist"
$destination = "g:\Proyecto-Tablets\ProduccionUnificado\backend\wwwroot"
$publishDestination = "g:\Proyecto-Tablets\ProduccionUnificado\backend\publish\wwwroot"

Write-Host "Iniciando despliegue seguro..." -ForegroundColor Cyan

# Sincronizar a la carpeta de desarrollo del backend
robocopy $source $destination /MIR /XD .git fotos-calidad uploads /XF empresa-logo.jpeg /R:3 /W:5

# Sincronizar a la carpeta de producción (publish)
if (Test-Path $publishDestination) {
    Write-Host "Actualizando carpeta de publicación..." -ForegroundColor Yellow
    robocopy $source $publishDestination /MIR /XD .git fotos-calidad uploads /XF empresa-logo.jpeg /R:3 /W:5
}

Write-Host "Despliegue finalizado exitosamente. Las carpetas 'uploads', 'fotos-calidad' y el entorno de publicación han sido actualizados." -ForegroundColor Green
