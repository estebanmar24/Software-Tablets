-- Corregir clave foránea de Máquinas en Gastos de Mantenimiento
-- El error 500 se debe a que la restricción apunta a HojasVidaMaquinas en lugar de Maquinas

ALTER TABLE "Mantenimiento_Gastos" 
DROP CONSTRAINT IF EXISTS "FK_Mantenimiento_Gastos_HojasVidaMaquinas_MaquinaId";

-- Intentar agregar la restricción correcta apuntando a la tabla Maquinas
-- Se usa ON DELETE RESTRICT para mantener la integridad
ALTER TABLE "Mantenimiento_Gastos" 
ADD CONSTRAINT "FK_Mantenimiento_Gastos_Maquinas_MaquinaId" 
FOREIGN KEY ("MaquinaId") REFERENCES "Maquinas"("Id") ON DELETE RESTRICT;

-- Verificar si hay registros que ya violen esto (opcional, pero ayuda a depurar)
-- SELECT * FROM "Mantenimiento_Gastos" WHERE "MaquinaId" NOT IN (SELECT "Id" FROM "Maquinas");
