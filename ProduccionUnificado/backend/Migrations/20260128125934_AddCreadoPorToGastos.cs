using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCreadoPorToGastos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HorarioId",
                table: "TiempoProcesos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HorarioId",
                table: "ProduccionDiaria",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreadoPorId",
                table: "Produccion_Gastos",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Horarios",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Codigo = table.Column<string>(type: "text", nullable: false),
                    Nombre = table.Column<string>(type: "text", nullable: false),
                    InicioSemana = table.Column<TimeSpan>(type: "interval", nullable: false),
                    FinSemana = table.Column<TimeSpan>(type: "interval", nullable: false),
                    InicioSabado = table.Column<TimeSpan>(type: "interval", nullable: false),
                    FinSabado = table.Column<TimeSpan>(type: "interval", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Horarios", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TiempoProcesos_HorarioId",
                table: "TiempoProcesos",
                column: "HorarioId");

            migrationBuilder.CreateIndex(
                name: "IX_ProduccionDiaria_HorarioId",
                table: "ProduccionDiaria",
                column: "HorarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Produccion_Gastos_CreadoPorId",
                table: "Produccion_Gastos",
                column: "CreadoPorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Produccion_Gastos_AdminUsuarios_CreadoPorId",
                table: "Produccion_Gastos",
                column: "CreadoPorId",
                principalTable: "AdminUsuarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ProduccionDiaria_Horarios_HorarioId",
                table: "ProduccionDiaria",
                column: "HorarioId",
                principalTable: "Horarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_TiempoProcesos_Horarios_HorarioId",
                table: "TiempoProcesos",
                column: "HorarioId",
                principalTable: "Horarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Produccion_Gastos_AdminUsuarios_CreadoPorId",
                table: "Produccion_Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_ProduccionDiaria_Horarios_HorarioId",
                table: "ProduccionDiaria");

            migrationBuilder.DropForeignKey(
                name: "FK_TiempoProcesos_Horarios_HorarioId",
                table: "TiempoProcesos");

            migrationBuilder.DropTable(
                name: "Horarios");

            migrationBuilder.DropIndex(
                name: "IX_TiempoProcesos_HorarioId",
                table: "TiempoProcesos");

            migrationBuilder.DropIndex(
                name: "IX_ProduccionDiaria_HorarioId",
                table: "ProduccionDiaria");

            migrationBuilder.DropIndex(
                name: "IX_Produccion_Gastos_CreadoPorId",
                table: "Produccion_Gastos");

            migrationBuilder.DropColumn(
                name: "HorarioId",
                table: "TiempoProcesos");

            migrationBuilder.DropColumn(
                name: "HorarioId",
                table: "ProduccionDiaria");

            migrationBuilder.DropColumn(
                name: "CreadoPorId",
                table: "Produccion_Gastos");
        }
    }
}
