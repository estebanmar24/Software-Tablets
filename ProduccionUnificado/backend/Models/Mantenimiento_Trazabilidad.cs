using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TiempoProcesos.API.Models;

public class Mantenimiento_Trazabilidad
{
    public int Id { get; set; }

    /// <summary>Área del módulo: Maquinaria, Gastos, Inventario, Consumos, Catálogo.</summary>
    [Required]
    [MaxLength(50)]
    public string Modulo { get; set; } = string.Empty;

    /// <summary>Tipo de registro: Gasto, HojaVida, Consumo, Producto, etc.</summary>
    [Required]
    [MaxLength(80)]
    public string Entidad { get; set; } = string.Empty;

    /// <summary>Crear, Actualizar, Eliminar, Ajuste, Recalcular, etc.</summary>
    [Required]
    [MaxLength(50)]
    public string Accion { get; set; } = string.Empty;

    public int? EntidadId { get; set; }

    [Required]
    [MaxLength(500)]
    public string Descripcion { get; set; } = string.Empty;

    public string? DetalleJson { get; set; }

    public int? UsuarioId { get; set; }

    [ForeignKey("UsuarioId")]
    public AdminUsuario? Usuario { get; set; }

    [MaxLength(150)]
    public string? UsuarioNombre { get; set; }

    public DateTime Fecha { get; set; }

    /// <summary>True si el registro proviene de backfill de datos existentes.</summary>
    public bool EsHistorico { get; set; }
}
