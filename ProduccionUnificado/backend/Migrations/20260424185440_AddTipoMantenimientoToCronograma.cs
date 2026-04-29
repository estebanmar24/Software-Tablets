using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTipoMantenimientoToCronograma : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // migrationBuilder.DropColumn(
            //     name: "Medida",
            //     table: "Produccion_Cotizaciones");

            // migrationBuilder.AddColumn<string>(
            //     name: "Descripcion",
            //     table: "Produccion_Productos",
            //     type: "character varying(500)",
            //     maxLength: 500,
            //     nullable: true);

            // migrationBuilder.AddColumn<string>(
            //     name: "Medida",
            //     table: "Produccion_Productos",
            //     type: "character varying(20)",
            //     maxLength: 20,
            //     nullable: true);

            // migrationBuilder.AddColumn<string>(
            //     name: "Referencia",
            //     table: "Produccion_Productos",
            //     type: "character varying(100)",
            //     maxLength: 100,
            //     nullable: true);

            // migrationBuilder.AddColumn<int>(
            //    name: "Dia",
            //    table: "Cronogramas_Registros",
            //    type: "integer",
            //    nullable: false,
            //    defaultValue: 0);

            // migrationBuilder.AddColumn<string>(
            //    name: "TipoMantenimiento",
            //    table: "Cronogramas_Actividades",
            //    type: "text",
            //    nullable: false,
            //    defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Descripcion",
                table: "Produccion_Productos");

            migrationBuilder.DropColumn(
                name: "Medida",
                table: "Produccion_Productos");

            migrationBuilder.DropColumn(
                name: "Referencia",
                table: "Produccion_Productos");

            migrationBuilder.DropColumn(
                name: "Dia",
                table: "Cronogramas_Registros");

            migrationBuilder.DropColumn(
                name: "TipoMantenimiento",
                table: "Cronogramas_Actividades");

            migrationBuilder.AddColumn<string>(
                name: "Medida",
                table: "Produccion_Cotizaciones",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }
    }
}
