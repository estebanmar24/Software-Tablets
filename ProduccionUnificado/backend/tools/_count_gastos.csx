using Npgsql;
var cs = "Host=localhost;Port=5432;Database=TiemposProcesos;Username=postgres;Password=@L3ph2026";
await using var conn = new NpgsqlConnection(cs);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand(@"SELECT COUNT(*) FROM ""Produccion_Gastos"" WHERE ""Anio""=2026 AND ""Mes""=6", conn);
Console.WriteLine("Gastos junio 2026: " + await cmd.ExecuteScalarAsync());
