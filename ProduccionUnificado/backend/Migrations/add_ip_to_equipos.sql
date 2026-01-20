-- Add IpDireccion column to Equipos table
ALTER TABLE "Equipos" ADD COLUMN IF NOT EXISTS "IpDireccion" character varying(50);
