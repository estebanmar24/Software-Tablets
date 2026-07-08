using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Helpers;
using TiempoProcesos.API.Services;
using OfficeOpenXml;
using Microsoft.OpenApi.Models;
using Npgsql;
using System.IO;
using Microsoft.Extensions.FileProviders;
using TiempoProcesos.API.Helpers;

var builder = WebApplication.CreateBuilder(args);
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 104_857_600; // 100 MB — encuestas con varias fotos en base64
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(10);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(10);
});

builder.Services.AddRequestTimeouts(options =>
{
    options.DefaultPolicy = new Microsoft.AspNetCore.Http.Timeouts.RequestTimeoutPolicy
    {
        Timeout = TimeSpan.FromMinutes(10)
    };
});

// Force a stable HTTP binding for reverse proxies (Cloudflare tunnel/Nginx),
// while still allowing explicit override via ASPNETCORE_URLS.
var configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS")
    ?? builder.Configuration["Urls"]
    ?? "http://0.0.0.0:5144";
builder.WebHost.UseUrls(configuredUrls);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options => {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "TiempoProcesos API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header
            },
            new List<string>()
        }
    });
});

// Configure DB Context
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register Services
builder.Services.AddScoped<ITiempoProcesoService, TiempoProcesoService>();
builder.Services.AddScoped<AlephEmailService>();
builder.Services.AddScoped<AdjuntosExtractionService>();
builder.Services.AddScoped<AlmacenService>();
builder.Services.AddScoped<AlmacenEmailService>();
builder.Services.Configure<TiempoProcesos.API.Options.HikvisionOptions>(
    builder.Configuration.GetSection(TiempoProcesos.API.Options.HikvisionOptions.SectionName));
builder.Services.AddHttpClient();
builder.Services.AddScoped<HikvisionCameraService>();

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var keyString = jwtSettings["Key"] ?? "AlephImpresores_Tablets_Produccion_SecretKey_2026_Secure";
var key = Encoding.ASCII.GetBytes(keyString);

