using Npgsql;
const string cs = "Host=localhost;Port=5432;Database=TiemposProcesos;Username=postgres;Password=@L3ph2026";
await using var conn = new NpgsqlConnection(cs);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand("""TRUNCATE TABLE "Almacen_Proveedores" RESTART IDENTITY;""", conn);
await cmd.ExecuteNonQueryAsync();
Console.WriteLine("Catálogo de proveedores vaciado.");
