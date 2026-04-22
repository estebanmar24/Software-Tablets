# Script de Despliegue Seguro - ProduccionUnificado
# Este script actualiza el frontend sin borrar las fotos o archivos subidos por los usuarios.

$source = "g:\Proyecto-Tablets\ProduccionUnificado\frontend\dist"
$destination = "g:\Proyecto-Tablets\ProduccionUnificado\backend\wwwroot"

Write-Host "Iniciando despliegue seguro..." -ForegroundColor Cyan

# /MIR: Sincroniza archivos
# /XD: EXCLUYE carpetas críticas
# /XF: EXCLUYE archivos críticos (logo personalizado)
robocopy $source $destination /MIR /XD .git fotos-calidad uploads /XF empresa-logo.jpeg /R:3 /W:5

Write-Host "Despliegue finalizado exitosamente. Las carpetas 'uploads' y 'fotos-calidad' han sido protegidas." -ForegroundColor Green
