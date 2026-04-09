using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddHorarioIdToTalleresPersonal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migración manual salteada - ya aplicado en DB
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Talleres_Personal_Horarios_HorarioId",
                table: "Talleres_Personal");

            migrationBuilder.DropTable(
                name: "PlanAccionEvidencias");

            migrationBuilder.DropTable(
                name: "PlanesAccion");

            migrationBuilder.DropIndex(
                name: "IX_Talleres_Personal_HorarioId",
                table: "Talleres_Personal");

            migrationBuilder.DropColumn(
                name: "HorarioId",
                table: "Talleres_Personal");

            migrationBuilder.AlterColumn<decimal>(
                name: "Precio",
                table: "Talleres_Gastos",
                type: "numeric(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)");

            migrationBuilder.AlterColumn<decimal>(
                name: "ValorPorTiro",
                table: "MetasMensuales",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(10,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "TirosReferencia",
                table: "MetasMensuales",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Tarifa",
                table: "MetasMensuales",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MetaRendimiento",
                table: "MetasMensuales",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Meta100Porciento",
                table: "MetasMensuales",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Importancia",
                table: "MetasMensuales",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(5,2)",
                oldNullable: true);
        }
    }
}
