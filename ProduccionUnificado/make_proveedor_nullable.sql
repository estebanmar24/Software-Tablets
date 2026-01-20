-- Make ProveedorId nullable in Talleres_Gastos
ALTER TABLE "Talleres_Gastos" ALTER COLUMN "ProveedorId" DROP NOT NULL;
