using System.Globalization;
using System.Text;

namespace Zodiac_Crystal.Services
{
    /// <summary>
    /// Single shared place for turning tabular data into a correctly-escaped CSV
    /// byte stream, so every admin export endpoint (Orders/Products/Stock/Reports)
    /// uses the exact same formatting rules instead of hand-rolling string
    /// concatenation separately in each controller.
    /// </summary>
    public class CsvExportService
    {
        public byte[] BuildCsv(IEnumerable<string> headers, IEnumerable<IEnumerable<object?>> rows)
        {
            return WrapWithBom(BuildCsvSection(headers, rows));
        }

        // Renders one headers+rows table as plain CSV text (no BOM) - used directly
        // when several sections need to be concatenated into a single combined file
        // (e.g. the Sales Reports export), so the BOM is only added once, at the
        // very start of the final file, rather than once per section.
        public string BuildCsvSection(IEnumerable<string> headers, IEnumerable<IEnumerable<object?>> rows)
        {
            var builder = new StringBuilder();

            builder.AppendLine(string.Join(",", headers.Select(EscapeField)));

            foreach (var row in rows)
            {
                builder.AppendLine(string.Join(",", row.Select(FormatCell)));
            }

            return builder.ToString();
        }

        public byte[] WrapWithBom(string csvText)
        {
            // A UTF-8 BOM is included so Excel (which otherwise guesses the wrong
            // encoding) correctly displays non-ASCII characters like the rupee sign.
            var preamble = Encoding.UTF8.GetPreamble();
            var body = Encoding.UTF8.GetBytes(csvText);

            var result = new byte[preamble.Length + body.Length];
            Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
            Buffer.BlockCopy(body, 0, result, preamble.Length, body.Length);

            return result;
        }

        // Dates are the only cells allowed to be formulas (see FormatValue). Any
        // other text that starts like a formula is neutralised, so a customer
        // named "=HYPERLINK(...)" can't run as a formula when an admin opens the file.
        private static string FormatCell(object? value)
        {
            var text = FormatValue(value);
            return EscapeField(value is DateTime or decimal or double or int or long or bool ? text : NeutraliseFormula(text));
        }

        private static string NeutraliseFormula(string text) =>
            text.Length > 0 && text[0] is '=' or '+' or '-' or '@' or '\t' or '\r' ? "'" + text : text;

        private static string FormatValue(object? value)
        {
            return value switch
            {
                null => string.Empty,
                // Excel auto-detects a plain "yyyy-MM-dd HH:mm" string as a real date/time
                // value and reformats it using the system locale's date display, which is
                // often wider than the column - showing "########" instead of the date
                // unless the column happens to already be wide enough. Wrapping it as
                // ="..." forces Excel to treat the cell as a text-literal formula instead
                // of a date, so it always displays exactly as written regardless of column
                // width. (EscapeField below still safely escapes the embedded quotes.)
                DateTime dt => $"=\"{dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)}\"",
                decimal dec => dec.ToString("0.00", CultureInfo.InvariantCulture),
                double dbl => dbl.ToString("0.00", CultureInfo.InvariantCulture),
                bool b => b ? "Yes" : "No",
                _ => value.ToString() ?? string.Empty
            };
        }

        // Wraps a field in quotes (and doubles any embedded quotes) whenever it
        // contains a comma, quote, or newline - the standard CSV escaping rule.
        private static string EscapeField(string field)
        {
            if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
            {
                return $"\"{field.Replace("\"", "\"\"")}\"";
            }

            return field;
        }
    }
}
