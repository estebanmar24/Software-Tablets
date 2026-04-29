-- Check if CreadoPorId is set on Diseno gastos
SELECT g."Id", g."CreadoPorId", g."ProveedorId", g."NumeroFactura", g."Precio"
FROM "Diseno_Gastos" g
ORDER BY g."Id" DESC LIMIT 10;
