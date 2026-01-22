-- Tabla de Códigos de Desperdicio
CREATE TABLE IF NOT EXISTS "CodigosDesperdicio" (
    "Id" SERIAL PRIMARY KEY,
    "Codigo" TEXT NOT NULL,
    "Descripcion" TEXT NOT NULL,
    "Activo" BOOLEAN NOT NULL DEFAULT TRUE,
    "FechaCreacion" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de Registros de Desperdicio
CREATE TABLE IF NOT EXISTS "RegistrosDesperdicio" (
    "Id" SERIAL PRIMARY KEY,
    "MaquinaId" INTEGER NOT NULL REFERENCES "Maquinas"("Id") ON DELETE RESTRICT,
    "UsuarioId" INTEGER NOT NULL REFERENCES "Usuarios"("Id") ON DELETE RESTRICT,
    "Fecha" TIMESTAMP NOT NULL,
    "OrdenProduccion" TEXT,
    "CodigoDesperdicioId" INTEGER NOT NULL REFERENCES "CodigosDesperdicio"("Id") ON DELETE RESTRICT,
    "Cantidad" DECIMAL NOT NULL,
    "FechaRegistro" TIMESTAMP NOT NULL DEFAULT NOW()
);
