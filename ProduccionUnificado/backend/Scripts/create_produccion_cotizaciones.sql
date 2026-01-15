CREATE TABLE IF NOT EXISTS "Produccion_Cotizaciones" (
    "Id" SERIAL PRIMARY KEY,
    "ProveedorId" INT NOT NULL,
    "RubroId" INT NOT NULL,
    "Anio" INT NOT NULL,
    "Mes" INT NOT NULL,
    "PrecioCotizado" DECIMAL(18,2) NOT NULL,
    "FechaCotizacion" TIMESTAMP NOT NULL DEFAULT NOW(),
    "Descripcion" VARCHAR(500),
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "FK_Produccion_Cotizaciones_Produccion_Proveedores_ProveedorId" FOREIGN KEY ("ProveedorId") REFERENCES "Produccion_Proveedores" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Produccion_Cotizaciones_Produccion_Rubros_RubroId" FOREIGN KEY ("RubroId") REFERENCES "Produccion_Rubros" ("Id") ON DELETE CASCADE
);
