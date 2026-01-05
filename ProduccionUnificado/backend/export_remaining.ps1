# Exportar tablas restantes a CSV
$tables = @(
    "OrdenesProduccion",
    "TiempoProcesos",
    "ProduccionDiaria",
    "CalificacionesMensuales",
    "RendimientoOperariosMensual",
    "EncuestasCalidad",
    "EncuestaNovedades"
)

$conn = "-S localhost\SQLEXPRESS -U Esteban -P @L3PH2025% -d TiemposProcesos"

foreach ($t in $tables) {
    Write-Host "Exportando $t..."
    $cmd = "sqlcmd $conn -Q `"SELECT * FROM $t`" -s `",`" -W -o `"MigrationTemp\$t.csv`""
    Invoke-Expression $cmd
}
