using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMantenimientoGastos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Mantenimiento_Rubros",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_Rubros", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_PresupuestosMensuales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Presupuesto = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_PresupuestosMensuales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_PresupuestosMensuales_Mantenimiento_Rubros_Ru~",
                        column: x => x.RubroId,
                        principalTable: "Mantenimiento_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_Proveedores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: true),
                    Nit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Direccion = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Correo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_Proveedores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Proveedores_Mantenimiento_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Mantenimiento_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_Cotizaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    ProveedorId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    PrecioCotizado = table.Column<decimal>(type: "numeric", nullable: false),
                    Nota = table.Column<string>(type: "text", nullable: true),
                    Descripcion = table.Column<string>(type: "text", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_Cotizaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Cotizaciones_Mantenimiento_Proveedores_Provee~",
                        column: x => x.ProveedorId,
                        principalTable: "Mantenimiento_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Cotizaciones_Mantenimiento_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Mantenimiento_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Mantenimiento_Gastos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    ProveedorId = table.Column<int>(type: "integer", nullable: true),
                    MaquinaId = table.Column<int>(type: "integer", nullable: true),
                    Precio = table.Column<decimal>(type: "numeric", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Nota = table.Column<string>(type: "text", nullable: true),
                    NumeroFactura = table.Column<string>(type: "text", nullable: true),
                    FacturaPdfUrl = table.Column<string>(type: "text", nullable: true),
                    EsPendiente = table.Column<bool>(type: "boolean", nullable: false),
                    EsSolicitudCredito = table.Column<bool>(type: "boolean", nullable: false),
                    NumeroOP = table.Column<string>(type: "text", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Mantenimiento_Gastos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Gastos_Maquinas_MaquinaId",
                        column: x => x.MaquinaId,
                        principalTable: "Maquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Gastos_Mantenimiento_Proveedores_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Mantenimiento_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Mantenimiento_Gastos_Mantenimiento_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Mantenimiento_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Cotizaciones_ProveedorId",
                table: "Mantenimiento_Cotizaciones",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Cotizaciones_RubroId",
                table: "Mantenimiento_Cotizaciones",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_MaquinaId",
                table: "Mantenimiento_Gastos",
                column: "MaquinaId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_ProveedorId",
                table: "Mantenimiento_Gastos",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Gastos_RubroId",
                table: "Mantenimiento_Gastos",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_PresupuestosMensuales_RubroId_Anio_Mes",
                table: "Mantenimiento_PresupuestosMensuales",
                columns: new[] { "RubroId", "Anio", "Mes" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Mantenimiento_Proveedores_RubroId",
                table: "Mantenimiento_Proveedores",
                column: "RubroId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Mantenimiento_Cotizaciones");

            migrationBuilder.DropTable(
                name: "Mantenimiento_Gastos");

            migrationBuilder.DropTable(
                name: "Mantenimiento_PresupuestosMensuales");

            migrationBuilder.DropTable(
                name: "Mantenimiento_Proveedores");

            migrationBuilder.DropTable(
                name: "Mantenimiento_Rubros");
        }
    }
}