builder.Services.AddAuthentication(x =>
{
    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(x =>
{
    // TLS termina en Cloudflare/nginx; hacia Kestrel suele ser HTTP. true rompe descubrimiento/metadata en algunos despliegues.
    x.RequireHttpsMetadata = false;
    x.SaveToken = true;
    x.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidIssuer = jwtSettings["Issuer"] ?? "http://localhost:5144",
        ValidAudience = jwtSettings["Audience"] ?? "http://localhost:5144",
        ClockSkew = TimeSpan.Zero
    };
    x.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            if (string.IsNullOrEmpty(context.Token) &&
                context.Request.Query.TryGetValue("access_token", out var accessToken))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// Detrás de Cloudflare/nginx: X-Forwarded-Proto / For para que Request.Scheme sea https y JWT no falle.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

var app = builder.Build();

try
{
    OrdenAseoPhotoStorage.MigrateLegacyFiles(app.Environment);
}
catch (Exception ex)
{
    Console.WriteLine($"[STARTUP] OrdenAseo photo migration: {ex.Message}");
}

app.UseForwardedHeaders();

ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

// Initialize Database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        Console.WriteLine("[STARTUP] Getting DbContext...");
        var context = services.GetRequiredService<AppDbContext>();
        Console.WriteLine("[STARTUP] DbContext acquired.");

        // Primero: columnas que EF exige en GET de gastos; cada ALTER aislado (el bloque siguiente es un solo try).
        try
        {
            StartupSchemaPatches.ApplyCriticalGastosColumns(context);
            StartupSchemaPatches.ApplyProveedorRubrosTables(context);
            StartupSchemaPatches.ApplyConsolidadoNCColumns(context);
            StartupSchemaPatches.ApplyHorarioSabado6a10(context);
            StartupSchemaPatches.ApplyHorario1pm9pm(context);
            StartupSchemaPatches.ApplyAdjuntoDocumentoExtraccionTable(context);
            StartupSchemaPatches.ApplyCatalogoOrdenProduccionTable(context);
            StartupSchemaPatches.ApplyMantenimientoConsumosTable(context);
            StartupSchemaPatches.ApplyMantenimientoConsumosExtraColumns(context);
            StartupSchemaPatches.ApplyMantenimientoAjustesInventarioTable(context);
            StartupSchemaPatches.ApplyAlmacenTables(context);
            StartupSchemaPatches.ApplyMantenimientoTrazabilidadTable(context);
            StartupSchemaPatches.ApplyBitacoraMantenimientoDiariaTable(context);
            StartupSchemaPatches.ApplyRegistroDesperdicioRegistradoPorColumn(context);
            StartupSchemaPatches.BackfillGastosAnioMesDesdeFecha(context);
            MantenimientoTrazabilidadHelper.BackfillSiVacioAsync(context).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[STARTUP ERROR] ApplyCriticalGastosColumns: {ex.Message}");
        }

        // Manual schema fixes
        try { 
            Console.WriteLine("[STARTUP] Applying manual fix: PlanesAccion.TipoTrabajo...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"PlanesAccion\" ADD COLUMN IF NOT EXISTS \"TipoTrabajo\" VARCHAR(50) DEFAULT 'Nuevo' NOT NULL;"); 
            
            Console.WriteLine("[STARTUP] Applying manual fix: Usuarios.Salario...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Usuarios\" ADD COLUMN IF NOT EXISTS \"Salario\" numeric NOT NULL DEFAULT 0;"); 
            
            Console.WriteLine("[STARTUP] Applying manual fix: Usuarios.Documento...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Usuarios\" ADD COLUMN IF NOT EXISTS \"Documento\" text NOT NULL DEFAULT '';"); 
            
            Console.WriteLine("[STARTUP] Applying manual fix: AdminUsuarios.Permissions...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"AdminUsuarios\" ADD COLUMN IF NOT EXISTS \"Permissions\" text NOT NULL DEFAULT '';");
            
            Console.WriteLine("[STARTUP] Applying manual fix: Mantenimiento_Gastos (lowercase columns)...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"cantidadhoras\" numeric NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"horafin\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"horainicio\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"otramaquinanombre\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"tipohoraid\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"tiporecargoid\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"usuarioid\" integer NULL;");

            Console.WriteLine("[STARTUP] Applying manual fix: Mantenimiento_Gastos (Capitalized columns)...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"CantidadHoras\" numeric NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraFin\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraInicio\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"OtraMaquinaNombre\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"TipoHoraId\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"TipoRecargoId\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"UsuarioId\" integer NULL;");
            
            Console.WriteLine("[STARTUP] Applying manual fix: Mantenimiento_Productos...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"descripcion\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"medida\" varchar(50) NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"puntoreorden\" integer NOT NULL DEFAULT 0;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"maxstock\" integer NOT NULL DEFAULT 0;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"stock\" numeric(18,2) NOT NULL DEFAULT 0;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"tipoproducto\" character varying(100) NULL;");
            
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"Descripcion\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"Medida\" varchar(50) NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"PuntoReorden\" integer NOT NULL DEFAULT 0;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Productos\" ADD COLUMN IF NOT EXISTS \"MaxStock\" integer NOT NULL DEFAULT 0;");
            
            Console.WriteLine("[STARTUP] Applying manual fix: Mantenimiento_Gastos (inventory fields)...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"productoid\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"cantidad\" numeric NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"ProductoId\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"Cantidad\" numeric NULL;");

            Console.WriteLine("[STARTUP] Applying manual fix: Indexes...");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_Produccion_Gastos_Anio_Mes\" ON \"Produccion_Gastos\" (\"Anio\", \"Mes\");");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_Produccion_Gastos_RubroId\" ON \"Produccion_Gastos\" (\"RubroId\");");

            Console.WriteLine("[STARTUP] Applying manual fix: TiempoProcesos subcodigos...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"TiempoProcesos\" ADD COLUMN IF NOT EXISTS \"SubCodigoActividad\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"TiempoProcesos\" ADD COLUMN IF NOT EXISTS \"SubCodigoDetalle\" text NULL;");

            Console.WriteLine("[STARTUP] Applying manual fix: TiempoProcesos pausa/estado...");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"TiempoProcesos\" ADD COLUMN IF NOT EXISTS \"Estado\" character varying(20) NOT NULL DEFAULT 'Finalizado';");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"TiempoProcesos\" ADD COLUMN IF NOT EXISTS \"PausadoEn\" timestamp without time zone NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"TiempoProcesos\" ADD COLUMN IF NOT EXISTS \"TiempoPausadoSegundos\" bigint NOT NULL DEFAULT 0;");
            // Migrar registros antiguos "en progreso" detectados por horaInicio == horaFin → Estado='EnProgreso'.
            context.Database.ExecuteSqlRaw("UPDATE \"TiempoProcesos\" SET \"Estado\" = 'EnProgreso' WHERE \"Estado\" = 'Finalizado' AND \"HoraInicio\" = \"HoraFin\";");

            // Fix: si algún PausadoEn quedó guardado en UTC (versiones anteriores), lo ajustamos
            // a hora local del servidor para que coincida con HoraInicio/HoraFin.
            // Detectamos los "futuro local" (PausadoEn > ahora local) y les aplicamos el offset
            // entre LOCALTIMESTAMP y CURRENT_TIMESTAMP at UTC para convertirlos a local.
            context.Database.ExecuteSqlRaw(@"
                UPDATE ""TiempoProcesos""
                SET ""PausadoEn"" = ""PausadoEn"" + (LOCALTIMESTAMP - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
                WHERE ""PausadoEn"" IS NOT NULL
                  AND ""PausadoEn"" > (LOCALTIMESTAMP + INTERVAL '30 minutes');
            ");

            Console.WriteLine("[STARTUP] Applying manual fix: Contabilidad_Ingresos...");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Contabilidad_Ingresos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""MotivoIngreso"" VARCHAR(300) NOT NULL,
                    ""Cantidad"" numeric(18,2) NOT NULL DEFAULT 0,
                    ""Fecha"" timestamp without time zone NOT NULL,
                    ""PdfUrl"" VARCHAR(500) NULL,
                    ""CreadoEn"" timestamp without time zone NOT NULL DEFAULT NOW()
                );
            ");
            Console.WriteLine("[STARTUP] Applying manual fix: Contabilidad_Gastos...");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Contabilidad_Gastos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Rubro"" VARCHAR(200) NOT NULL,
                    ""Proveedor"" VARCHAR(200) NOT NULL,
                    ""NumeroFactura"" VARCHAR(100) NULL,
                    ""Precio"" numeric(18,2) NOT NULL DEFAULT 0,
                    ""PrecioBase"" numeric(18,2) NULL,
                    ""PrecioIva"" numeric(18,2) NULL,
                    ""Fecha"" timestamp without time zone NOT NULL,
                    ""Observaciones"" VARCHAR(2000) NULL,
                    ""FacturaPdfUrl"" VARCHAR(500) NULL,
                    ""EsPendiente"" boolean NOT NULL DEFAULT false,
                    ""EsSolicitudCredito"" boolean NOT NULL DEFAULT false,
                    ""EsEfectivo"" boolean NOT NULL DEFAULT false,
                    ""Estado"" VARCHAR(50) NOT NULL DEFAULT 'Montado',
                    ""Anio"" integer NOT NULL,
                    ""Mes"" integer NOT NULL,
                    ""CreadoPorId"" integer NULL,
                    ""FechaCreacion"" timestamp without time zone NOT NULL DEFAULT NOW(),
                    ""FechaModificacion"" timestamp without time zone NULL
                );
            ");
            Console.WriteLine("[STARTUP] Applying manual fix: EvaluacionArea_Actividades...");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""EvaluacionArea_Actividades"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Area"" VARCHAR(100) NOT NULL,
                    ""Titulo"" VARCHAR(500) NOT NULL,
                    ""Descripcion"" VARCHAR(2000) NULL,
                    ""Estado"" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                    ""RazonNoCumplimiento"" VARCHAR(2000) NULL,
                    ""Anio"" integer NOT NULL,
                    ""Mes"" integer NOT NULL,
                    ""CreadoPorId"" integer NULL,
                    ""CreadoPorNombre"" VARCHAR(200) NULL,
                    ""FechaCreacion"" timestamp without time zone NOT NULL DEFAULT NOW(),
                    ""FechaModificacion"" timestamp without time zone NULL,
                    ""FechaCumplimiento"" timestamp without time zone NULL
                );
            ");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_EvaluacionArea_Area_Anio_Mes\" ON \"EvaluacionArea_Actividades\" (\"Area\", \"Anio\", \"Mes\");");

            Console.WriteLine("[STARTUP] Applying manual fix: Audit_Checklist_Items / Responsables...");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Audit_Checklist_Items"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Tipo"" VARCHAR(10) NOT NULL DEFAULT 'CTPAT',
                    ""Titulo"" VARCHAR(500) NOT NULL,
                    ""Descripcion"" VARCHAR(4000) NULL,
                    ""Estado"" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                    ""RazonNoCompletada"" VARCHAR(2000) NULL,
                    ""Anio"" integer NOT NULL,
                    ""Mes"" integer NOT NULL,
                    ""CreadoPorId"" integer NULL,
                    ""CreadoPorNombre"" VARCHAR(200) NULL,
                    ""FechaCreacion"" timestamp without time zone NOT NULL DEFAULT NOW(),
                    ""FechaModificacion"" timestamp without time zone NULL,
                    ""FechaCierre"" timestamp without time zone NULL,
                    ""CerradaPorNombre"" VARCHAR(200) NULL
                );
            ");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Audit_Checklist_Responsables"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""ChecklistId"" integer NOT NULL REFERENCES ""Audit_Checklist_Items""(""Id"") ON DELETE CASCADE,
                    ""UsuarioId"" integer NULL,
                    ""UsuarioNombre"" VARCHAR(200) NULL,
                    ""UsuarioEmail"" VARCHAR(200) NULL,
                    ""NotificadoEn"" timestamp without time zone NULL
                );
            ");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_AuditChecklist_Tipo_Anio_Mes\" ON \"Audit_Checklist_Items\" (\"Tipo\", \"Anio\", \"Mes\");");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_AuditChecklist_Resp_Checklist\" ON \"Audit_Checklist_Responsables\" (\"ChecklistId\");");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Audit_Checklist_Items\" ADD COLUMN IF NOT EXISTS \"NumeroActividad\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Audit_Checklist_Items\" ALTER COLUMN \"Tipo\" TYPE VARCHAR(50);");
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""Audit_Checklist_Tipos"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""Codigo"" VARCHAR(20) NOT NULL DEFAULT '',
                    ""Nombre"" VARCHAR(200) NOT NULL,
                    ""Descripcion"" VARCHAR(2000) NULL,
                    ""Anio"" integer NOT NULL,
                    ""CreadoPorNombre"" VARCHAR(200) NULL,
                    ""FechaCreacion"" timestamp without time zone NOT NULL DEFAULT NOW()
                );
            ");
            context.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_AuditChecklistTipo_Codigo_Anio\" ON \"Audit_Checklist_Tipos\" (\"Codigo\", \"Anio\");");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"EncuestaNovedades\" ADD COLUMN IF NOT EXISTS \"InformeObservaciones\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"EncuestaNovedades\" ADD COLUMN IF NOT EXISTS \"InformeEstado\" varchar(50) NULL;");

            Console.WriteLine("[STARTUP] Manual fixes completed.");
        } catch (Exception ex) { Console.WriteLine($"[DB FIX] Error applying manual fixes: {ex.Message}"); }

        try {
            Console.WriteLine("[STARTUP] Initializing Database via DbInitializer...");
            DbInitializer.Initialize(context);
            Console.WriteLine("[STARTUP] DbInitializer finished.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL ERROR] Database initialization failed: {ex.Message}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[STARTUP ERROR] Fatal error during startup: {ex.Message}");
    }
}

