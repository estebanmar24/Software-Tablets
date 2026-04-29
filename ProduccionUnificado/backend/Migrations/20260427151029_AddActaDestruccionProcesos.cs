using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddActaDestruccionProcesos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActaDestruccionProcesos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ActaDestruccionId = table.Column<int>(type: "integer", nullable: false),
                    Proceso = table.Column<string>(type: "text", nullable: false),
                    Motivo = table.Column<string>(type: "text", nullable: false),
                    Cantidad = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActaDestruccionProcesos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActaDestruccionProcesos_ActasDestruccion_ActaDestruccionId",
                        column: x => x.ActaDestruccionId,
                        principalTable: "ActasDestruccion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActaDestruccionProcesos_ActaDestruccionId",
                table: "ActaDestruccionProcesos",
                column: "ActaDestruccionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActaDestruccionProcesos");
        }
    }
}
