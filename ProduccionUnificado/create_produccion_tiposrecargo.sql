DO $$ 
BEGIN 
    -- Crear tabla Produccion_TiposRecargo si no existe
    CREATE TABLE IF NOT EXISTS "Produccion_TiposRecargo" (
        "Id" SERIAL PRIMARY KEY,
        "Nombre" TEXT NOT NULL,
        "Porcentaje" DECIMAL(18,2) NOT NULL,
        "Factor" DECIMAL(18,4) NOT NULL,
        "Activo" BOOLEAN NOT NULL DEFAULT TRUE
    );

    -- Insertar datos semilla si la tabla está vacía
    IF NOT EXISTS (SELECT 1 FROM "Produccion_TiposRecargo") THEN
        INSERT INTO "Produccion_TiposRecargo" ("Nombre", "Porcentaje", "Factor", "Activo")
        VALUES 
        ('Recargo Nocturno', 35, 0.35, true),
        ('Recargo Dominical/Festivo', 75, 0.75, true),
        ('Recargo Nocturno Dominical', 110, 1.10, true);
    END IF;

    -- Asegurar que existe el Rubro 'Recargo' en Produccion_Rubros si no existe
    IF NOT EXISTS (SELECT 1 FROM "Produccion_Rubros" WHERE "Nombre" = 'Recargo') THEN
        INSERT INTO "Produccion_Rubros" ("Nombre", "Activo") VALUES ('Recargo', true);
    END IF;

END $$;
