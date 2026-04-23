CREATE TABLE IF NOT EXISTS "MantenimientoFotos" (
    "Id" SERIAL PRIMARY KEY,
    "MantenimientoId" INTEGER NOT NULL,
    "Url" VARCHAR(500) NOT NULL,
    "FechaRegistro" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FK_MantenimientoFotos_MantenimientosHojaVida_MantenimientoId" 
    FOREIGN KEY ("MantenimientoId") REFERENCES "MantenimientosHojaVida"("Id") ON DELETE CASCADE
);
