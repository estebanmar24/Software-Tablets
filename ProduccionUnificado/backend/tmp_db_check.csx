using Npgsql;
var cs = "Host=localhost;Port=5432;Database=TiemposProcesos;Username=postgres;Password=@L3ph2026";
await using var conn = new NpgsqlConnection(cs);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand(@"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Almacen%' ORDER BY 1", conn);
await using var r = await cmd.ExecuteReaderAsync();
while (await r.ReadAsync()) Console.WriteLine(r.GetString(0));
