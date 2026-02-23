using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRubroToTalleresProveedor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RubroId",
                table: "Talleres_Proveedores",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "NumeroOP",
                table: "Talleres_Gastos",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NumeroOP",
                table: "Planeacion_Gastos",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Talleres_Proveedores_RubroId",
                table: "Talleres_Proveedores",
                column: "RubroId");

            migrationBuilder.AddForeignKey(
                name: "FK_Talleres_Proveedores_Talleres_Rubros_RubroId",
                table: "Talleres_Proveedores",
                column: "RubroId",
                principalTable: "Talleres_Rubros",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Talleres_Proveedores_Talleres_Rubros_RubroId",
                table: "Talleres_Proveedores");

            migrationBuilder.DropIndex(
                name: "IX_Talleres_Proveedores_RubroId",
                table: "Talleres_Proveedores");

            migrationBuilder.DropColumn(
                name: "RubroId",
                table: "Talleres_Proveedores");

            migrationBuilder.DropColumn(
                name: "NumeroOP",
                table: "Planeacion_Gastos");

            migrationBuilder.AlterColumn<string>(
                name: "NumeroOP",
                table: "Talleres_Gastos",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
