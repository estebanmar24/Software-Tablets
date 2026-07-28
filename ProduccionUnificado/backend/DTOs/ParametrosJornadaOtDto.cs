namespace TiempoProcesos.API.DTOs;

public class ParametrosJornadaOtDiaDto
{
    public int DiaSemana { get; set; }
    public string? HoraInicio { get; set; }
    public string? HoraFin { get; set; }
    public bool DescuentaComida { get; set; }
    public int MinutosComida { get; set; }
}

public class ParametrosJornadaOtVersionDto
{
    public string VigenteDesde { get; set; } = "";
    public List<ParametrosJornadaOtDiaDto> Dias { get; set; } = new();
}

public class ParametrosJornadaOtSaveDto
{
    public string VigenteDesde { get; set; } = "";
    public List<ParametrosJornadaOtDiaDto> Dias { get; set; } = new();
}
