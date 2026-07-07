using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProgramacionOPGantt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProgramacionesOP",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NumeroOP = table.Column<string>(type: "text", nullable: false),
                    OrdenProduccionId = table.Column<int>(type: "integer", nullable: true),
                    Cliente = table.Column<string>(type: "text", nullable: false),
                    MetaTiros = table.Column<int>(type: "integer", nullable: false),
                    Color = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramacionesOP", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramacionesOP_OrdenesProduccion_OrdenProduccionId",
                        column: x => x.OrdenProduccionId,
                        principalTable: "OrdenesProduccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProgramacionesOPProcesos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProgramacionOPId = table.Column<int>(type: "integer", nullable: false),
                    Proceso = table.Column<string>(type: "text", nullable: false),
                    FechaInicio = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaFin = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramacionesOPProcesos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramacionesOPProcesos_ProgramacionesOP_ProgramacionOPId",
                        column: x => x.ProgramacionOPId,
                        principalTable: "ProgramacionesOP",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramacionesOP_OrdenProduccionId",
                table: "ProgramacionesOP",
                column: "OrdenProduccionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgramacionesOPProcesos_ProgramacionOPId",
                table: "ProgramacionesOPProcesos",
                column: "ProgramacionOPId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ProgramacionesOPProcesos");
            migrationBuilder.DropTable(name: "ProgramacionesOP");
        }
    }
}
