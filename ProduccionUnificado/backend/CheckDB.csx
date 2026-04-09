using System;
using System.IO;
using System.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Npgsql;

// Connection string from appsettings.Development.json (we know it's PostgreSQL)
var connString = "Host=localhost;Database=tiempoprocesos_db;Username=postgres;Password=123";

using (var conn = new NpgsqlConnection(connString))
{
    conn.Open();
    var cmd = new NpgsqlCommand("SELECT tp.\"Id\", tp.\"HoraInicio\", tp.\"HoraFin\", tp.\"Duracion\", op.\"Numero\" FROM \"TiempoProcesos\" tp JOIN \"OrdenesProduccion\" op ON tp.\"OrdenProduccionId\" = op.\"Id\" WHERE op.\"Numero\" = '7447' ORDER BY tp.\"HoraInicio\" DESC LIMIT 5", conn);
    using (var reader = cmd.ExecuteReader())
    {
        while (reader.Read())
        {
            Console.WriteLine($"Id: {reader["Id"]}, Inicio: {reader["HoraInicio"]}, Fin: {reader["HoraFin"]}, Duracion: {reader["Duracion"]}");
        }
    }
}
