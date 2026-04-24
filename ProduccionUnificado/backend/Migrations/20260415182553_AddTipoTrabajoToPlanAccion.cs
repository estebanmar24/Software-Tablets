using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTipoTrabajoToPlanAccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Email ya existe en Usuarios
            
            // TipoTrabajo ya existe en PlanesAccion
            
            // Email ya existe en AdminUsuarios
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Email",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "TipoTrabajo",
                table: "PlanesAccion");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "AdminUsuarios");
        }
    }
}
