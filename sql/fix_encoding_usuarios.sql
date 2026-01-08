-- Fix encoding issues in Usuarios table
-- Double-encoded UTF-8: Ã± should be ñ

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ã±', 'ñ')
WHERE "Nombre" LIKE '%Ã±%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ã¡', 'á')
WHERE "Nombre" LIKE '%Ã¡%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ã©', 'é')
WHERE "Nombre" LIKE '%Ã©%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ã­', 'í')
WHERE "Nombre" LIKE '%Ã­%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ã³', 'ó')
WHERE "Nombre" LIKE '%Ã³%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'Ãº', 'ú')
WHERE "Nombre" LIKE '%Ãº%';

-- Also fix double-double encoding (ÃƒÂ patterns)
UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂ±', 'ñ')
WHERE "Nombre" LIKE '%ÃƒÂ±%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂ¡', 'á')
WHERE "Nombre" LIKE '%ÃƒÂ¡%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂ©', 'é')
WHERE "Nombre" LIKE '%ÃƒÂ©%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂ­', 'í')
WHERE "Nombre" LIKE '%ÃƒÂ­%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂ³', 'ó')
WHERE "Nombre" LIKE '%ÃƒÂ³%';

UPDATE "Usuarios" 
SET "Nombre" = REPLACE("Nombre", 'ÃƒÂº', 'ú')
WHERE "Nombre" LIKE '%ÃƒÂº%';

-- Verify the fix
SELECT "Id", "Nombre" FROM "Usuarios" ORDER BY "Id" LIMIT 15;