app.UseDeveloperExceptionPage();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "TiempoProcesos API v1"));
}

app.UseCors("AllowAll");
app.UseStaticFiles();

var adjuntosRoot = AdjuntosOpStorage.GetAdjuntosRoot(app.Environment);
Console.WriteLine($"[STARTUP] Carpeta Adjuntos: {adjuntosRoot}");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(adjuntosRoot),
    RequestPath = "/adjuntos",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        // PDF en iframe dentro de la app de operarios
        if (ctx.File.Name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            ctx.Context.Response.Headers.Append("Content-Disposition", "inline");
    }
});

var ordenAseoUploadDir = OrdenAseoPhotoStorage.GetPersistentDir(app.Environment);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(ordenAseoUploadDir),
    RequestPath = "/evidencias-ordenaseo",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache");
    }
});

app.UseRequestTimeouts();
app.UseAuthentication();
app.UseAuthorization();

// Sin BD: útil para comprobar que Kestrel responde (nginx/Cloudflare 502 si el upstream está caído).
app.MapGet("/api/healthz", () => Results.Json(new { status = "ok", utc = DateTime.UtcNow }))
    .WithName("Healthz")
    .AllowAnonymous();

app.MapControllers();

// SPA Fallback: serve index.html for any non-API, non-file request
// This allows the React/Expo web app to handle client-side routing
app.MapFallback(async context =>
{
    var path = context.Request.Path.Value ?? "";
    // Don't intercept API routes, swagger, or uploads
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/uploads", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/adjuntos", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/pdfjs", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/evidencias-ordenaseo", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = 404;
        return;
    }
    
    var indexPath = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("Frontend not built. Run 'npx expo export --platform web' and copy dist/ to wwwroot/");
    }
});

app.Run();
