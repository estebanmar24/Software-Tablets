using System.Globalization;

using System.Text.Json;

using System.Text.RegularExpressions;



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

        AsignarSiValido(res, "pieza",
            Primero(
                Extraer(texto, @"Pieza:\s*(.+?)(?:\n|$)"),
                raw.GetValueOrDefault("pieza")));

        ParseOpMaterial(texto, res);
        ParseOpProcesos(texto, res);

        if (!string.IsNullOrWhiteSpace(numero))
            res["numeroOp"] = numero;

        return FiltrarVacios(res);
    }

    private static void ParseOpMaterial(string texto, Dictionary<string, string> res)
    {
        // OCR Aleph: "- CARTULINA ZENITHCA 16 270 GRANCH - 70,00 58,50 ... 35 x 58"
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
                AsignarSiValido(res, "material", LimpiarMaterialNombre(patronFila.Groups[1].Value));
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
            res["material"] = LimpiarMaterialNombre(nombreM.Value);

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

    private static string LimpiarMaterialNombre(string raw)
    {
        var s = Limpiar(raw);
        s = Regex.Replace(s, @"^[-–]\s*", "");
        s = Regex.Replace(s, @"\s+[-–]\s*$", "");
        return s.Trim();
    }

    private static void ParseOpProcesos(string texto, Dictionary<string, string> res)
    {
        var start = Regex.Match(texto, @"Proceso\s+Notas\s+Cantidad", RegexOptions.IgnoreCase);
        var section = start.Success ? texto[start.Index..] : texto;

        var end = Regex.Match(section,
            @"Observaciones|TIEMPOS\s+MAQUINA|ESTE\s+ES\s+UN\s+DOCUMENTO|SALIDA\s+DE\s+INSUMOS",
            RegexOptions.IgnoreCase);
        if (end.Success)
            section = section[..end.Index];

        var filas = new List<(string Proceso, string Notas, string Cantidad)>();

        foreach (var rawLine in section.Split('\n'))
        {
            var line = Limpiar(rawLine);
            if (line.Length < 3) continue;
            if (line.Contains("Proceso Notas", StringComparison.OrdinalIgnoreCase)) continue;
            if (Regex.IsMatch(line, @"^(Material|AnchoRollo)\b", RegexOptions.IgnoreCase)) continue;
            if (line is "0,00" or "LINEAL" or "COLOR") continue;

            var cantMatch = Regex.Match(line, @"([\d]{1,4}(?:\.\d{3})*,\d{2})\s*$");
            if (!cantMatch.Success)
                cantMatch = Regex.Match(line, @"(\d+,\d{2})\s*$");

            if (!cantMatch.Success)
            {
                if (filas.Count == 0) continue;
                var last = filas[^1];
                filas[^1] = (last.Proceso, $"{last.Notas} {line}".Trim(), last.Cantidad);
                continue;
            }

            var cantidad = cantMatch.Groups[1].Value.Trim();
            var antesCant = line[..cantMatch.Index].Trim();

            if (!Regex.IsMatch(antesCant, @"^\d{2}[a-z]?\s+", RegexOptions.IgnoreCase))
            {
                if (filas.Count == 0) continue;
                var last = filas[^1];
                var extra = string.IsNullOrWhiteSpace(antesCant) ? "" : antesCant;
                filas[^1] = (last.Proceso, $"{last.Notas} / {extra}".Trim(' ', '/'), last.Cantidad);
                continue;
            }

            if (!TrySplitProcesoNotas(antesCant, out var proceso, out var notas))
                continue;

            if (string.IsNullOrWhiteSpace(notas))
                notas = "—";

            filas.Add((proceso, notas, cantidad));
        }

        if (filas.Count == 0) return;

        res["cantidadProcesos"] = filas.Count.ToString();
        res["procesosDetalle"] = string.Join("\n",
            filas.Select(f => $"{f.Proceso} | {f.Notas} | {f.Cantidad}"));
    }

    private static bool TrySplitProcesoNotas(string antesCant, out string proceso, out string notas)
    {
        proceso = "";
        notas = "";
        var m = Regex.Match(
            antesCant,
            @"^(\d{2}[a-z]?)\s+(.+?)(?=\s+(?:Rollo\s+de|Refilar|PANTONE|Troquelar|ENVIAR\s))",
            RegexOptions.IgnoreCase);
        if (m.Success)
        {
            proceso = $"{m.Groups[1].Value} {m.Groups[2].Value}".Trim();
            notas = antesCant[m.Length..].Trim();
            return true;
        }

        var fallback = Regex.Match(antesCant, @"^(\d{2}[a-z]?)\s+(\S+(?:\s+\S+)?)(?:\s+(.+))?$", RegexOptions.IgnoreCase);
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

}


