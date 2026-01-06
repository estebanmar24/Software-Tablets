-- Script para crear manualmente el usuario 'develop'
-- Ejecutar esto en SQL Server Management Studio o cualquier cliente SQL

-- Primero verificar si ya existe
SELECT * FROM AdminUsuarios WHERE Username = 'develop';

-- Si existe, eliminarlo para recrearlo
DELETE FROM AdminUsuarios WHERE Username = 'develop';

-- Insertar el usuario develop con la contraseña hasheada
INSERT INTO AdminUsuarios (Username, PasswordHash, Role, NombreMostrar)
VALUES (
    'develop',
    '$2a$11$rYQZGJvKZ5K8YxN6YqF3F.uJ9nWZmQGz9xNXJH8rJ3gE1JqYKqR0S',
    'develop',
    'Desarrollador'
);

-- Verificar que se creó correctamente
SELECT * FROM AdminUsuarios WHERE Username = 'develop';

-- NOTA: El hash corresponde a la contraseña: @L3ph2026
-- Si este hash no funciona, necesitarás generarlo usando BCrypt con el código C#
