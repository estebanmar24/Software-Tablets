using System;

namespace TiempoProcesos.API.DTOs
{
    public class PlanAccionDto
    {
        public int Id { get; set; }
        public string Proceso { get; set; } = string.Empty;
        public string Hallazgo { get; set; } = string.Empty;
        public string CausaRaiz { get; set; } = string.Empty;
        public string AccionCorrectiva { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public DateTime FechaInicio { get; set; }
        public DateTime FechaCompromiso { get; set; }
        public string Estado { get; set; } = "Pendiente";
        public int PorcentajeAvance { get; set; }
        public List<PlanAccionEvidenciaDto> Evidencias { get; set; } = new();
        public string? Observaciones { get; set; }
        public DateTime FechaCreacion { get; set; }
        
        public int DiasRestantes => (FechaCompromiso.Date - DateTime.UtcNow.Date).Days;
        
        public string Semaforo 
        {
            get 
            {
                if (Estado == "cerrada") return "Verde";
                if (PorcentajeAvance >= 80 && DiasRestantes > 3) return "Verde";
                if (DiasRestantes <= 0) return "Rojo";
                if (DiasRestantes <= 3) return "Amarillo";
                return "Verde";
            }
        }
    }

    public class PlanAccionEvidenciaDto
    {
        public int Id { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileType { get; set; } = "Photo";
    }

    public class CreatePlanAccionDto
    {
        public string Proceso { get; set; } = string.Empty;
        public string Hallazgo { get; set; } = string.Empty;
        public string CausaRaiz { get; set; } = string.Empty;
        public string AccionCorrectiva { get; set; } = string.Empty;
        public string Responsable { get; set; } = string.Empty;
        public DateTime FechaInicio { get; set; }
        public DateTime FechaCompromiso { get; set; }
        public string Estado { get; set; } = "Pendiente";
        public int PorcentajeAvance { get; set; }
        public List<PlanAccionEvidenciaUploadDto> NuevasEvidencias { get; set; } = new();
        public string? Observaciones { get; set; }
    }

    public class PlanAccionEvidenciaUploadDto
    {
        public string FileName { get; set; } = string.Empty;
        public string Base64Data { get; set; } = string.Empty;
        public string FileType { get; set; } = "Photo"; // Photo or Pdf
    }
}
