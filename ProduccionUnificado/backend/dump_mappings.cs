using System;
using System.Linq;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

namespace MappingDumper
{
    class Program
    {
        static void Main(string[] args)
        {
            var config = new ConfigurationBuilder()
                .SetBasePath(System.IO.Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json")
                .Build();

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseNpgsql(config.GetConnectionString("DefaultConnection"));

            using (var context = new AppDbContext(optionsBuilder.Options))
            {
                var maquinas = context.Maquinas.Select(m => new { m.Id, m.Nombre }).ToList();
                var usuarios = context.Usuarios.Select(u => new { u.Id, u.Nombre }).ToList();
                var codigos = context.CodigosDesperdicio.Select(c => new { c.Id, c.Codigo, c.Descripcion }).ToList();

                System.IO.File.WriteAllText("mappings.json", System.Text.Json.JsonSerializer.Serialize(new { maquinas, usuarios, codigos }, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                Console.WriteLine("Mappings dumped to mappings.json");
            }
        }
    }
}
