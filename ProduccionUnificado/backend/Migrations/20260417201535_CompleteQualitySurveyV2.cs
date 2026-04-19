using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class CompleteQualitySurveyV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TalleresExternos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TalleresExternos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EncuestasCalidadTalleres",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TallerId = table.Column<int>(type: "integer", nullable: false),
                    HoraLlegada = table.Column<string>(type: "text", nullable: false),
                    HoraSalida = table.Column<string>(type: "text", nullable: false),
                    OrdenProduccion = table.Column<string>(type: "text", nullable: false),
                    NumeroRemision = table.Column<string>(type: "text", nullable: false),
                    CantidadProducir = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CantidadEvaluada = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    EstadoProceso = table.Column<string>(type: "text", nullable: false),
                    TieneMuestra = table.Column<bool>(type: "boolean", nullable: false),
                    TipoProducto = table.Column<string>(type: "text", nullable: true),
                    ConoceFormaEmpaque = table.Column<bool>(type: "boolean", nullable: false),
                    TieneRemision = table.Column<bool>(type: "boolean", nullable: false),
                    TieneInsumosCompletos = table.Column<bool>(type: "boolean", nullable: false),
                    VariacionTono = table.Column<bool>(type: "boolean", nullable: false),
                    QuebradoArrugado = table.Column<bool>(type: "boolean", nullable: false),
                    EsquinaDefectuosa = table.Column<bool>(type: "boolean", nullable: false),
                    PresenciaPestanas = table.Column<bool>(type: "boolean", nullable: false),
                    DesgasteImpresion = table.Column<bool>(type: "boolean", nullable: false),
                    Manchas = table.Column<bool>(type: "boolean", nullable: false),
                    ReservaPega = table.Column<bool>(type: "boolean", nullable: false),
                    GrafadoRoto = table.Column<bool>(type: "boolean", nullable: false),
                    NovedadBPM = table.Column<bool>(type: "boolean", nullable: false),
                    UsaCofia = table.Column<bool>(type: "boolean", nullable: false),
                    InsumosPendientes = table.Column<bool>(type: "boolean", nullable: false),
                    TipoInsumosPendientes = table.Column<string>(type: "text", nullable: true),
                    Observaciones = table.Column<string>(type: "text", nullable: true),
                    UsuarioId = table.Column<int>(type: "integer", nullable: false),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncuestasCalidadTalleres", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EncuestasCalidadTalleres_TalleresExternos_TallerId",
                        column: x => x.TallerId,
                        principalTable: "TalleresExternos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EncuestasCalidadTalleres_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EncuestasCalidadTalleres_TallerId",
                table: "EncuestasCalidadTalleres",
                column: "TallerId");

            migrationBuilder.CreateIndex(
                name: "IX_EncuestasCalidadTalleres_UsuarioId",
                table: "EncuestasCalidadTalleres",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EncuestasCalidadTalleres");

            migrationBuilder.DropTable(
                name: "TalleresExternos");
        }
    }
}
