using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMantenimientoExtraTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Mantenimiento_Productos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Referencia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_Productos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Productos_Mantenimiento_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Mantenimiento_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_TiposHora",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Valor = table.Column<decimal>(type: "numeric", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_TiposHora", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_TiposRecargo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Porcentaje = table.Column<decimal>(type: "numeric", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_TiposRecargo", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Productos_RubroId",
                table: "Mantenimiento_Productos",
                column: "RubroId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Mantenimiento_Productos");

            migrationBuilder.DropTable(
                name: "Mantenimiento_TiposHora");

            migrationBuilder.DropTable(
                name: "Mantenimiento_TiposRecargo");
        }
    }
}
