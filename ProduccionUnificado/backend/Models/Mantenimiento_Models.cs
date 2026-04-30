using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace TiempoProcesos.API.Models
{
    public class Mantenimiento_Rubro
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;
        public bool Activo { get; set; } = true;
    }

    public class Mantenimiento_Proveedor
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string Nombre { get; set; } = string.Empty;
        public int? RubroId { get; set; }
        [ForeignKey("RubroId")]
        public Mantenimiento_Rubro? Rubro { get; set; }
        [MaxLength(50)]
        public string? Nit { get; set; }
        [MaxLength(50)]
        public string? Telefono { get; set; }
        [MaxLength(200)]
        public string? Direccion { get; set; }
        [MaxLength(100)]
        public string? Correo { get; set; }
        public bool Activo { get; set; } = true;
        public ICollection<Mantenimiento_Cotizacion>? Cotizaciones { get; set; }
    }

    public class Mantenimiento_Cotizacion
    {
        public int Id { get; set; }
        public int RubroId { get; set; }
        [ForeignKey("RubroId")]
        public Mantenimiento_Rubro? Rubro { get; set; }
        public int ProveedorId { get; set; }
        [ForeignKey("ProveedorId")]
        public Mantenimiento_Proveedor? Proveedor { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public decimal PrecioCotizado { get; set; }
        public string? Nota { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class Mantenimiento_Gasto
    {
        public int Id { get; set; }
        public int RubroId { get; set; }
        [ForeignKey("RubroId")]
        public Mantenimiento_Rubro? Rubro { get; set; }
        public int? ProveedorId { get; set; }
        [ForeignKey("ProveedorId")]
        public Mantenimiento_Proveedor? Proveedor { get; set; }
        public int? MaquinaId { get; set; }
        [ForeignKey("MaquinaId")]
        public virtual TiempoProcesos.API.Models.Maquina? Maquina { get; set; }

        [Column("productoid")]
        public int? ProductoId { get; set; }
        [ForeignKey("ProductoId")]
        public Mantenimiento_Producto? Producto { get; set; }
        [Column("cantidad")]
        public decimal? Cantidad { get; set; }

        public decimal Precio { get; set; }
        public DateTime Fecha { get; set; }
        public string? Nota { get; set; }
        public string? NumeroFactura { get; set; }
        public string? FacturaPdfUrl { get; set; }
        public bool EsPendiente { get; set; }
        public bool Activo { get; set; } = true;

        // Nuevos campos para mano de obra
        public decimal? CantidadHoras { get; set; }
        public string? HoraInicio { get; set; }
        public string? HoraFin { get; set; }
        public int? UsuarioId { get; set; }
        public int? TipoHoraId { get; set; }
        public int? TipoRecargoId { get; set; }
        public string? OtraMaquinaNombre { get; set; }
        
        public bool EsSolicitudCredito { get; set; } = false;
        public string? NumeroOP { get; set; }
        
        // Shadow properties for quick access
        public int Anio { get; set; }
        public int Mes { get; set; }
    }

    public class Mantenimiento_PresupuestoMensual
    {
        public int Id { get; set; }
        public int RubroId { get; set; }
        [ForeignKey("RubroId")]
        public Mantenimiento_Rubro? Rubro { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public decimal Presupuesto { get; set; }
    }

    public class Mantenimiento_TipoHora
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class Mantenimiento_TipoRecargo
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;
        public decimal Porcentaje { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class Mantenimiento_Producto
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [JsonPropertyName("rubroId")]
        public int RubroId { get; set; }

        [ForeignKey("RubroId")]
        public Mantenimiento_Rubro? Rubro { get; set; }

        [MaxLength(100)]
        [JsonPropertyName("referencia")]
        public string? Referencia { get; set; }
        
        [Column("descripcion")]
        [JsonPropertyName("descripcion")]
        public string? Descripcion { get; set; }
        
        [MaxLength(50)]
        [Column("medida")]
        [JsonPropertyName("medida")]
        public string? Medida { get; set; }
        
        [Column("puntoreorden")]
        [JsonPropertyName("puntoReorden")]
        public int PuntoReorden { get; set; } = 0;
        
        [Column("maxstock")]
        [JsonPropertyName("maxStock")]
        public int MaxStock { get; set; } = 0;
        
        [JsonPropertyName("activo")]
        public bool Activo { get; set; } = true;
    }
}
