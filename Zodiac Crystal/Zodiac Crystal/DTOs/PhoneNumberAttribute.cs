using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Zodiac_Crystal.DTOs
{
    // Phone as sent by the frontend's phone field: "+<country code> <national number>",
    // e.g. "+91 9876543210". Only the country codes the field offers are accepted,
    // each with its own mobile-number pattern - keep in sync with
    // Frontend/src/app/data/phone-countries.data.ts.
    [AttributeUsage(AttributeTargets.Property)]
    public class PhoneNumberAttribute : ValidationAttribute
    {
        private static readonly Dictionary<string, Regex> NumberPatterns = new()
        {
            ["91"] = new Regex(@"^[6-9][0-9]{9}$"),
            ["1"] = new Regex(@"^[2-9][0-9]{9}$"),
            ["44"] = new Regex(@"^7[0-9]{9}$"),
            ["971"] = new Regex(@"^5[0-9]{8}$"),
            ["61"] = new Regex(@"^4[0-9]{8}$"),
            ["65"] = new Regex(@"^[89][0-9]{7}$"),
            ["977"] = new Regex(@"^9[0-9]{9}$"),
            ["880"] = new Regex(@"^1[3-9][0-9]{8}$"),
            ["94"] = new Regex(@"^7[0-9]{8}$"),
        };

        private static readonly Regex Format = new(@"^\+([0-9]{1,4}) ([0-9]+)$");

        public PhoneNumberAttribute()
            : base("Enter a valid mobile number for the selected country code.") { }

        public override bool IsValid(object? value)
        {
            // [Required] reports missing values.
            if (value is not string phone || phone.Length == 0)
            {
                return true;
            }

            var match = Format.Match(phone);
            return match.Success
                && NumberPatterns.TryGetValue(match.Groups[1].Value, out var pattern)
                && pattern.IsMatch(match.Groups[2].Value);
        }
    }
}
