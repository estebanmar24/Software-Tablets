using Microsoft.EntityFrameworkCore;
using TiempoProcesos.API.Data;
using TiempoProcesos.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Entity Framework with SQL Server
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register services
builder.Services.AddScoped<ITiempoProcesoService, TiempoProcesoService>();

// Configure CORS for React Native
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

// Apply migrations automatically in development
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // Inicialización robusta de la base de datos
        DbInitializer.Initialize(db);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[STARTUP WARNING] Database initialization failed: {ex.Message}");
        Console.WriteLine($"[STARTUP WARNING] Inner: {ex.InnerException?.Message}");
        Console.WriteLine("[STARTUP] Continuing without database initialization...");
    }
}

app.Run();
