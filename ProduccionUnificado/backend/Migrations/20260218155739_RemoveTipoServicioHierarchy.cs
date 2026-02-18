using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTipoServicioHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_Cotizaciones_Diseno_Proveedores_Diseno_ProveedorId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_Cotizaciones_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_Gastos_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_PresupuestosMensuales_Diseno_TiposServicio_TipoServi~",
                table: "Diseno_PresupuestosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_Proveedores_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Proveedores");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_Cotizaciones_Planeacion_TiposServicio_TipoServic~",
                table: "Planeacion_Cotizaciones");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_Gastos_Planeacion_TiposServicio_TipoServicioId",
                table: "Planeacion_Gastos");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_PresupuestosMensuales_Planeacion_TiposServicio_T~",
                table: "Planeacion_PresupuestosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_Proveedores_Planeacion_TiposServicio_TipoServici~",
                table: "Planeacion_Proveedores");

            migrationBuilder.DropTable(
                name: "Diseno_TiposServicio");

            migrationBuilder.DropTable(
                name: "Planeacion_TiposServicio");

            migrationBuilder.DropIndex(
                name: "IX_Planeacion_Gastos_TipoServicioId",
                table: "Planeacion_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_Planeacion_Cotizaciones_TipoServicioId",
                table: "Planeacion_Cotizaciones");

            migrationBuilder.DropIndex(
                name: "IX_Diseno_Gastos_TipoServicioId",
                table: "Diseno_Gastos");

            migrationBuilder.DropIndex(
                name: "IX_Diseno_Cotizaciones_Diseno_ProveedorId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.DropIndex(
                name: "IX_Diseno_Cotizaciones_TipoServicioId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "TipoServicioId",
                table: "Planeacion_Gastos");

            migrationBuilder.DropColumn(
                name: "TipoServicioId",
                table: "Planeacion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "Correo",
                table: "Diseno_Proveedores");

            migrationBuilder.DropColumn(
                name: "Direccion",
                table: "Diseno_Proveedores");

            migrationBuilder.DropColumn(
                name: "TipoServicioId",
                table: "Diseno_Gastos");

            migrationBuilder.DropColumn(
                name: "Diseno_ProveedorId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "TipoServicioId",
                table: "Diseno_Cotizaciones");

            migrationBuilder.RenameColumn(
                name: "TipoServicioId",
                table: "Planeacion_Proveedores",
                newName: "RubroId");

            migrationBuilder.RenameIndex(
                name: "IX_Planeacion_Proveedores_TipoServicioId",
                table: "Planeacion_Proveedores",
                newName: "IX_Planeacion_Proveedores_RubroId");

            migrationBuilder.RenameColumn(
                name: "TipoServicioId",
                table: "Planeacion_PresupuestosMensuales",
                newName: "RubroId");

            migrationBuilder.RenameIndex(
                name: "IX_Planeacion_PresupuestosMensuales_TipoServicioId_Anio_Mes",
                table: "Planeacion_PresupuestosMensuales",
                newName: "IX_Planeacion_PresupuestosMensuales_RubroId_Anio_Mes");

            migrationBuilder.RenameColumn(
                name: "TipoServicioId",
                table: "Diseno_Proveedores",
                newName: "RubroId");

            migrationBuilder.RenameIndex(
                name: "IX_Diseno_Proveedores_TipoServicioId",
                table: "Diseno_Proveedores",
                newName: "IX_Diseno_Proveedores_RubroId");

            migrationBuilder.RenameColumn(
                name: "TipoServicioId",
                table: "Diseno_PresupuestosMensuales",
                newName: "RubroId");

            migrationBuilder.RenameIndex(
                name: "IX_Diseno_PresupuestosMensuales_TipoServicioId_Anio_Mes",
                table: "Diseno_PresupuestosMensuales",
                newName: "IX_Diseno_PresupuestosMensuales_RubroId_Anio_Mes");

            migrationBuilder.AlterColumn<string>(
                name: "Descripcion",
                table: "Planeacion_Cotizaciones",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecioCotizado",
                table: "Diseno_Proveedores",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Descripcion",
                table: "Diseno_Cotizaciones",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_PresupuestosMensuales_Diseno_Rubros_RubroId",
                table: "Diseno_PresupuestosMensuales",
                column: "RubroId",
                principalTable: "Diseno_Rubros",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_Proveedores_Diseno_Rubros_RubroId",
                table: "Diseno_Proveedores",
                column: "RubroId",
                principalTable: "Diseno_Rubros",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_PresupuestosMensuales_Planeacion_Rubros_RubroId",
                table: "Planeacion_PresupuestosMensuales",
                column: "RubroId",
                principalTable: "Planeacion_Rubros",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_Proveedores_Planeacion_Rubros_RubroId",
                table: "Planeacion_Proveedores",
                column: "RubroId",
                principalTable: "Planeacion_Rubros",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_PresupuestosMensuales_Diseno_Rubros_RubroId",
                table: "Diseno_PresupuestosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_Diseno_Proveedores_Diseno_Rubros_RubroId",
                table: "Diseno_Proveedores");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_PresupuestosMensuales_Planeacion_Rubros_RubroId",
                table: "Planeacion_PresupuestosMensuales");

            migrationBuilder.DropForeignKey(
                name: "FK_Planeacion_Proveedores_Planeacion_Rubros_RubroId",
                table: "Planeacion_Proveedores");

            migrationBuilder.DropColumn(
                name: "PrecioCotizado",
                table: "Diseno_Proveedores");

            migrationBuilder.RenameColumn(
                name: "RubroId",
                table: "Planeacion_Proveedores",
                newName: "TipoServicioId");

            migrationBuilder.RenameIndex(
                name: "IX_Planeacion_Proveedores_RubroId",
                table: "Planeacion_Proveedores",
                newName: "IX_Planeacion_Proveedores_TipoServicioId");

            migrationBuilder.RenameColumn(
                name: "RubroId",
                table: "Planeacion_PresupuestosMensuales",
                newName: "TipoServicioId");

            migrationBuilder.RenameIndex(
                name: "IX_Planeacion_PresupuestosMensuales_RubroId_Anio_Mes",
                table: "Planeacion_PresupuestosMensuales",
                newName: "IX_Planeacion_PresupuestosMensuales_TipoServicioId_Anio_Mes");

            migrationBuilder.RenameColumn(
                name: "RubroId",
                table: "Diseno_Proveedores",
                newName: "TipoServicioId");

            migrationBuilder.RenameIndex(
                name: "IX_Diseno_Proveedores_RubroId",
                table: "Diseno_Proveedores",
                newName: "IX_Diseno_Proveedores_TipoServicioId");

            migrationBuilder.RenameColumn(
                name: "RubroId",
                table: "Diseno_PresupuestosMensuales",
                newName: "TipoServicioId");

            migrationBuilder.RenameIndex(
                name: "IX_Diseno_PresupuestosMensuales_RubroId_Anio_Mes",
                table: "Diseno_PresupuestosMensuales",
                newName: "IX_Diseno_PresupuestosMensuales_TipoServicioId_Anio_Mes");

            migrationBuilder.AddColumn<int>(
                name: "TipoServicioId",
                table: "Planeacion_Gastos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Descripcion",
                table: "Planeacion_Cotizaciones",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoServicioId",
                table: "Planeacion_Cotizaciones",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Correo",
                table: "Diseno_Proveedores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Direccion",
                table: "Diseno_Proveedores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoServicioId",
                table: "Diseno_Gastos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Descripcion",
                table: "Diseno_Cotizaciones",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Diseno_ProveedorId",
                table: "Diseno_Cotizaciones",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TipoServicioId",
                table: "Diseno_Cotizaciones",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Diseno_TiposServicio",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_TiposServicio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diseno_TiposServicio_Diseno_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Diseno_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Planeacion_TiposServicio",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_TiposServicio", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Planeacion_TiposServicio_Planeacion_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Planeacion_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_TipoServicioId",
                table: "Planeacion_Gastos",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Cotizaciones_TipoServicioId",
                table: "Planeacion_Cotizaciones",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_TipoServicioId",
                table: "Diseno_Gastos",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_Diseno_ProveedorId",
                table: "Diseno_Cotizaciones",
                column: "Diseno_ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_TipoServicioId",
                table: "Diseno_Cotizaciones",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_TiposServicio_RubroId",
                table: "Diseno_TiposServicio",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_TiposServicio_RubroId",
                table: "Planeacion_TiposServicio",
                column: "RubroId");

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_Cotizaciones_Diseno_Proveedores_Diseno_ProveedorId",
                table: "Diseno_Cotizaciones",
                column: "Diseno_ProveedorId",
                principalTable: "Diseno_Proveedores",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_Cotizaciones_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Cotizaciones",
                column: "TipoServicioId",
                principalTable: "Diseno_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_Gastos_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Gastos",
                column: "TipoServicioId",
                principalTable: "Diseno_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_PresupuestosMensuales_Diseno_TiposServicio_TipoServi~",
                table: "Diseno_PresupuestosMensuales",
                column: "TipoServicioId",
                principalTable: "Diseno_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Diseno_Proveedores_Diseno_TiposServicio_TipoServicioId",
                table: "Diseno_Proveedores",
                column: "TipoServicioId",
                principalTable: "Diseno_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_Cotizaciones_Planeacion_TiposServicio_TipoServic~",
                table: "Planeacion_Cotizaciones",
                column: "TipoServicioId",
                principalTable: "Planeacion_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_Gastos_Planeacion_TiposServicio_TipoServicioId",
                table: "Planeacion_Gastos",
                column: "TipoServicioId",
                principalTable: "Planeacion_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_PresupuestosMensuales_Planeacion_TiposServicio_T~",
                table: "Planeacion_PresupuestosMensuales",
                column: "TipoServicioId",
                principalTable: "Planeacion_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Planeacion_Proveedores_Planeacion_TiposServicio_TipoServici~",
                table: "Planeacion_Proveedores",
                column: "TipoServicioId",
                principalTable: "Planeacion_TiposServicio",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
