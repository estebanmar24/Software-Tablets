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

// Global exception handler
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[UNHANDLED EXCEPTION] {ex.GetType().Name}: {ex.Message}");
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            // No enviar el mensaje real del error al cliente en producción
            await context.Response.WriteAsync("{\"error\": \"Un error interno ha ocurrido en el servidor.\"}");
        }
    }
});

ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

// Initialize Database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        
        // Manual schema fixes for Action Plans
        try { 
            context.Database.ExecuteSqlRaw("DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlanesAccion' AND column_name='tipotrabajo') THEN ALTER TABLE \"PlanesAccion\" RENAME COLUMN \"tipotrabajo\" TO \"TipoTrabajo\"; END IF; END $$;");
            context.Database.ExecuteSqlRaw("ALTER TABLE \"PlanesAccion\" ADD COLUMN IF NOT EXISTS \"TipoTrabajo\" VARCHAR(50) DEFAULT 'Nuevo' NOT NULL;"); 
        } catch (Exception ex) { Console.WriteLine($"[DB FIX] Error fixing PlanesAccion: {ex.Message}"); }
        
        try { context.Database.ExecuteSqlRaw("ALTER TABLE \"Talleres_Personal\" ADD COLUMN IF NOT EXISTS \"HorarioId\" integer NULL REFERENCES \"Horarios\"(\"Id\");"); } catch {}

        
        try {
            context.Database.ExecuteSqlRaw("ALTER TABLE \"EncuestasCalidadTalleres\" DROP CONSTRAINT IF EXISTS \"FK_EncuestasCalidadTalleres_Usuarios_UsuarioId\";");
            context.Database.ExecuteSqlRaw("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='FK_EncuestasCalidadTalleres_AdminUsuarios_UsuarioId') THEN ALTER TABLE \"EncuestasCalidadTalleres\" ADD CONSTRAINT \"FK_EncuestasCalidadTalleres_AdminUsuarios_UsuarioId\" FOREIGN KEY (\"UsuarioId\") REFERENCES \"AdminUsuarios\"(\"Id\"); END IF; END $$;");
        } catch (Exception ex) { Console.WriteLine($"[DB FIX] Error fixing EncuestasCalidadTalleres FK: {ex.Message}"); }

        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[CRITICAL ERROR] Database initialization failed: {ex.Message}");
    }
}

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
