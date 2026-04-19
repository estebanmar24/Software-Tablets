using Microsoft.AspNetCore.Http;

namespace TiempoProcesos.API.DTOs
{
    public class FileUploadDto
    {
        public IFormFile File { get; set; } = null!;
    }

    public class ArchivoUploadDto
    {
        public IFormFile Archivo { get; set; } = null!;
    }

    public class ExcelImportDto
    {
        public IFormFile File { get; set; } = null!;
        public int? MaquinaId { get; set; }
    }
}
