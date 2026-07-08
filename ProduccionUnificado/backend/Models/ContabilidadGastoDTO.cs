using System;

namespace TiempoProcesos.API.Models
{
    public class ContabilidadGastoDTO
    {
        public int Id { get; set; }
        public string Modulo { get; set; } = string.Empty;
        // Backward compatibility for legacy frontend payloads.
        public string Area
        {
            get => Modulo;
            set => Modulo = value;
        }
        public string Rubro { get; set; } = string.Empty;
        public string? Proveedor { get; set; }
        /// <summary>Total del gasto (base + IVA en registros nuevos; histórico sin desglose conserva solo este valor).</summary>
        public decimal Precio { get; set; }
        public decimal? PrecioBase { get; set; }
        public decimal? PrecioIva { get; set; }
        public DateTime Fecha { get; set; }
        public string? Nota { get; set; }
        public string? NumeroFactura { get; set; }
        public string? NumeroOP { get; set; }
        public string? Referencia { get; set; }
        public decimal? Cantidad { get; set; }
        public bool EsPendiente { get; set; }
        public bool EsSolicitudCredito { get; set; }
        public bool EsEfectivo { get; set; }
        public string? FacturaPdfUrl { get; set; }
        public string? RegistradoPor { get; set; }
        public string? Maquina { get; set; }
        public string? Personal { get; set; }
        public string Estado { get; set; } = "Montado";
        public bool EsLabor { get; set; }
        public bool EsIngreso { get; set; }
    }
}
