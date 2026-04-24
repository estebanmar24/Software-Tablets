using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace TiempoProcesos.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProductosToProduccion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EncuestasCalidadTalleres_Usuarios_UsuarioId",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.AddColumn<string>(
                name: "Area",
                table: "Usuarios",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Consecutivo",
                table: "Tickets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "Cantidad",
                table: "Produccion_Cotizaciones",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Medida",
                table: "Produccion_Cotizaciones",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductoId",
                table: "Produccion_Cotizaciones",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ValorUnitario",
                table: "Produccion_Cotizaciones",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoDesgasteImpresion",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoEsquinaDefectuosa",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoGrafadoRoto",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoInsumosPendientes",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoManchas",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoNovedadBPM",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoPresenciaPestanas",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoQuebradoArrugado",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoReservaPega",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoUsaCofia",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FotoVariacionTono",
                table: "EncuestasCalidadTalleres",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Cronogramas_Actividades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Operacion = table.Column<string>(type: "text", nullable: false),
                    Categoria = table.Column<string>(type: "text", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cronogramas_Actividades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HojasVidaMaquinas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NumeroInventario = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Marca = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Serie = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Modelo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    FechaCompra = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    VidaUtil = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FotoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EppsYRiesgos = table.Column<string>(type: "text", nullable: true),
                    Senalizacion = table.Column<string>(type: "text", nullable: true),
                    RiesgosAsociados = table.Column<string>(type: "text", nullable: true),
                    Activo = table.Column<bool>(type: "boolean", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CodigoFormato = table.Column<string>(type: "text", nullable: false),
                    VersionFormato = table.Column<string>(type: "text", nullable: false),
                    Proceso = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Ubicacion = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Voltaje = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Corriente = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Potencia = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Dimensiones = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Peso = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    OtroTecnico = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HojasVidaMaquinas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Produccion_Productos",
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
                    table.PrimaryKey("PK_Produccion_Productos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Produccion_Productos_Produccion_Rubros_RubroId",
                        column: x => x.RubroId,
                        principalTable: "Produccion_Rubros",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BitacorasMaquinas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HojaVidaId = table.Column<int>(type: "integer", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Turno = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Descripcion = table.Column<string>(type: "text", nullable: false),
                    EstadoMaquina = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RegistradoPor = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BitacorasMaquinas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BitacorasMaquinas_HojasVidaMaquinas_HojaVidaId",
                        column: x => x.HojaVidaId,
                        principalTable: "HojasVidaMaquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Cronogramas_Registros",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HojaVidaId = table.Column<int>(type: "integer", nullable: false),
                    ActividadId = table.Column<int>(type: "integer", nullable: false),
                    Anio = table.Column<int>(type: "integer", nullable: false),
                    Mes = table.Column<int>(type: "integer", nullable: false),
                    Estado = table.Column<int>(type: "integer", nullable: false),
                    Nota = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cronogramas_Registros", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cronogramas_Registros_Cronogramas_Actividades_ActividadId",
                        column: x => x.ActividadId,
                        principalTable: "Cronogramas_Actividades",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Cronogramas_Registros_HojasVidaMaquinas_HojaVidaId",
                        column: x => x.HojaVidaId,
                        principalTable: "HojasVidaMaquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HojaVidaFotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HojaVidaId = table.Column<int>(type: "integer", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HojaVidaFotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HojaVidaFotos_HojasVidaMaquinas_HojaVidaId",
                        column: x => x.HojaVidaId,
                        principalTable: "HojasVidaMaquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MantenimientosHojaVida",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HojaVidaId = table.Column<int>(type: "integer", nullable: false),
                    TipoMantenimiento = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EjecutadoPor = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Observacion = table.Column<string>(type: "text", nullable: true),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Consecutivo = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: true),
                    TipoPersonal = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MantenimientosHojaVida", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MantenimientosHojaVida_HojasVidaMaquinas_HojaVidaId",
                        column: x => x.HojaVidaId,
                        principalTable: "HojasVidaMaquinas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MantenimientoFotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MantenimientoId = table.Column<int>(type: "integer", nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MantenimientoFotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MantenimientoFotos_MantenimientosHojaVida_MantenimientoId",
                        column: x => x.MantenimientoId,
                        principalTable: "MantenimientosHojaVida",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Produccion_Cotizaciones_ProductoId",
                table: "Produccion_Cotizaciones",
                column: "ProductoId");

            migrationBuilder.CreateIndex(
                name: "IX_BitacorasMaquinas_HojaVidaId",
                table: "BitacorasMaquinas",
                column: "HojaVidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Cronogramas_Registros_ActividadId",
                table: "Cronogramas_Registros",
                column: "ActividadId");

            migrationBuilder.CreateIndex(
                name: "IX_Cronogramas_Registros_HojaVidaId",
                table: "Cronogramas_Registros",
                column: "HojaVidaId");

            migrationBuilder.CreateIndex(
                name: "IX_HojaVidaFotos_HojaVidaId",
                table: "HojaVidaFotos",
                column: "HojaVidaId");

            migrationBuilder.CreateIndex(
                name: "IX_MantenimientoFotos_MantenimientoId",
                table: "MantenimientoFotos",
                column: "MantenimientoId");

            migrationBuilder.CreateIndex(
                name: "IX_MantenimientosHojaVida_HojaVidaId",
                table: "MantenimientosHojaVida",
                column: "HojaVidaId");

            migrationBuilder.CreateIndex(
                name: "IX_Produccion_Productos_RubroId",
                table: "Produccion_Productos",
                column: "RubroId");

            migrationBuilder.AddForeignKey(
                name: "FK_EncuestasCalidadTalleres_AdminUsuarios_UsuarioId",
                table: "EncuestasCalidadTalleres",
                column: "UsuarioId",
                principalTable: "AdminUsuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Produccion_Cotizaciones_Produccion_Productos_ProductoId",
                table: "Produccion_Cotizaciones",
                column: "ProductoId",
                principalTable: "Produccion_Productos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EncuestasCalidadTalleres_AdminUsuarios_UsuarioId",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropForeignKey(
                name: "FK_Produccion_Cotizaciones_Produccion_Productos_ProductoId",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropTable(
                name: "BitacorasMaquinas");

            migrationBuilder.DropTable(
                name: "Cronogramas_Registros");

            migrationBuilder.DropTable(
                name: "HojaVidaFotos");

            migrationBuilder.DropTable(
                name: "MantenimientoFotos");

            migrationBuilder.DropTable(
                name: "Produccion_Productos");

            migrationBuilder.DropTable(
                name: "Cronogramas_Actividades");

            migrationBuilder.DropTable(
                name: "MantenimientosHojaVida");

            migrationBuilder.DropTable(
                name: "HojasVidaMaquinas");

            migrationBuilder.DropIndex(
                name: "IX_Produccion_Cotizaciones_ProductoId",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "Area",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "Consecutivo",
                table: "Tickets");

            migrationBuilder.DropColumn(
                name: "Cantidad",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "Medida",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "ProductoId",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "ValorUnitario",
                table: "Produccion_Cotizaciones");

            migrationBuilder.DropColumn(
                name: "FotoDesgasteImpresion",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoEsquinaDefectuosa",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoGrafadoRoto",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoInsumosPendientes",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoManchas",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoNovedadBPM",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoPresenciaPestanas",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoQuebradoArrugado",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoReservaPega",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoUsaCofia",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.DropColumn(
                name: "FotoVariacionTono",
                table: "EncuestasCalidadTalleres");

            migrationBuilder.AddForeignKey(
                name: "FK_EncuestasCalidadTalleres_Usuarios_UsuarioId",
                table: "EncuestasCalidadTalleres",
                column: "UsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
