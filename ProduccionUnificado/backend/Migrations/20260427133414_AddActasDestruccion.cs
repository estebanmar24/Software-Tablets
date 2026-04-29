using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddActasDestruccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActasDestruccion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    OrdenProduccion = table.Column<string>(type: "text", nullable: false),
                    Cliente = table.Column<string>(type: "text", nullable: false),
                    Producto = table.Column<string>(type: "text", nullable: false),
                    CantidadActaDestruccion = table.Column<decimal>(type: "numeric", nullable: false),
                    Motivo = table.Column<string>(type: "text", nullable: false),
                    ProcesoReporta = table.Column<string>(type: "text", nullable: false),
                    CantidadOP = table.Column<decimal>(type: "numeric", nullable: false),
                    CantidadRealDespachada = table.Column<decimal>(type: "numeric", nullable: false),
                    Faltante = table.Column<decimal>(type: "numeric", nullable: false),
                    Estado = table.Column<string>(type: "text", nullable: false),
                    ArchivoPdfPath = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActasDestruccion", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActasDestruccion");
        }
    }
}
