using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Services;
using OfficeOpenXml;
using Microsoft.OpenApi.Models;
using Npgsql;
using System.IO;

var builder = WebApplication.CreateBuilder(args);
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

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
    x.RequireHttpsMetadata = true; // Forzar HTTPS en producción
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
});

builder.Services.AddAuthorization();

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
        
        // Manual schema fixes
        try { 
            context.Database.ExecuteSqlRaw("ALTER TABLE \"PlanesAccion\" ADD COLUMN IF NOT EXISTS \"TipoTrabajo\" VARCHAR(50) DEFAULT 'Nuevo' NOT NULL;"); 
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Usuarios\" ADD COLUMN IF NOT EXISTS \"Salario\" numeric NOT NULL DEFAULT 0;"); 
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Usuarios\" ADD COLUMN IF NOT EXISTS \"Documento\" text NOT NULL DEFAULT '';"); 
            context.Database.ExecuteSqlRaw("ALTER TABLE \"AdminUsuarios\" ADD COLUMN IF NOT EXISTS \"Permissions\" text NOT NULL DEFAULT '';");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"CantidadHoras\" numeric NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraFin\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"HoraInicio\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"OtraMaquinaNombre\" text NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"TipoHoraId\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"TipoRecargoId\" integer NULL;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"Mantenimiento_Gastos\" ADD COLUMN IF NOT EXISTS \"UsuarioId\" integer NULL;");
            
            // Performance Indexes for Produccion_Gastos
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_Produccion_Gastos_Anio_Mes\" ON \"Produccion_Gastos\" (\"Anio\", \"Mes\");");
            context.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS \"IX_Produccion_Gastos_RubroId\" ON \"Produccion_Gastos\" (\"RubroId\");");
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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// SPA Fallback: serve index.html for any non-API, non-file request
// This allows the React/Expo web app to handle client-side routing
app.MapFallback(async context =>
{
    var path = context.Request.Path.Value ?? "";
    // Don't intercept API routes, swagger, or uploads
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/uploads", StringComparison.OrdinalIgnoreCase))
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
