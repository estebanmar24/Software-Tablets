using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class PlaneacionDisenoBudgetUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
/*
            migrationBuilder.AddColumn<int>(
                name: "Desperdicio",
                table: "ProduccionDiariaDetalles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
*/

            migrationBuilder.CreateTable(
                name: "Diseno_Rubros",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_Rubros", x => x.Id);
                });

/*
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
                    Observaciones = table.Column<string>(type: "text", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncuestasCalidadProduccion", x => x.Id);
                });
*/

/*
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
*/

            migrationBuilder.CreateTable(
                name: "Planeacion_Rubros",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_Rubros", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Diseno_TiposServicio",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
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

/*
            migrationBuilder.CreateTable(
                name: "EncuestaCalidadProduccionProcesos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EncuestaId = table.Column<int>(type: "integer", nullable: false),
                    Proceso = table.Column<string>(type: "text", nullable: false),
                    CantidadProducida = table.Column<decimal>(type: "numeric", nullable: false)
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
*/

            migrationBuilder.CreateTable(
                name: "Planeacion_TiposServicio",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "Diseno_PresupuestosMensuales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Presupuesto = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_PresupuestosMensuales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diseno_PresupuestosMensuales_Diseno_TiposServicio_TipoServi~",
                        column: x => x.TipoServicioId,
                        principalTable: "Diseno_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Diseno_Proveedores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NitCedula = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Direccion = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Correo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_Proveedores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diseno_Proveedores_Diseno_TiposServicio_TipoServicioId",
                        column: x => x.TipoServicioId,
                        principalTable: "Diseno_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Planeacion_PresupuestosMensuales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Presupuesto = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_PresupuestosMensuales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Planeacion_PresupuestosMensuales_Planeacion_TiposServicio_T~",
                        column: x => x.TipoServicioId,
                        principalTable: "Planeacion_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Planeacion_Proveedores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NitCedula = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Telefono = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    PrecioCotizado = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_Proveedores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Planeacion_Proveedores_Planeacion_TiposServicio_TipoServici~",
                        column: x => x.TipoServicioId,
                        principalTable: "Planeacion_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Diseno_Cotizaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProveedorId = table.Column<int>(type: "integer", nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    PrecioCotizado = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FechaCotizacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    Diseno_ProveedorId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_Cotizaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diseno_Cotizaciones_Diseno_Proveedores_Diseno_ProveedorId",
                        column: x => x.Diseno_ProveedorId,
                        principalTable: "Diseno_Proveedores",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Diseno_Cotizaciones_Diseno_Proveedores_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Diseno_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Diseno_Cotizaciones_Diseno_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Diseno_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Diseno_Cotizaciones_Diseno_TiposServicio_TipoServicioId",
                        column: x => x.TipoServicioId,
                        principalTable: "Diseno_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Diseno_Gastos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProveedorId = table.Column<int>(type: "integer", nullable: true),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    NumeroFactura = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Precio = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Observaciones = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FacturaPdfUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaModificacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreadoPorId = table.Column<int>(type: "integer", nullable: true),
                    Diseno_ProveedorId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Diseno_Gastos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Diseno_Gastos_AdminUsuarios_CreadoPorId",
                        column: x => x.CreadoPorId,
                        principalTable: "AdminUsuarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Diseno_Gastos_Diseno_Proveedores_Diseno_ProveedorId",
                        column: x => x.Diseno_ProveedorId,
                        principalTable: "Diseno_Proveedores",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Diseno_Gastos_Diseno_Proveedores_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Diseno_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Diseno_Gastos_Diseno_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Diseno_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Diseno_Gastos_Diseno_TiposServicio_TipoServicioId",
                        column: x => x.TipoServicioId,
                        principalTable: "Diseno_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Planeacion_Cotizaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProveedorId = table.Column<int>(type: "integer", nullable: false),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    PrecioCotizado = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    FechaCotizacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Descripcion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_Cotizaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Planeacion_Cotizaciones_Planeacion_Proveedores_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Planeacion_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Planeacion_Cotizaciones_Planeacion_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Planeacion_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Planeacion_Cotizaciones_Planeacion_TiposServicio_TipoServic~",
                        column: x => x.TipoServicioId,
                        principalTable: "Planeacion_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Planeacion_Gastos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProveedorId = table.Column<int>(type: "integer", nullable: true),
                    RubroId = table.Column<int>(type: "integer", nullable: false),
                    TipoServicioId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    NumeroFactura = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Precio = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Observaciones = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FacturaPdfUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaModificacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreadoPorId = table.Column<int>(type: "integer", nullable: true),
                    Planeacion_ProveedorId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Planeacion_Gastos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Planeacion_Gastos_AdminUsuarios_CreadoPorId",
                        column: x => x.CreadoPorId,
                        principalTable: "AdminUsuarios",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Planeacion_Gastos_Planeacion_Proveedores_Planeacion_Proveed~",
                        column: x => x.Planeacion_ProveedorId,
                        principalTable: "Planeacion_Proveedores",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Planeacion_Gastos_Planeacion_Proveedores_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Planeacion_Proveedores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Planeacion_Gastos_Planeacion_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Planeacion_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Planeacion_Gastos_Planeacion_TiposServicio_TipoServicioId",
                        column: x => x.TipoServicioId,
                        principalTable: "Planeacion_TiposServicio",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_Diseno_ProveedorId",
                table: "Diseno_Cotizaciones",
                column: "Diseno_ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_ProveedorId",
                table: "Diseno_Cotizaciones",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_RubroId",
                table: "Diseno_Cotizaciones",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Cotizaciones_TipoServicioId",
                table: "Diseno_Cotizaciones",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_CreadoPorId",
                table: "Diseno_Gastos",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_Diseno_ProveedorId",
                table: "Diseno_Gastos",
                column: "Diseno_ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_ProveedorId",
                table: "Diseno_Gastos",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_RubroId",
                table: "Diseno_Gastos",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Gastos_TipoServicioId",
                table: "Diseno_Gastos",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_PresupuestosMensuales_TipoServicioId_Anio_Mes",
                table: "Diseno_PresupuestosMensuales",
                columns: new[] { "TipoServicioId", "Anio", "Mes" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_Proveedores_TipoServicioId",
                table: "Diseno_Proveedores",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Diseno_TiposServicio_RubroId",
                table: "Diseno_TiposServicio",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_EncuestaCalidadProduccionProcesos_EncuestaId",
                table: "EncuestaCalidadProduccionProcesos",
                column: "EncuestaId");

            migrationBuilder.CreateIndex(
                name: "IX_MetasMensuales_MaquinaId_Mes_Anio",
                table: "MetasMensuales",
                columns: new[] { "MaquinaId", "Mes", "Anio" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Cotizaciones_ProveedorId",
                table: "Planeacion_Cotizaciones",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Cotizaciones_RubroId",
                table: "Planeacion_Cotizaciones",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Cotizaciones_TipoServicioId",
                table: "Planeacion_Cotizaciones",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_CreadoPorId",
                table: "Planeacion_Gastos",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_Planeacion_ProveedorId",
                table: "Planeacion_Gastos",
                column: "Planeacion_ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_ProveedorId",
                table: "Planeacion_Gastos",
                column: "ProveedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_RubroId",
                table: "Planeacion_Gastos",
                column: "RubroId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Gastos_TipoServicioId",
                table: "Planeacion_Gastos",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_PresupuestosMensuales_TipoServicioId_Anio_Mes",
                table: "Planeacion_PresupuestosMensuales",
                columns: new[] { "TipoServicioId", "Anio", "Mes" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_Proveedores_TipoServicioId",
                table: "Planeacion_Proveedores",
                column: "TipoServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_Planeacion_TiposServicio_RubroId",
                table: "Planeacion_TiposServicio",
                column: "RubroId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Diseno_Cotizaciones");

            migrationBuilder.DropTable(
                name: "Diseno_Gastos");

            migrationBuilder.DropTable(
                name: "Diseno_PresupuestosMensuales");

            migrationBuilder.DropTable(
                name: "EncuestaCalidadProduccionProcesos");

            migrationBuilder.DropTable(
                name: "MetasMensuales");

            migrationBuilder.DropTable(
                name: "Planeacion_Cotizaciones");

            migrationBuilder.DropTable(
                name: "Planeacion_Gastos");

            migrationBuilder.DropTable(
                name: "Planeacion_PresupuestosMensuales");

            migrationBuilder.DropTable(
                name: "Diseno_Proveedores");

            migrationBuilder.DropTable(
                name: "EncuestasCalidadProduccion");

            migrationBuilder.DropTable(
                name: "Planeacion_Proveedores");

            migrationBuilder.DropTable(
                name: "Diseno_TiposServicio");

            migrationBuilder.DropTable(
                name: "Planeacion_TiposServicio");

            migrationBuilder.DropTable(
                name: "Diseno_Rubros");

            migrationBuilder.DropTable(
                name: "Planeacion_Rubros");

            migrationBuilder.DropColumn(
                name: "Desperdicio",
                table: "ProduccionDiariaDetalles");
        }
    }
}
