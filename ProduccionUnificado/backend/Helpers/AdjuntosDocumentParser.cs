using System.Globalization;

using System.Text.Json;

using System.Text.RegularExpressions;

using TiempoProcesos.API.DTOs;



namespace TiempoProcesos.API.Helpers;



public static class AdjuntosDocumentParser

{

    private static readonly JsonSerializerOptions JsonOpts = new()

    {

        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,

        WriteIndented = false

    };



    private static readonly string[] MesesAbrev =

        ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];



    /// <summary>Devuelve solo los campos de negocio solicitados para OP o Ficha.</summary>

    public static Dictionary<string, string> ParseCampos(string texto, string tipo, string numero)

    {

        if (string.IsNullOrWhiteSpace(texto))

            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);



        if (tipo.Equals("OP", StringComparison.OrdinalIgnoreCase))
            return ResumenOp(texto, numero);
        if (tipo.Equals("LineaTroquel", StringComparison.OrdinalIgnoreCase))
            return ResumenLineaTroquel(texto);
        return ResumenFicha(texto);

    }

    private static Dictionary<string, string> ResumenLineaTroquel(string texto)
    {
        var res = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var t = texto.Trim();
        if (string.IsNullOrEmpty(t))
            return res;
        res["vistaPrevia"] = t.Length > 500 ? t[..500] + "…" : t;
        return res;
    }



    public static bool FichaNecesitaOcr(string textoPdf)

    {

        var resumen = ResumenFicha(textoPdf);

        var llenos = resumen.Count(kv => !string.IsNullOrWhiteSpace(kv.Value));

        return llenos < 2;

    }



    public static string ToJson(Dictionary<string, string> campos) =>

        JsonSerializer.Serialize(campos, JsonOpts);



    private static Dictionary<string, string> ResumenOp(string texto, string numero)
    {
        var raw = ParseLabelValueLines(texto);
        var res = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        AsignarSiValido(res, "fechaApertura",
            Primero(
                Extraer(texto, @"Fecha\s+Apertura\s+[_\s]*([^\n]+)"),
                raw.GetValueOrDefault("fecha apertura")),
            transform: LimpiarFechaApertura);

        AsignarSiValido(res, "fechaDespacho",
            Primero(
                Extraer(texto, @"Fecha\s+de\s+despacho\s+([\d\s]+[\-][a-z]{3}\.?[\-][\d\.]+)"),
                Extraer(texto, @"Fecha\s+de\s+despacho\s+([^\n]+)"),
                raw.GetValueOrDefault("fecha de despacho")),
            transform: FormatearFechaDespacho);

        var cliente = Primero(
            Extraer(texto, @"(?m)(?:Cl[eé]nte|Cliente)\s+(.+?)(?=\s+NIT|\s+NI[TÍ]/CC|\s+Direcci|\n)"),
            Extraer(texto, @"(?m)^\s*CLIENTE\s*:?\s*([^\n]+?)(?=\s+NIT|\s+Direcci|\n)"),
            raw.GetValueOrDefault("cliente"));
        if (!string.IsNullOrWhiteSpace(cliente) && !Regex.IsMatch(cliente, @"^\d+$"))
            res["cliente"] = Limpiar(cliente);

        AsignarSiValido(res, "nit",
            Primero(
                Extraer(texto, @"NIT/?CC\s+(\d[\d\-]+)"),
                Extraer(texto, @"NIT/?CC\s*:?\s*(\d[\d\-]+)")));

        AsignarSiValido(res, "direccion",
            Primero(
                Extraer(texto, @"Direccion\s+(.+?)\s+Fecha\s+de\s+despacho"),
                Extraer(texto, @"Direcci[oó]n\s+(.+?)\s+Fecha\s+de\s+despacho")));

        var trabajo = LimpiarTrabajo(Primero(
            Extraer(texto, @"Trabajo\s+(.+?)(?=\s*Ctd|\s*Codigo\s+Troquel|\n)"),
            raw.GetValueOrDefault("trabajo")));
        if (!string.IsNullOrWhiteSpace(trabajo))
            res["trabajo"] = trabajo;

        AsignarSiValido(res, "ctdAProducir",
            Primero(
                Extraer(texto, @"Ctd\s+a\s*produ[cz]ir\s+([\d\.\,]+)"),
                Extraer(texto, @"Ctd\s*a\s*produ[cz]ir\s+([\d\.\,]+)"),
                Extraer(texto, @"Ctdaproducir\s+([\d\.\,]+)"),
                Extraer(texto, @"produ[cz]ir\s+([\d\.\,]+)\s+Codigo\s+Troquel"),
                raw.GetValueOrDefault("ctd a producir")),
            transform: FormatearCantidad);

        AsignarSiValido(res, "compraCliente",
            Primero(
                Extraer(texto, @"O\.?\s*compra\s*Cliente\s+(\d+)"),
                Extraer(texto, @"(?:O\.?\s*)?compra\s*Cliente\s+(\d+)"),
                raw.GetValueOrDefault("o. compra cliente")));

        AsignarSiValido(res, "codigoTroquel",
            Primero(
                Extraer(texto, @"Codigo\s+Troquel\s+([A-Z0-9\-]+)"),
                Extraer(texto, @"Código\s+Troquel\s+([A-Z0-9\-]+)"),
                raw.GetValueOrDefault("codigo troquel")));

        ParseOpPiezas(texto, res);

        if (string.IsNullOrWhiteSpace(GetCampoDict(res, "pieza")))
        {
            AsignarSiValido(res, "pieza",
                Primero(
                    Extraer(texto, @"Pieza:\s*(.+?)(?:\n|$)"),
                    raw.GetValueOrDefault("pieza")));
        }

        if (!string.IsNullOrWhiteSpace(numero))
            res["numeroOp"] = numero;

        return FiltrarVacios(res);
    }

    private static string GetCampoDict(Dictionary<string, string> campos, string key)
    {
        foreach (var kv in campos)
            if (string.Equals(kv.Key, key, StringComparison.OrdinalIgnoreCase))
                return kv.Value?.Trim() ?? "";
        return "";
    }

    private static void ParseOpMaterial(string texto, Dictionary<string, string> res)
    {
        // OCR Aleph: "- CARTULINA ZENITHCA 16 270 GRANCH - 70,00 58,50 ... 35 x 58"
        // Preferir fila con calibre + gramaje entre nombre y medidas.
        var conSpecs = Regex.Match(
            texto,
            @"((?:CARTULINA|[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9./&\-\s]{2,70}?))\s+(\d{1,3})\s+(\d{2,4})\s*(?:GR(?:AMOS?|ANCH|S)?\.?|G/?M2?|G)?\s*[-–]?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s*x\s*([\d.,]+)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        if (conSpecs.Success)
        {
            var nombre = LimpiarMaterialNombre(conSpecs.Groups[1].Value);
            if (!string.IsNullOrWhiteSpace(nombre))
                res["material"] = nombre;
            res["calibre"] = conSpecs.Groups[2].Value.Trim();
            res["gramaje"] = conSpecs.Groups[3].Value.Trim();
            AsignarSiValido(res, "anchoRollo", conSpecs.Groups[4].Value.Trim());
            AsignarSiValido(res, "largoCorte", conSpecs.Groups[5].Value.Trim());
            AsignarSiValido(res, "anchoPliego", conSpecs.Groups[6].Value.Trim());
            AsignarSiValido(res, "altoPliego", conSpecs.Groups[7].Value.Trim());
            AsignarSiValido(res, "hojas", FormatearCantidad(conSpecs.Groups[8].Value.Trim()));
            res["cb"] = conSpecs.Groups[9].Value.Trim();
            AsignarSiValido(res, "tamanoFinal",
                $"{conSpecs.Groups[10].Value.Trim()} x {conSpecs.Groups[11].Value.Trim()}");
            return;
        }

        var patronFila = Regex.Match(
            texto,
            @"CARTULINA[^\n]{5,120}?\s+[-–]?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s*x\s*([\d.,]+)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        if (!patronFila.Success)
        {
            patronFila = Regex.Match(
                texto,
                @"[-–]?\s*([A-Za-z0-9][^\n\-–]{8,90}?)\s+[-–]?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s*x\s*([\d.,]+)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (patronFila.Success)
            {
                var nombreRaw = LimpiarMaterialNombre(patronFila.Groups[1].Value);
                AsignarMaterialConSpecs(res, nombreRaw);
                AsignarSiValido(res, "anchoRollo", patronFila.Groups[2].Value.Trim());
                AsignarSiValido(res, "largoCorte", patronFila.Groups[3].Value.Trim());
                AsignarSiValido(res, "anchoPliego", patronFila.Groups[4].Value.Trim());
                AsignarSiValido(res, "altoPliego", patronFila.Groups[5].Value.Trim());
                AsignarSiValido(res, "hojas", FormatearCantidad(patronFila.Groups[6].Value.Trim()));
                AsignarSiValido(res, "cb", patronFila.Groups[7].Value.Trim());
                AsignarSiValido(res, "tamanoFinal",
                    $"{patronFila.Groups[8].Value.Trim()} x {patronFila.Groups[9].Value.Trim()}");
            }
            return;
        }

        var nombreM = Regex.Match(texto, @"CARTULINA[^\n]+?(?=\s+[-–]\s*[\d])", RegexOptions.IgnoreCase);
        if (nombreM.Success)
            AsignarMaterialConSpecs(res, LimpiarMaterialNombre(nombreM.Value));
        else
        {
            var alt = Regex.Match(texto, @"CARTULINA[^\n]{3,80}", RegexOptions.IgnoreCase);
            if (alt.Success)
                AsignarMaterialConSpecs(res, LimpiarMaterialNombre(alt.Value));
        }

        AsignarSiValido(res, "anchoRollo", patronFila.Groups[1].Value.Trim());
        AsignarSiValido(res, "largoCorte", patronFila.Groups[2].Value.Trim());
        AsignarSiValido(res, "anchoPliego", patronFila.Groups[3].Value.Trim());
        AsignarSiValido(res, "altoPliego", patronFila.Groups[4].Value.Trim());
        AsignarSiValido(res, "hojas", FormatearCantidad(patronFila.Groups[5].Value.Trim()));
        if (!string.IsNullOrWhiteSpace(patronFila.Groups[6].Value))
            res["cb"] = patronFila.Groups[6].Value.Trim();
        AsignarSiValido(res, "tamanoFinal",
            $"{patronFila.Groups[7].Value.Trim()} x {patronFila.Groups[8].Value.Trim()}");
    }

    /// <summary>
    /// Separa nombre limpio + calibre/gramaje (ej. "CARTULINA ZENITHCA 16 270 GRANCH").
    /// </summary>
    private static void AsignarMaterialConSpecs(Dictionary<string, string> res, string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return;
        var nombre = raw.Trim();
        var specs = Regex.Match(
            nombre,
            @"\s+(\d{1,3})\s+(\d{2,4})\s*(?:GR(?:AMOS?|ANCH|S)?\.?|G/?M2?|G)?\s*$",
            RegexOptions.IgnoreCase);
        if (specs.Success)
        {
            if (!res.ContainsKey("calibre"))
                res["calibre"] = specs.Groups[1].Value.Trim();
            if (!res.ContainsKey("gramaje"))
                res["gramaje"] = specs.Groups[2].Value.Trim();
            nombre = nombre[..specs.Index].Trim();
        }
        // Evitar AsignarSiValido: rechaza valores que empiezan por CARTULINA
        if (!string.IsNullOrWhiteSpace(nombre))
            res["material"] = LimpiarMaterialNombre(nombre);
    }

    private static string LimpiarMaterialNombre(string raw)
    {
        var s = Limpiar(raw);
        s = Regex.Replace(s, @"^[-–]\s*", "");
        s = Regex.Replace(s, @"\s+[-–]\s*$", "");
        // Quitar restos OCR de unidad de gramaje pegados al final
        s = Regex.Replace(s, @"\s+(?:GR(?:AMOS?|ANCH|S)?\.?|G/?M2?)\s*$", "", RegexOptions.IgnoreCase);
        return s.Trim();
    }

    private static readonly Regex RxCantidadOp = new(
        @"^\s*([\d]{1,4}(?:\.\d{3})*,\d{2})\s*$",
        RegexOptions.Compiled);

    private static readonly Regex RxCantidadAlFinal = new(
        @"([\d]{1,4}(?:\.\d{3})*,\d{2})\s*$",
        RegexOptions.Compiled);

    /// <summary>Código Aleph: 01a, 04, 8A, 10a (no un dígito suelto tipo "2 codigos").</summary>
    private static readonly Regex RxCodigoProceso = new(
        @"^((?:\d{2}[A-Za-z]?)|(?:\d[A-Za-z]))\s+(.+)$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex RxNombreMaquinaProceso = new(
        @"^((?:\d{2}[A-Za-z]?)|(?:\d[A-Za-z]))\s+(
            Convertidora|
            Guillotina(?:\s+[A-Za-z0-9]+)?|
            Sordz?\s*\d*|
            SpeedMaster(?:\s*\d*)?|
            Colaminadora|
            Troqueladora(?:\s+(?:de\s+)?(?:Papel|Rollo))?|
            Laminadora(?:\s+[A-Za-z0-9]+)?|
            Barnizadora(?:\s+[A-Za-z0-9]+)?|
            Pegadora|
            Cortadora(?:\s+[A-Za-z0-9]+)?|
            Estampadora|
            Corrugadora(?:\s+[A-Za-z0-9]+)?
        )\b\s*(.*)$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.IgnorePatternWhitespace);

    private static void ParseOpProcesos(string texto, Dictionary<string, string> res)
    {
        var cortarPagina2 = !Regex.IsMatch(texto, @"(?m)^\s*Pieza:\s*", RegexOptions.IgnoreCase)
            || Regex.Matches(texto, @"(?m)^\s*Pieza:\s*", RegexOptions.IgnoreCase).Count < 2;
        var filas = ParseOpProcesosFilas(texto, cortarEnPagina2: cortarPagina2);
        if (filas.Count == 0) return;

        res["cantidadProcesos"] = filas.Count.ToString();
        res["procesosDetalle"] = SerializeProcesosDetalle(filas);
    }

    private static string SerializeProcesosDetalle(List<(string Proceso, string Notas, string Cantidad)> filas) =>
        string.Join("\n", filas.Select(f => $"{f.Proceso} | {f.Notas} | {f.Cantidad}"));

    private static List<(string Proceso, string Notas, string Cantidad)> ParseOpProcesosFilas(
        string texto,
        bool cortarEnPagina2 = true,
        int? sectionStart = null,
        int? sectionEnd = null)
    {
        var start = Regex.Match(texto, @"Proceso\s+Notas\s+Cantidad", RegexOptions.IgnoreCase);
        if (!start.Success) return new();

        var from = sectionStart.HasValue ? Math.Max(start.Index, sectionStart.Value) : start.Index;
        var to = sectionEnd ?? texto.Length;
        if (from >= to) return new();

        var section = texto[from..to];
        if (sectionStart.HasValue && sectionStart.Value > start.Index)
        {
            var localStart = Regex.Match(section, @"Proceso\s+Notas\s+Cantidad", RegexOptions.IgnoreCase);
            if (localStart.Success)
                section = section[localStart.Index..];
        }

        if (cortarEnPagina2)
        {
            var end = Regex.Match(section,
                @"ESTE\s+ES\s+UN\s+DOCUMENTO|TIEMPOS\s+MAQUINA|SALIDA\s+DE\s+INSUMOS|P[aá]gina\s+2\s+de",
                RegexOptions.IgnoreCase);
            if (end.Success)
                section = section[..end.Index];
        }
        else
        {
            var end = Regex.Match(section,
                @"ESTE\s+ES\s+UN\s+DOCUMENTO|TIEMPOS\s+MAQUINA|SALIDA\s+DE\s+INSUMOS",
                RegexOptions.IgnoreCase);
            if (end.Success)
                section = section[..end.Index];
        }

        var filas = new List<(string Proceso, string Notas, string Cantidad)>();
        string? pendProceso = null;
        var pendNotas = new List<string>();

        void FlushPendiente(string cantidad)
        {
            if (pendProceso == null && pendNotas.Count == 0) return;
            var proceso = pendProceso ?? "Notas / otros";
            var notas = string.Join(" ", pendNotas).Trim();
            if (string.IsNullOrWhiteSpace(notas)) notas = "—";
            filas.Add((proceso, Limpiar(notas), cantidad));
            pendProceso = null;
            pendNotas.Clear();
        }

        foreach (var rawLine in section.Split('\n'))
        {
            var line = Limpiar(rawLine);
            if (line.Length < 1) continue;
            if (line.Contains("Proceso Notas", StringComparison.OrdinalIgnoreCase)) continue;
            if (Regex.IsMatch(line, @"^(Material|AnchoRollo|AnchoPlieg|AltoPliego|Hojas|CB|Tama[nñ]o)\b", RegexOptions.IgnoreCase))
                continue;
            if (line is "LINEAL" or "COLOR") continue;

            // Solo cantidad → cierra la fila pendiente (caso Convertidora con qty en línea aparte)
            var soloCant = RxCantidadOp.Match(line);
            if (soloCant.Success)
            {
                FlushPendiente(soloCant.Groups[1].Value);
                continue;
            }

            var cantFinal = RxCantidadAlFinal.Match(line);
            var cuerpo = cantFinal.Success ? line[..cantFinal.Index].Trim() : line;
            var cantidad = cantFinal.Success ? cantFinal.Groups[1].Value : null;

            if (RxCodigoProceso.IsMatch(cuerpo))
            {
                // Nueva fila de proceso: cerrar la anterior si quedó abierta (sin qty)
                if (pendProceso != null || pendNotas.Count > 0)
                    FlushPendiente("0,00");

                if (!TrySplitProcesoNotas(cuerpo, out var proceso, out var notas))
                {
                    var m = RxCodigoProceso.Match(cuerpo);
                    proceso = $"{m.Groups[1].Value} {m.Groups[2].Value}".Trim();
                    notas = "";
                }

                if (cantidad != null)
                {
                    if (string.IsNullOrWhiteSpace(notas)) notas = "—";
                    filas.Add((proceso, Limpiar(notas), cantidad));
                    pendProceso = null;
                    pendNotas.Clear();
                }
                else
                {
                    pendProceso = proceso;
                    pendNotas.Clear();
                    if (!string.IsNullOrWhiteSpace(notas) && notas != "—")
                        pendNotas.Add(notas);
                }
                continue;
            }

            // Continuación de notas o fila solo-notas con cantidad
            if (cantidad != null)
            {
                if (pendProceso != null || pendNotas.Count > 0)
                {
                    if (!string.IsNullOrWhiteSpace(cuerpo))
                        pendNotas.Add(cuerpo);
                    FlushPendiente(cantidad);
                }
                else if (!string.IsNullOrWhiteSpace(cuerpo) && !IsMaterialSpecDataLine(cuerpo))
                {
                    filas.Add(("Notas / otros", Limpiar(cuerpo), cantidad));
                }
                continue;
            }

            if (IsMaterialSpecDataLine(cuerpo))
                continue;

            if (!string.IsNullOrWhiteSpace(cuerpo)
                && (pendProceso != null || pendNotas.Count > 0 || filas.Count > 0))
            {
                if (pendProceso == null && pendNotas.Count == 0)
                    pendProceso = null;
                pendNotas.Add(cuerpo);
            }
        }

        if (pendProceso != null || pendNotas.Count > 0)
            FlushPendiente("0,00");

        return filas;
    }

    private static bool TrySplitProcesoNotas(string antesCant, out string proceso, out string notas)
    {
        proceso = "";
        notas = "";
        if (string.IsNullOrWhiteSpace(antesCant)) return false;

        var named = RxNombreMaquinaProceso.Match(antesCant);
        if (named.Success)
        {
            proceso = $"{named.Groups[1].Value} {named.Groups[2].Value}".Trim();
            notas = named.Groups[3].Value?.Trim() ?? "";
            return true;
        }

        // Fallback: código + hasta 3 tokens de nombre de máquina
        var fallback = Regex.Match(
            antesCant,
            @"^((?:\d{2}[A-Za-z]?)|(?:\d[A-Za-z]))\s+(\S+(?:\s+\S+){0,2})(?:\s+(.+))?$",
            RegexOptions.IgnoreCase);
        if (!fallback.Success) return false;

        proceso = $"{fallback.Groups[1].Value} {fallback.Groups[2].Value}".Trim();
        notas = fallback.Groups.Count > 3 ? (fallback.Groups[3].Value?.Trim() ?? "") : "";
        return true;
    }



    private static Dictionary<string, string> ResumenFicha(string texto)
    {
        var res = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var ocr = ObtenerSeccionOcr(texto);

        ParseFichaCamposLineaOcr(ocr, res);
        TryParseFichaBloqueCompacto(ocr, res);
        TryParseFichaBloqueCompacto(texto, res);

        if (!res.ContainsKey("fechaCreacion"))
        {
            var fc = Extraer(texto, @"Fecha de creaci\w*n:\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})");
            AsignarSiValido(res, "fechaCreacion", fc, esFecha: true);
        }

        if (!res.ContainsKey("fechaModificacion"))
        {
            var fm = Extraer(texto, @"Fecha\s+Modific\.?\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})");
            AsignarSiValido(res, "fechaModificacion", fm, esFecha: true);
        }

        return FiltrarVacios(res);
    }

    private static string ObtenerSeccionOcr(string texto)
    {
        var idx = texto.LastIndexOf("--- OCR ---", StringComparison.OrdinalIgnoreCase);
        return idx >= 0 ? texto[(idx + 11)..].Trim() : texto;
    }

    private static void ParseFichaCamposLineaOcr(string ocr, Dictionary<string, string> res)
    {
        if (string.IsNullOrWhiteSpace(ocr)) return;

        AsignarSiValido(res, "fechaCreacion",
            Extraer(ocr, @"Fecha de creaci\w*n:\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})"), esFecha: true);

        AsignarSiValido(res, "fechaModificacion",
            Extraer(ocr, @"Fecha\s+Modific\.?\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})"), esFecha: true);

        AsignarSiValido(res, "cliente", Extraer(ocr, @"Cliente:\s*([^\n]+)"));
        AsignarSiValido(res, "ejecCuenta", Extraer(ocr, @"Ejec\.?\s*de\s*cuenta:\s*([^\n]+)"));
        AsignarSiValido(res, "lineaProducto",
            Extraer(ocr, @"(?:L[ií]nea|inea)\s+de\s+Producto:\s*([^\n]+)"));
        AsignarSiValido(res, "nombreProductoReferencia",
            Extraer(ocr, @"Nombre del producto y ref(?:erencia)?:\s*([^\n]+)"));
        AsignarSiValido(res, "pieza",
            Extraer(ocr, @"Pieza:\s*([^\n]+?)(?:\s*Sustrato|\s*Medidas|\n\n|$)"));

        // Cantidad Tinta N (OCR: "Cantidad Tinta 2 e .:1 .:' Especiales: ...")
        // No usar AsignarSiValido: valores de 1 dígito se rechazan como "basura".
        var tintaMatch = Regex.Match(ocr,
            @"Cantidad\s+Tinta\s*[:=]?\s*(\d+)",
            RegexOptions.IgnoreCase);
        if (tintaMatch.Success && !res.ContainsKey("cantidadTinta"))
            res["cantidadTinta"] = tintaMatch.Groups[1].Value;

        // Especiales / colores asociados a las tintas
        AsignarSiValido(res, "colores",
            Primero(
                Extraer(ocr, @"Especiales\s*:\s*([^\n]+)"),
                Extraer(ocr, @"TINTAS\s*:\s*[-–]?\s*([^\n]+)"),
                Extraer(ocr, @"(?m)^Color\s*\n\s*([^\n]+)")));

        AsignarSiValido(res, "sustrato",
            Primero(
                Extraer(ocr, @"Sustrato\s+Sup\s*-\s*Cal/g\s*:\s*([^\n]+)"),
                Extraer(ocr, @"MATERIAL\s*:\s*([^\n]+)")));

        // Calibre / gramaje desde ficha (Cal/g : 16/270 o embebido en sustrato)
        if (!res.ContainsKey("calibre") || !res.ContainsKey("gramaje"))
        {
            var calG = Regex.Match(ocr,
                @"Cal/g\s*:\s*[^\n]*?(\d{1,3})\s*[/\s]\s*(\d{2,4})",
                RegexOptions.IgnoreCase);
            if (!calG.Success && res.TryGetValue("sustrato", out var sustRaw))
            {
                calG = Regex.Match(sustRaw,
                    @"(\d{1,3})\s*[/\s]\s*(\d{2,4})\s*(?:GR(?:AMOS?|ANCH|S)?\.?|G/?M2?|G)?\s*$",
                    RegexOptions.IgnoreCase);
            }
            if (calG.Success)
            {
                if (!res.ContainsKey("calibre")) res["calibre"] = calG.Groups[1].Value;
                if (!res.ContainsKey("gramaje")) res["gramaje"] = calG.Groups[2].Value;
            }
        }

        // Hint de tipo de trabajo (Nuevo / Repetición)
        if (Regex.IsMatch(ocr, @"Troquel\s+nuevo|NUEVO\s+TINTAS|\[\s*[JxX]?\s*\]?\s*Troquel\s+nuevo", RegexOptions.IgnoreCase))
            AsignarSiValido(res, "tipoTrabajoHint", "Nuevo");
        else if (Regex.IsMatch(ocr, @"[Rr]epetici[oó]n\s+con\s+cambios", RegexOptions.IgnoreCase))
            AsignarSiValido(res, "tipoTrabajoHint", "Repetición con cambios");
        else if (Regex.IsMatch(ocr, @"[Rr]epetici[oó]n", RegexOptions.IgnoreCase))
            AsignarSiValido(res, "tipoTrabajoHint", "Repetición");
    }

    private static void TryParseFichaBloqueCompacto(string texto, Dictionary<string, string> res)
    {
        var m = Regex.Match(
            texto,
            @"Fecha de creaci\w*n:\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})\s+Fecha Modific\.?\s*Cliente:\s*(.+?)\s+Ejec\.?\s*de\s*cuenta:\s*(.+?)\s+(?:L[ií]nea|inea)\s+de\s+Producto:\s*(.+?)\s+Nombre del producto y ref(?:erencia)?:\s*(.+?)\s+Pieza:\s*([^\n]+)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (!m.Success) return;

        AsignarSiValido(res, "fechaCreacion", m.Groups[1].Value, esFecha: true);
        AsignarSiValido(res, "cliente", m.Groups[2].Value);
        AsignarSiValido(res, "ejecCuenta", m.Groups[3].Value);
        AsignarSiValido(res, "lineaProducto", m.Groups[4].Value);
        AsignarSiValido(res, "nombreProductoReferencia", m.Groups[5].Value);
        AsignarSiValido(res, "pieza", m.Groups[6].Value);
    }

    private static void AsignarSiValido(
        Dictionary<string, string> res,
        string key,
        string? valor,
        bool esFecha = false,
        Func<string, string>? transform = null)
    {
        if (string.IsNullOrWhiteSpace(valor) || res.ContainsKey(key)) return;
        valor = transform != null ? transform(Limpiar(valor)) : Limpiar(valor);
        if (EsEtiquetaSinValor(valor) || EsLineaBasuraFicha(valor)) return;
        if (esFecha)
        {
            valor = NormalizarFecha(valor);
            if (!EsFechaPlausible(valor)) return;
        }
        res[key] = valor;
    }



    private static Dictionary<string, string> FiltrarVacios(Dictionary<string, string> d) =>

        d.Where(kv => !string.IsNullOrWhiteSpace(kv.Value))

            .ToDictionary(kv => kv.Key, kv => kv.Value.Trim(), StringComparer.OrdinalIgnoreCase);



    private static string? Primero(params string?[] valores)

    {

        foreach (var v in valores)

        {

            if (!string.IsNullOrWhiteSpace(v))

                return v.Trim();

        }

        return null;

    }



    private static string? Extraer(string texto, string pattern)

    {

        var m = Regex.Match(texto, pattern, RegexOptions.IgnoreCase | RegexOptions.Multiline);

        return m.Success && m.Groups.Count > 1 ? m.Groups[1].Value.Trim() : null;

    }



    private static string? SiguienteLineaDespuesDe(string texto, string etiqueta)

    {

        var lines = texto.Replace("\r", "").Split('\n');

        for (var i = 0; i < lines.Length - 1; i++)

        {

            var line = lines[i].Trim();

            if (!line.StartsWith(etiqueta, StringComparison.OrdinalIgnoreCase))

                continue;



            var afterColon = Regex.Match(line, @"^[^:]+:\s*(.+)$");

            if (afterColon.Success && !string.IsNullOrWhiteSpace(afterColon.Groups[1].Value))

                return afterColon.Groups[1].Value.Trim();



            var next = lines[i + 1].Trim();

            if (next.Length > 1 && !next.EndsWith(':') && !EsEtiquetaSinValor(next)
                && !EsLineaBasuraFicha(next) && !next.Contains("---"))

                return next;

        }

        return null;

    }



    private static string LimpiarTrabajo(string? trabajo)

    {

        if (string.IsNullOrWhiteSpace(trabajo)) return "";

        trabajo = Regex.Replace(trabajo, @"\s+0[.,]\s*compra\s*Cliente\s*\d+.*$", "", RegexOptions.IgnoreCase).Trim();

        trabajo = Regex.Replace(trabajo, @"\s*O\.?\s*compra\s*Cliente\s*\d+.*$", "", RegexOptions.IgnoreCase).Trim();

        trabajo = Regex.Replace(trabajo, @"\s+\d{3,6}$", "").Trim();

        return Limpiar(trabajo);

    }



    private static string LimpiarFechaApertura(string raw)

    {

        raw = Regex.Replace(raw, @"^[_\s]+", "").Trim();

        if (raw.Length > 0)

            raw = char.ToUpper(raw[0]) + raw[1..];

        return raw;

    }



    private static string FormatearFechaDespacho(string raw)

    {

        if (string.IsNullOrWhiteSpace(raw)) return "";

        raw = Regex.Replace(raw.Trim(), @"\s+", "");



        var m = Regex.Match(raw, @"(\d{1,2})[\-\.]([a-záéíóúñ]{3})\.?[\-\.]?(\d{2,4})", RegexOptions.IgnoreCase);

        if (!m.Success)

            return raw;



        var dia = m.Groups[1].Value.PadLeft(2, '0');

        var mesTxt = m.Groups[2].Value.ToLowerInvariant()

            .Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u");

        var anio = m.Groups[3].Value;

        if (anio.Length == 2)

            anio = "20" + anio;



        var mesNum = Array.FindIndex(MesesAbrev, x => mesTxt.StartsWith(x, StringComparison.OrdinalIgnoreCase)) + 1;

        if (mesNum > 0)

            return $"{dia}/{mesNum:D2}/{anio}";



        return $"{dia}-{mesTxt}-{anio}";

    }



    private static string FormatearCantidad(string raw)

    {

        raw = raw.Trim();

        if (raw.Contains('.') && raw.IndexOf('.') < raw.Length - 4)

            return raw.Replace(".", "");

        return raw;

    }



    private static string Limpiar(string s) =>

        Regex.Replace(s.Trim(), @"\s+", " ");



    private static bool EsFechaPlausible(string s)

    {

        if (string.IsNullOrWhiteSpace(s)) return false;

        if (s.EndsWith(':')) return false;

        return Regex.IsMatch(s, @"^\d{1,2}/\d{1,2}/\d{2,4}$")

            || Regex.IsMatch(s, @"^\d{4}-\d{2}-\d{2}$");

    }



    private static string NormalizarFecha(string s)

    {

        s = s.Trim().TrimStart('/', '.');

        return Regex.Replace(s, @"^/+", "");

    }



    private static bool EsLineaBasuraFicha(string s)

    {

        var t = s.Trim().ToUpperInvariant();

        if (t.Length < 2) return true;

        if (Regex.IsMatch(t, @"^CARTULINA\b")) return true;

        if (Regex.IsMatch(t, @"^(SUST|N/A|TROQUEL|REVISADO|COLOR|ES)$")) return true;

        if (t.Contains("FICHA TÉCNICA") || t.Contains("FICHA TECNICA")) return true;

        return false;

    }



    private static bool EsEtiquetaSinValor(string s)

    {

        var t = s.Trim().ToLowerInvariant();

        if (t.EndsWith(':')) return true;

        if (t.Contains("ocr")) return true;

        return t is "pie de imprenta" or "tipo de manija" or "tipo de flauta" or "troquel nuevo";

    }



    private static Dictionary<string, string> ParseLabelValueLines(string texto)

    {

        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(texto)) return result;



        var lines = texto.Replace("\r", "").Split('\n');

        string? pendingKey = null;



        foreach (var raw in lines)

        {

            var line = raw.Trim();

            if (line.Length == 0) continue;



            var m = Regex.Match(line, @"^(.{2,80}?):\s*(.*)$");

            if (m.Success)

            {

                pendingKey = NormalizarClave(m.Groups[1].Value);

                var val = m.Groups[2].Value.Trim();

                if (!string.IsNullOrEmpty(pendingKey))

                {

                    if (string.IsNullOrEmpty(val) && !result.ContainsKey(pendingKey))

                        result[pendingKey] = "";

                    else if (!string.IsNullOrEmpty(val))

                        AgregarCampo(result, pendingKey, val);

                }

                continue;

            }



            if (pendingKey != null && string.IsNullOrEmpty(result.GetValueOrDefault(pendingKey)))

            {

                AgregarCampo(result, pendingKey, line);

                pendingKey = null;

            }

        }



        return result;

    }



    private static void AgregarCampo(Dictionary<string, string> dict, string key, string value)

    {

        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(value)) return;

        if (dict.TryGetValue(key, out var prev) && !string.IsNullOrWhiteSpace(prev))

            dict[key] = prev + " | " + value;

        else

            dict[key] = value.Trim();

    }



    private static string NormalizarClave(string key)

    {

        var k = key.Trim().ToLowerInvariant();

        return Regex.Replace(k, @"\s+", " ");

    }

    private static bool IsMaterialSpecDataLine(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return false;
        if (RxCodigoProceso.IsMatch(line)) return false;
        if (Regex.IsMatch(line, @"^(Material|AnchoRollo|AnchoPlieg|AltoPliego|Hojas|CB|Tama[nñ]o)\b", RegexOptions.IgnoreCase))
            return true;
        if (Regex.IsMatch(line, @"\d+[.,]\d+\s+\d+[.,]\d+.*\d+\s*x\s*[\d.,]+", RegexOptions.IgnoreCase))
            return true;
        return Regex.IsMatch(line, @"(?:FLAUTA|CARTULINA|PAPEL|BOPP|LINNER|MICRO\s+CORRUG)", RegexOptions.IgnoreCase)
            && Regex.Matches(line, @"\d+[.,]\d+").Count >= 2;
    }

    private static void ParseOpMaterialInto(string texto, Dictionary<string, string> res) =>
        ParseOpMaterial(texto, res);

    private static void ParseOpPiezas(string texto, Dictionary<string, string> res)
    {
        var piezaRx = new Regex(@"(?m)^\s*Pieza:\s*(.+?)\s*$", RegexOptions.IgnoreCase);
        var matches = piezaRx.Matches(texto);

        if (matches.Count >= 2)
        {
            var piezas = new List<OpPiezaDto>();
            for (var i = 0; i < matches.Count; i++)
            {
                var start = matches[i].Index;
                var end = i + 1 < matches.Count ? matches[i + 1].Index : texto.Length;
                var section = texto[start..end];
                var nombre = Limpiar(matches[i].Groups[1].Value);
                var mat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                ParseOpMaterialInto(section, mat);
                var filas = ParseOpProcesosFilas(section, cortarEnPagina2: false);
                piezas.Add(BuildPiezaDto(i + 1, nombre, mat, filas));
            }

            ApplyPiezasToResumen(res, piezas);
            return;
        }

        ParseOpMaterial(texto, res);
        var cortarPagina2 = matches.Count < 2;
        var filasLegacy = ParseOpProcesosFilas(texto, cortarEnPagina2: cortarPagina2);
        if (filasLegacy.Count > 0)
        {
            res["cantidadProcesos"] = filasLegacy.Count.ToString();
            res["procesosDetalle"] = SerializeProcesosDetalle(filasLegacy);
        }

        if (matches.Count == 1)
        {
            var nombre = Limpiar(matches[0].Groups[1].Value);
            res["pieza"] = nombre;
            res["cantidadPiezas"] = "1";
            res["piezasJson"] = JsonSerializer.Serialize(new List<OpPiezaDto>
            {
                BuildPiezaDto(1, nombre, CopyMaterialFromRes(res), filasLegacy)
            }, JsonOpts);
        }
    }

    private static Dictionary<string, string> CopyMaterialFromRes(Dictionary<string, string> res)
    {
        var mat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in new[] { "material", "calibre", "gramaje", "anchoRollo", "largoCorte", "anchoPliego", "altoPliego", "hojas", "cb", "tamanoFinal" })
        {
            var v = GetCampoDict(res, key);
            if (!string.IsNullOrWhiteSpace(v))
                mat[key] = v;
        }
        return mat;
    }

    private static string? ExtractCodigoOp(string proceso)
    {
        var m = RxCodigoProceso.Match(proceso?.Trim() ?? "");
        return m.Success ? m.Groups[1].Value.ToLowerInvariant() : null;
    }

    private static OpPiezaDto BuildPiezaDto(
        int id,
        string nombre,
        Dictionary<string, string> mat,
        List<(string Proceso, string Notas, string Cantidad)> filas)
    {
        var material = new OpPiezaMaterialDto
        {
            Material = GetCampoDict(mat, "material"),
            Calibre = GetCampoDict(mat, "calibre"),
            Gramaje = GetCampoDict(mat, "gramaje"),
            AnchoRollo = GetCampoDict(mat, "anchoRollo"),
            LargoCorte = GetCampoDict(mat, "largoCorte"),
            AnchoPliego = GetCampoDict(mat, "anchoPliego"),
            AltoPliego = GetCampoDict(mat, "altoPliego"),
            Hojas = GetCampoDict(mat, "hojas"),
            Cabidad = GetCampoDict(mat, "cb"),
            TamanoFinal = GetCampoDict(mat, "tamanoFinal"),
        };

        var procesos = filas
            .Where(f => !string.Equals(f.Proceso, "Notas / otros", StringComparison.OrdinalIgnoreCase))
            .Select(f => new OpPiezaProcesoDto
            {
                Proceso = f.Proceso,
                Notas = f.Notas,
                Cantidad = f.Cantidad,
                CodigoOp = ExtractCodigoOp(f.Proceso),
            })
            .ToList();

        return new OpPiezaDto
        {
            Id = id,
            Nombre = nombre,
            Material = material,
            Procesos = procesos,
        };
    }

    private static void ApplyPiezasToResumen(Dictionary<string, string> res, List<OpPiezaDto> piezas)
    {
        if (piezas.Count == 0) return;

        res["cantidadPiezas"] = piezas.Count.ToString();
        res["piezasJson"] = JsonSerializer.Serialize(piezas, JsonOpts);

        var p1 = piezas[0];
        res["pieza"] = p1.Nombre ?? "";

        if (p1.Material != null)
        {
            if (!string.IsNullOrWhiteSpace(p1.Material.Material)) res["material"] = p1.Material.Material!;
            if (!string.IsNullOrWhiteSpace(p1.Material.Calibre)) res["calibre"] = p1.Material.Calibre!;
            if (!string.IsNullOrWhiteSpace(p1.Material.Gramaje)) res["gramaje"] = p1.Material.Gramaje!;
            if (!string.IsNullOrWhiteSpace(p1.Material.AnchoRollo)) res["anchoRollo"] = p1.Material.AnchoRollo!;
            if (!string.IsNullOrWhiteSpace(p1.Material.LargoCorte)) res["largoCorte"] = p1.Material.LargoCorte!;
            if (!string.IsNullOrWhiteSpace(p1.Material.AnchoPliego)) res["anchoPliego"] = p1.Material.AnchoPliego!;
            if (!string.IsNullOrWhiteSpace(p1.Material.AltoPliego)) res["altoPliego"] = p1.Material.AltoPliego!;
            if (!string.IsNullOrWhiteSpace(p1.Material.Hojas)) res["hojas"] = p1.Material.Hojas!;
            if (!string.IsNullOrWhiteSpace(p1.Material.Cabidad)) res["cb"] = p1.Material.Cabidad!;
            if (!string.IsNullOrWhiteSpace(p1.Material.TamanoFinal)) res["tamanoFinal"] = p1.Material.TamanoFinal!;
        }

        var detalle = SerializeProcesosDetalle(p1.Procesos
            .Select(p => (p.Proceso, p.Notas, p.Cantidad))
            .ToList());
        if (!string.IsNullOrWhiteSpace(detalle))
        {
            res["procesosDetalle"] = detalle;
            res["cantidadProcesos"] = p1.Procesos.Count.ToString();
        }
    }

}


