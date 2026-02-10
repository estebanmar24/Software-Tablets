using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProduccionDiariaDetalle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Documento",
                table: "Usuarios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "EsPorHoras",
                table: "Usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Documento",
                table: "Talleres_Personal",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "CreadoPorId",
                table: "Talleres_Gastos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreadoPorId",
                table: "SST_GastosMensuales",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreadoPorId",
                table: "GH_GastosMensuales",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EncuestasOrdenAseo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProcesoAuditado = table.Column<string>(type: "text", nullable: false),
                    NombreAuditado = table.Column<string>(type: "text", nullable: false),
                    Planta = table.Column<string>(type: "text", nullable: false),
                    ImplementosAseo = table.Column<bool>(type: "boolean", nullable: false),
                    FotoImplementosAseo = table.Column<string>(type: "text", nullable: true),
                    HerramientasLugar = table.Column<bool>(type: "boolean", nullable: false),
                    FotoHerramientasLugar = table.Column<string>(type: "text", nullable: true),
                    TarrosRotulados = table.Column<bool>(type: "boolean", nullable: false),
                    FotoTarrosRotulados = table.Column<string>(type: "text", nullable: true),
                    AreaDespejada = table.Column<bool>(type: "boolean", nullable: false),
                    FotoAreaDespejada = table.Column<string>(type: "text", nullable: true),
                    RutasEvacuacion = table.Column<bool>(type: "boolean", nullable: false),
                    FotoRutasEvacuacion = table.Column<string>(type: "text", nullable: true),
                    MesasTrabajo = table.Column<bool>(type: "boolean", nullable: false),
                    FotoMesasTrabajo = table.Column<string>(type: "text", nullable: true),
                    Observaciones = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreadoPor = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncuestasOrdenAseo", x => x.Id);
                });


            migrationBuilder.CreateTable(
                name: "ProduccionDiariaDetalles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProduccionDiariaId = table.Column<long>(type: "bigint", nullable: false),
                    HoraInicio = table.Column<TimeSpan>(type: "interval", nullable: false),
                    HoraFin = table.Column<TimeSpan>(type: "interval", nullable: false),
                    ActividadId = table.Column<int>(type: "integer", nullable: false),
                    Tiros = table.Column<int>(type: "integer", nullable: false),
                    ReferenciaOP = table.Column<string>(type: "text", nullable: true),
                    Observaciones = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProduccionDiariaDetalles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProduccionDiariaDetalles_Actividades_ActividadId",
                        column: x => x.ActividadId,
                        principalTable: "Actividades",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProduccionDiariaDetalles_ProduccionDiaria_ProduccionDiariaId",
                        column: x => x.ProduccionDiariaId,
                        principalTable: "ProduccionDiaria",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Talleres_Gastos_CreadoPorId",
                table: "Talleres_Gastos",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_SST_GastosMensuales_CreadoPorId",
                table: "SST_GastosMensuales",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_GH_GastosMensuales_CreadoPorId",
                table: "GH_GastosMensuales",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_ProduccionDiariaDetalles_ActividadId",
                table: "ProduccionDiariaDetalles",
                column: "ActividadId");

            migrationBuilder.CreateIndex(
                name: "IX_ProduccionDiariaDetalles_ProduccionDiariaId",
                table: "ProduccionDiariaDetalles",
                column: "ProduccionDiariaId");

            migrationBuilder.AddForeignKey(
                name: "FK_GH_GastosMensuales_AdminUsuarios_CreadoPorId",
                table: "GH_GastosMensuales",
                column: "CreadoPorId",
                principalTable: "AdminUsuarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SST_GastosMensuales_AdminUsuarios_CreadoPorId",
                table: "SST_GastosMensuales",
                column: "CreadoPorId",
                principalTable: "AdminUsuarios",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Talleres_Gastos_AdminUsuarios_CreadoPorId",
                table: "Talleres_Gastos",
                column: "CreadoPorId",
                principalTable: "AdminUsuarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GH_GastosMensuales_AdminUsuarios_CreadoPorId",
                table: "GH_GastosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_SST_GastosMensuales_AdminUsuarios_CreadoPorId",
                table: "SST_GastosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_Talleres_Gastos_AdminUsuarios_CreadoPorId",
                table: "Talleres_Gastos");

            migrationBuilder.DropTable(
                name: "EncuestasOrdenAseo");

            migrationBuilder.DropTable(
                name: "ProduccionDiariaDetalles");

            migrationBuilder.DropIndex(
                name: "IX_Talleres_Gastos_CreadoPorId",
                table: "Talleres_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_SST_GastosMensuales_CreadoPorId",
                table: "SST_GastosMensuales");

            migrationBuilder.DropIndex(
                name: "IX_GH_GastosMensuales_CreadoPorId",
                table: "GH_GastosMensuales");

            migrationBuilder.DropColumn(
                name: "Documento",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "EsPorHoras",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Documento",
                table: "Talleres_Personal");

            migrationBuilder.DropColumn(
                name: "CreadoPorId",
                table: "Talleres_Gastos");

            migrationBuilder.DropColumn(
                name: "CreadoPorId",
                table: "SST_GastosMensuales");

            migrationBuilder.DropColumn(
                name: "CreadoPorId",
                table: "GH_GastosMensuales");
        }
    }
}
