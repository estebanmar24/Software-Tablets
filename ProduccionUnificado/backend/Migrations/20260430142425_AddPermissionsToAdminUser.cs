using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPermissionsToAdminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CantidadHoras",
                table: "Mantenimiento_Gastos",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HoraFin",
                table: "Mantenimiento_Gastos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HoraInicio",
                table: "Mantenimiento_Gastos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OtraMaquinaNombre",
                table: "Mantenimiento_Gastos",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoHoraId",
                table: "Mantenimiento_Gastos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoRecargoId",
                table: "Mantenimiento_Gastos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsuarioId",
                table: "Mantenimiento_Gastos",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Consecutivo",
                table: "BitacorasMaquinas",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "Resuelto",
                table: "BitacorasMaquinas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Permissions",
                table: "AdminUsuarios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_TipoHoraId",
                table: "Mantenimiento_Gastos",
                column: "TipoHoraId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_TipoRecargoId",
                table: "Mantenimiento_Gastos",
                column: "TipoRecargoId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_UsuarioId",
                table: "Mantenimiento_Gastos",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Mantenimiento_Gastos_Mantenimiento_TiposHora_TipoHoraId",
                table: "Mantenimiento_Gastos",
                column: "TipoHoraId",
                principalTable: "Mantenimiento_TiposHora",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Mantenimiento_Gastos_Mantenimiento_TiposRecargo_TipoRecargo~",
                table: "Mantenimiento_Gastos",
                column: "TipoRecargoId",
                principalTable: "Mantenimiento_TiposRecargo",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Mantenimiento_Gastos_Usuarios_UsuarioId",
                table: "Mantenimiento_Gastos",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Mantenimiento_Gastos_Mantenimiento_TiposHora_TipoHoraId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_Mantenimiento_Gastos_Mantenimiento_TiposRecargo_TipoRecargo~",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_Mantenimiento_Gastos_Usuarios_UsuarioId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_Mantenimiento_Gastos_TipoHoraId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_Mantenimiento_Gastos_TipoRecargoId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_Mantenimiento_Gastos_UsuarioId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "CantidadHoras",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "HoraFin",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "HoraInicio",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "OtraMaquinaNombre",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "TipoHoraId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "TipoRecargoId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "UsuarioId",
                table: "Mantenimiento_Gastos");

            migrationBuilder.DropColumn(
                name: "Consecutivo",
                table: "BitacorasMaquinas");

            migrationBuilder.DropColumn(
                name: "Resuelto",
                table: "BitacorasMaquinas");

            migrationBuilder.DropColumn(
                name: "Permissions",
                table: "AdminUsuarios");
        }
    }
}
