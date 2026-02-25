using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddConsolidadoNC : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConsolidadosNC",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EncuestaProduccionId = table.Column<int>(type: "integer", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    OrdenProduccion = table.Column<string>(type: "text", nullable: false),
                    Cliente = table.Column<string>(type: "text", nullable: true),
                    Referencia = table.Column<string>(type: "text", nullable: true),
                    CantidadTotal = table.Column<decimal>(type: "numeric", nullable: false),
                    DescripcionNovedad = table.Column<string>(type: "text", nullable: true),
                    TipoReclamacion = table.Column<string>(type: "text", nullable: true),
                    CantidadNC = table.Column<decimal>(type: "numeric", nullable: false),
                    Item = table.Column<string>(type: "text", nullable: true),
                    TipoDefecto = table.Column<string>(type: "text", nullable: true),
                    Responsable = table.Column<string>(type: "text", nullable: true),
                    AreaInvolucrada = table.Column<string>(type: "text", nullable: true),
                    Cargo = table.Column<string>(type: "text", nullable: true),
                    ValorNC = table.Column<decimal>(type: "numeric", nullable: false),
                    Producto = table.Column<string>(type: "text", nullable: true),
                    SalidaNC = table.Column<string>(type: "text", nullable: true),
                    Controles = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsolidadosNC", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsolidadosNC_EncuestasCalidadProduccion_EncuestaProduccio~",
                        column: x => x.EncuestaProduccionId,
                        principalTable: "EncuestasCalidadProduccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsolidadosNC_EncuestaProduccionId",
                table: "ConsolidadosNC",
                column: "EncuestaProduccionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConsolidadosNC");
        }
    }
}
