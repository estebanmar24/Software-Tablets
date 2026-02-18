using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddClienteAndProcessObsToCalidadProd : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Desperdicio",
                table: "ProduccionDiariaDetalles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "EncuestasCalidadProduccion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    OrdenProduccion = table.Column<string>(type: "text", nullable: false),
                    Referencia = table.Column<string>(type: "text", nullable: true),
                    Material = table.Column<string>(type: "text", nullable: true),
                    Cabida = table.Column<string>(type: "text", nullable: true),
                    CantidadAProducir = table.Column<decimal>(type: "numeric", nullable: false),
                    CantidadRecuperada = table.Column<decimal>(type: "numeric", nullable: false),
                    CantidadParaDespacho = table.Column<decimal>(type: "numeric", nullable: false),
                    Cliente = table.Column<string>(type: "text", nullable: true),
                    Observaciones = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncuestasCalidadProduccion", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MetasMensuales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MaquinaId = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Meta100Porciento = table.Column<int>(type: "integer", nullable: false),
                    MetaRendimiento = table.Column<int>(type: "integer", nullable: false),
                    Importancia = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    TirosReferencia = table.Column<int>(type: "integer", nullable: false),
                    ValorPorTiro = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Tarifa = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MetasMensuales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MetasMensuales_Maquinas_MaquinaId",
                        column: x => x.MaquinaId,
                        principalTable: "Maquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EncuestaCalidadProduccionProcesos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EncuestaId = table.Column<int>(type: "integer", nullable: false),
                    Proceso = table.Column<string>(type: "text", nullable: false),
                    CantidadProducida = table.Column<decimal>(type: "numeric", nullable: false),
                    Observaciones = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncuestaCalidadProduccionProcesos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EncuestaCalidadProduccionProcesos_EncuestasCalidadProduccio~",
                        column: x => x.EncuestaId,
                        principalTable: "EncuestasCalidadProduccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EncuestaCalidadProduccionProcesos_EncuestaId",
                table: "EncuestaCalidadProduccionProcesos",
                column: "EncuestaId");

            migrationBuilder.CreateIndex(
                name: "IX_MetasMensuales_MaquinaId_Mes_Anio",
                table: "MetasMensuales",
                columns: new[] { "MaquinaId", "Mes", "Anio" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EncuestaCalidadProduccionProcesos");

            migrationBuilder.DropTable(
                name: "MetasMensuales");

            migrationBuilder.DropTable(
                name: "EncuestasCalidadProduccion");

            migrationBuilder.DropColumn(
                name: "Desperdicio",
                table: "ProduccionDiariaDetalles");
        }
    }
}
