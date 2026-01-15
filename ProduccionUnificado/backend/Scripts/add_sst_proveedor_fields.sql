-- Add new columns to SST_Proveedores table
ALTER TABLE "SST_Proveedores" 
    ADD COLUMN IF NOT EXISTS "Nit" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "Telefono" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "Direccion" VARCHAR(300),
    ADD COLUMN IF NOT EXISTS "Correo" VARCHAR(200);
