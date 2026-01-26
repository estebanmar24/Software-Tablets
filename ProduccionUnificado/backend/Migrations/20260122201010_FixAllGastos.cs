using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class FixAllGastos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Produccion_Gastos (Re-adding columns as dropped in rollback)
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCreacion",
                table: "Produccion_Gastos",
                type: "timestamp without time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaModificacion",
                table: "Produccion_Gastos",
                type: "timestamp without time zone",
                nullable: true);

            // Talleres_Gastos
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCreacion",
                table: "Talleres_Gastos",
                type: "timestamp without time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaModificacion",
                table: "Talleres_Gastos",
                type: "timestamp without time zone",
                nullable: true);

            // SST_GastosMensuales
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCreacion",
                table: "SST_GastosMensuales",
                type: "timestamp without time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaModificacion",
                table: "SST_GastosMensuales",
                type: "timestamp without time zone",
                nullable: true);

             // GH_GastosMensuales
            migrationBuilder.AddColumn<DateTime>(
                name: "FechaCreacion",
                table: "GH_GastosMensuales",
                type: "timestamp without time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaModificacion",
                table: "GH_GastosMensuales",
                type: "timestamp without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FechaCreacion", table: "Produccion_Gastos");
            migrationBuilder.DropColumn(name: "FechaModificacion", table: "Produccion_Gastos");

            migrationBuilder.DropColumn(name: "FechaCreacion", table: "Talleres_Gastos");
            migrationBuilder.DropColumn(name: "FechaModificacion", table: "Talleres_Gastos");

            migrationBuilder.DropColumn(name: "FechaCreacion", table: "SST_GastosMensuales");
            migrationBuilder.DropColumn(name: "FechaModificacion", table: "SST_GastosMensuales");

            migrationBuilder.DropColumn(name: "FechaCreacion", table: "GH_GastosMensuales");
            migrationBuilder.DropColumn(name: "FechaModificacion", table: "GH_GastosMensuales");
        }
    }
}
