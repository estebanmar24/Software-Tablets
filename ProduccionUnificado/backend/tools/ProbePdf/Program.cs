using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

var root = @"G:\Proyecto-Tablets\Adjuntos";
var files = new[]
{
    Path.Combine(root, "fichas", "F7679.pdf"),
    Path.Combine(root, "op", "OP7679.pdf"),
    Path.Combine(root, "op", "OP7706.pdf"),
};

foreach (var path in files)
{
    if (!File.Exists(path)) { Console.WriteLine($"MISSING {path}"); continue; }
    Console.WriteLine($"======== {Path.GetFileName(path)} ========");
    using var doc = PdfDocument.Open(path);
    var sb = new System.Text.StringBuilder();
    foreach (var page in doc.GetPages())
        sb.AppendLine(ContentOrderTextExtractor.GetText(page));
    var text = sb.ToString();
    Console.WriteLine(text.Length > 5000 ? text[..5000] + "\n...[truncado]" : text);
    Console.WriteLine($"--- chars: {text.Length} pages: {doc.NumberOfPages}");
}
